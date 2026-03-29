import { XMLParser } from 'fast-xml-parser';
import Decimal from 'decimal.js';

// Base URL: https://api.ksef.mf.gov.pl/api
const KSEF_BASE_URL = (process.env.KSEF_BASE_URL || 'https://api.ksef.mf.gov.pl/api').replace(/\/$/, '');
const KSEF_TOKEN = process.env.KSEF_TOKEN;
const DEFAULT_NIP = '9542751368';

// ─── Module-Level Cache ────────────────────────────────────────────────────────

// Access Token Cache (Final Handshake Token)
let cachedAccessToken: string | null = null;
let tokenFetchTime: number = 0;
const TOKEN_CACHE_TTL = 1000 * 60 * 55; // 55 mins (approx 1h)

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface KsefParsedInvoice {
    ksefNumber: string;
    invoiceNumber: string;
    issueDate: Date;
    counterpartyNip: string;
    counterpartyName: string;
    netAmount: Decimal;
    vatAmount: Decimal;
    grossAmount: Decimal;
    currency: string;
    sellerNip: string;
    sellerName: string;
    sellerAddress: string;
    sellerBankAccount: string | null;
    ksefType: string;
    dueDate: Date;
    paymentStatus: 'PAID' | 'UNPAID';
    lineItems: Array<{
        name: string;
        quantity: number;
        unit: string;
        netPrice: number;
        vatRate: string;
    }>;
    rawXml: string;
}

// ─── Service ───────────────────────────────────────────────────────────────────

export class KSeFService {
    private parser: XMLParser;

    constructor() {
        this.parser = new XMLParser({
            ignoreAttributes: false,
            removeNSPrefix: true, // FA (3) standard
            attributeNamePrefix: '@_',
            isArray: (name) => {
                // Force array for line items and order lines even if single entry exists (Standard FA 3)
                return ['FaWiersz', 'ZamowienieWiersz'].includes(name);
            }
        });
    }

    /**
     * KSeF v2.0 uses Authorization: Bearer {accessToken} header
     */
    private async getHeaders(contentType: string = 'application/json', options?: { accessToken?: string; customToken?: string }) {
        const headers: Record<string, string> = {
            'Content-Type': contentType,
            'Accept': 'application/json',
        };

        if (contentType === 'application/xml') {
            headers['Accept'] = 'application/xml';
        }

        let token = options?.accessToken || options?.customToken;
        
        // Final fallback if no token provided: use existing logic
        if (!token) {
            token = await this.getAccessToken();
        }

        headers['Authorization'] = `Bearer ${token}`;
        return headers;
    }

    /**
     * KSeF Workflow V2.2 "Czyste Cięcie" - Raw Token Handshake
     * No RSA, No Encryption, Direct Token Initialization.
     */
    async performFullHandshake(nip?: string, token?: string): Promise<{ accessToken: string; refreshToken: string }> {
        const targetNip = nip || process.env.KSEF_NIP || DEFAULT_NIP;
        const targetToken = token || KSEF_TOKEN;

        if (!targetToken) throw new Error('KSEF_TOKEN missing in environment.');

        console.log(`[KSeF_SERVICE] Step 1: KSeF-Token Init (Raw Token) for NIP: ${targetNip}...`);

        const bodyPayload = { token: targetToken };
        console.log('[KSeF_DEBUG] AUTH BODY:', JSON.stringify(bodyPayload, null, 2));

        // KROK 1: KSeF-Token Init (Raw Token as per Auditor Instruction)
        const initRes = await fetch(`${KSEF_BASE_URL}/v2/auth/ksef-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyPayload),
            signal: AbortSignal.timeout(25000)
        });

        const initText = await initRes.text();
        if (!initRes.ok && initRes.status !== 202) throw new Error(`KSeF-Token failed (${initRes.status}): ${initText}`);

        const initData = JSON.parse(initText);
        const refNum = initData.referenceNumber;
        const authTok = initData.authenticationToken?.token;
        
        if (!refNum || !authTok) throw new Error('No referenceNumber or authenticationToken in KSeF response');

        // KROK 2 (Polling): waitForAuthOk (Step 4 Final Flow)
        let pollAttempts = 0;
        let isReady = false;
        const delay = 2000; // Fixed 2s interval

        while (pollAttempts < 150) {
            pollAttempts++;
            const statusRes = await fetch(`${KSEF_BASE_URL}/v2/auth/${refNum}`, {
                method: 'GET',
                headers: { 
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${authTok}`
                },
                signal: AbortSignal.timeout(25000)
            });

            const statusText = await statusRes.text();
            const statusData = JSON.parse(statusText);
            const statusCode = statusData.status?.code || statusRes.status;

            console.log(`[KSeF_SERVICE] Polling Attempt ${pollAttempts}/150. Status Code: ${statusCode}`);

            if (statusCode === 200) {
                isReady = true;
                break;
            } 
            
            if (statusCode === 450) {
                throw new Error('Token KSeF nieprawidłowy (Status 450). Przerwano handshake.');
            }

            await new Promise(r => setTimeout(r, delay));
        }

        if (!isReady) throw new Error(`Handshake timed out for ${refNum}`);

        // KROK 3 (Redeem): POST /auth/token/redeem
        console.log(`[KSeF_SERVICE] Step 3: Token Redeem for ${refNum}...`);
        const redeemRes = await fetch(`${KSEF_BASE_URL}/v2/auth/token/redeem`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${authTok}`
            },
            body: JSON.stringify({}),
            signal: AbortSignal.timeout(25000)
        });

        const redeemText = await redeemRes.text();
        if (!redeemRes.ok) throw new Error(`Redeem failed (${redeemRes.status}): ${redeemText}`);

        const redeemData = JSON.parse(redeemText);
        const accessToken = redeemData.accessToken?.token || redeemData.sessionToken?.token;
        const refreshToken = redeemData.refreshToken?.token;

        if (!accessToken || !refreshToken) throw new Error('Failed to retrieve full JWT token pair');

        return { accessToken, refreshToken };
    }

    /**
     * Compatibility wrapper
     */
    async getAccessToken(nip?: string, token?: string): Promise<string> {
        if (cachedAccessToken && (Date.now() - tokenFetchTime < TOKEN_CACHE_TTL)) {
            return cachedAccessToken;
        }

        const data = await this.performFullHandshake(nip, token);
        cachedAccessToken = data.accessToken;
        tokenFetchTime = Date.now();
        return cachedAccessToken;
    }

    /**
     * Query for received invoices (Subject2 = EXPENSE)
     */
    async fetchInvoiceMetadata(options?: {
        accessToken?: string;
        testToken?: string;
        dateFrom?: string;
        dateTo?: string;
        pageSize?: number;
        subjectType?: 'subject1' | 'subject2' | 'subject3';
    }): Promise<any[]> {
        console.log('[KSeF_SERVICE] Step 5: Fetching invoice metadata (Sync Incremental)...');

        // Default range: Last 7 days (Wizjoner Final Flow to prevent 504 Timeouts)
        const from = options?.dateFrom || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const to = options?.dateTo || new Date().toISOString();

        const headers = await this.getHeaders('application/json', {
            accessToken: options?.accessToken,
            customToken: options?.testToken,
        });

        const pageSize = options?.pageSize || 100;
        const pageOffset = 0;
        
        const url = `${KSEF_BASE_URL}/v2/invoices/query/metadata`;
        const isSales = (options?.subjectType === 'subject1');

        // Helper to format date with +02:00 (Polish Summer Time)
        const formatKSeFDate = (isoStr: string, isEnd: boolean) => {
            const d = new Date(isoStr);
            const pad = (n: number) => n.toString().padStart(2, '0');
            const datePart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            const timePart = isEnd ? "23:59:59" : "00:00:00";
            return `${datePart}T${timePart}+02:00`;
        };

        const bodyPayload = {
            filters: {
                dateRange: {
                    dateType: "issue",
                    from: formatKSeFDate(from, false),
                    to: formatKSeFDate(to, true)
                },
                subjectType: options?.subjectType || 'subject2',
                invoiceType: isSales ? "sales" : "purchase"
            },
            paging: {
                offset: pageOffset,
                limit: pageSize
            }
        };

        console.log(`[KSeF_DEBUG] Sending JWT v2 Query:`, JSON.stringify(bodyPayload, null, 2));

        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(bodyPayload),
            signal: AbortSignal.timeout(25000)
        });

        const rawText = await res.text();
        if (res.status === 404) return [];

        if (!res.ok) {
            console.error("[KSeF_DEBUG] Full Error Response:", rawText);
            throw new Error(`KSeF status ${res.status}: ${rawText.substring(0, 100)}`);
        }

        const data = JSON.parse(rawText);
        return data.invoiceHeaderList || [];
    }

    /**
     * Fetch & Parse XML
     */
    async fetchAndParse(ksefNumber: string, options?: { accessToken?: string; testToken?: string }): Promise<KsefParsedInvoice> {
        console.log(`[KSeF_SERVICE] Step 6: Fetching detail XML for ${ksefNumber}...`);

        const headers = await this.getHeaders('application/xml', {
            accessToken: options?.accessToken,
            customToken: options?.testToken,
        });

        const res = await fetch(`${KSEF_BASE_URL}/v2/online/Invoice/Get/${ksefNumber}`, {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(25000)
        });

        const rawXml = await res.text();
        if (!res.ok) throw new Error(`KSeF detail fetch status ${res.status}: ${rawXml.substring(0, 100)}`);

        const parsed = this.parser.parse(rawXml);
        const faktura = parsed.Faktura;
        if (!faktura) throw new Error('Invalid KSeF XML: Missing <Faktura> root element');

        const fa = faktura.Fa;
        const sprzedawca = faktura.Podmiot1?.DaneIdentyfikacyjne;
        const nabywca = faktura.Podmiot2?.DaneIdentyfikacyjne;

        const rodzajFaktury = fa.RodzajFaktury; 
        const useZamowienie = rodzajFaktury === 'ZAL' && fa.Zamowienie?.ZamowienieWiersz;
        const sourceWiersze = useZamowienie ? fa.Zamowienie.ZamowienieWiersz : (fa.FaWiersz || []);

        const lineItems = sourceWiersze.map((item: any) => ({
            name: (useZamowienie ? `[ZAM] ` : "") + (item.P_7 || 'Pozycja bez nazwy'),
            quantity: parseFloat(item.P_8B || '0'),
            unit: item.P_8A || 'szt.',
            netPrice: parseFloat(item.P_9B || '0'),
            vatRate: item.P_12 || 'zw',
        }));

        const netAmountDecimal = new Decimal(fa.P_13_1 || 0).plus(fa.P_13_2 || 0).plus(fa.P_13_3 || 0); // Simplified for now
        let grossAmountDecimal = new Decimal(fa.P_15 || 0);

        return {
            ksefNumber,
            invoiceNumber: fa.P_2 || 'Unknown',
            issueDate: new Date(fa.P_1),
            dueDate: new Date(fa.P_1),
            counterpartyNip: nabywca?.NIP || 'Brak',
            counterpartyName: nabywca?.Nazwa || 'Brak',
            sellerNip: sprzedawca.NIP || 'Brak',
            sellerName: sprzedawca.Nazwa || 'Brak',
            sellerAddress: faktura.Podmiot1?.Adres?.AdresL1 || 'Brak adresu',
            sellerBankAccount: null,
            ksefType: rodzajFaktury || 'VAT',
            netAmount: netAmountDecimal,
            vatAmount: new Decimal(0),
            grossAmount: grossAmountDecimal,
            currency: fa.KodWaluty || 'PLN',
            paymentStatus: 'UNPAID',
            lineItems,
            rawXml,
        };
    }
}
