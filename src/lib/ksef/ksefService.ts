import { XMLParser } from 'fast-xml-parser';
import Decimal from 'decimal.js';
import crypto from 'crypto';

// Base URL: https://api.ksef.mf.gov.pl/api
const KSEF_BASE_URL = (process.env.KSEF_BASE_URL || 'https://api.ksef.mf.gov.pl/api').replace(/\/$/, '');
const KSEF_TOKEN = process.env.KSEF_TOKEN;
const DEFAULT_NIP = '9542751368';

// ─── Module-Level Cache ────────────────────────────────────────────────────────

// Public Key Cache
let cachedPublicKey: crypto.KeyObject | null = null;
let keyFetchTime: number = 0;
const KEY_CACHE_TTL = 1000 * 60 * 60; // 1 hour

// Access Token Cache (Final Handshake Token)
let cachedAccessToken: string | null = null;
let tokenFetchTime: number = 0;
const TOKEN_CACHE_TTL = 1000 * 60 * 55; // 55 mins (approx 1h)

async function fetchKSeFPublicKey(retryCount: number = 3): Promise<crypto.KeyObject> {
    const now = Date.now();
    if (cachedPublicKey && (now - keyFetchTime < KEY_CACHE_TTL)) {
        return cachedPublicKey;
    }

    const url = `${KSEF_BASE_URL}/v2/security/public-key-certificates`;
    let lastError: Error | null = null;

    for (let i = 0; i < retryCount; i++) {
        try {
            console.log(`[KSeF_SERVICE] Step 2a: Fetching dynamic public key (Attempt ${i + 1}/${retryCount})`);
            const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
            const text = await res.text();
            if (!res.ok) {
                throw new Error(`Failed to fetch KSeF public key (${res.status}): ${text}`);
            }

            const certs: Array<{ certificate: string; usage: string[] }> = JSON.parse(text);
            const encCert = certs.find(c =>
                c.usage.some(u => u.toLowerCase().includes('asymmetric') || u.toLowerCase().includes('encryption'))
            ) || certs[0];

            if (!encCert?.certificate) {
                throw new Error('No valid encryption certificate found in KSeF response');
            }

            const rawCert = encCert.certificate.trim();
            console.log(`[KSeF_SERVICE] Parsing certificate with X509 (length: ${rawCert.length})`);

            let derBuffer: Buffer;
            if (rawCert.includes('-----BEGIN')) {
                derBuffer = Buffer.from(rawCert.replace(/-----(BEGIN|END) CERTIFICATE-----/g, '').replace(/\s+/g, ''), 'base64');
            } else {
                derBuffer = Buffer.from(rawCert, 'base64');
            }

            const x509 = new crypto.X509Certificate(derBuffer);
            const keyObject = x509.publicKey;

            cachedPublicKey = keyObject;
            keyFetchTime = now;
            console.log('[KSeF_SERVICE] Step 2a OK: Dynamic key fetched and parsed.');
            return keyObject;

        } catch (err: unknown) {
            const error = err as Error;
            console.error(`[KSeF_SERVICE] Public key attempt ${i + 1} failed: ${error.message}`);
            lastError = error;
            if (i < retryCount - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }

    throw new Error(`Failed to read asymmetric key after ${retryCount} attempts: ${lastError?.message}`);
}

/**
 * Step 2b: Encrypt `token|timestampMs` with RSA-OAEP SHA-256.
 */
async function encryptKSeFToken(token: string, timestampMs: number): Promise<string> {
    const publicKey = await fetchKSeFPublicKey();
    const payload = `${token}|${timestampMs}`;
    const encrypted = crypto.publicEncrypt(
        {
            key: publicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256',
        },
        Buffer.from(payload, 'utf8')
    );
    return encrypted.toString('base64');
}

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
    buyerNip: string;
    buyerName: string;
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

export interface KSeFInvoiceHeader {
    invoiceReferenceNumber: string;
    ksefNumber?: string;
    invoiceNumber?: string;
    issueDate?: string;
    netAmount?: number;
    vatAmount?: number;
    grossAmount?: number;
    currency?: string;
    seller?: {
        nip?: string;
        name?: string;
    };
    buyer?: {
        identifier?: { value: string };
        name?: string;
    };
    subject1?: {
        issuedByIdentifier?: { value: string };
        issuedByName?: string;
    };
    subject2?: {
        issuedByIdentifier?: { value: string };
        issuedByName?: string;
    };
    [key: string]: unknown;
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
     * KSeF Workflow V2.3 "Hybryda" - Heavy RSA Auth -> Lightweight Metadata.
     * Restores Challenge + RSA for Init, maintains Bearer for Metadata.
     */
    async performFullHandshake(nip?: string, token?: string): Promise<{ accessToken: string; refreshToken: string }> {
        const targetNip = nip || process.env.KSEF_NIP || DEFAULT_NIP;
        const targetToken = token || KSEF_TOKEN;

        if (!targetToken) throw new Error('KSEF_TOKEN missing in environment.');

        console.log(`[KSeF_SERVICE] Hybrid Handshake (RSA Init) for NIP: ${targetNip}...`);

        // KROK 1: Challenge (Wymagany do encryptedToken)
        const challengeRes = await fetch(`${KSEF_BASE_URL}/v2/auth/challenge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nip: targetNip }),
            signal: AbortSignal.timeout(25000)
        });

        const challengeText = await challengeRes.text();
        if (!challengeRes.ok) throw new Error(`Challenge failed (${challengeRes.status}): ${challengeText}`);
        const { challenge, timestampMs } = JSON.parse(challengeText);

        // KROK 2: Encryption (KSeF Public Key)
        const encryptedToken = await encryptKSeFToken(targetToken, timestampMs);

        // KROK 3: KSeF-Token Init (V2 Architecture Payload)
        const bodyPayload = {
            contextIdentifier: {
                type: "nip",
                value: targetNip
            },
            challenge,
            encryptedToken
        };

        console.log(`[KSeF_DEBUG] HYBRID AUTH BODY:`, JSON.stringify(bodyPayload, null, 2));

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

        // KROK 4 (Polling): waitForAuthOk (Step 4 Final Flow)
        let pollAttempts = 0;
        let isReady = false;
        const delay = 2000;

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

        // KROK 5 (Redeem): POST /auth/token/redeem
        console.log(`[KSeF_SERVICE] Step 5: Token Redeem for ${refNum}...`);
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
     * Alias for getAccessToken to support legacy or alternative naming conventions
     */
    async getSessionToken(nip?: string, token?: string): Promise<string> {
        return this.getAccessToken(nip, token);
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
        pageOffset?: number;
        subjectType?: 'subject1' | 'subject2' | 'subject3' | 'Subject1' | 'Subject2' | 'Subject3';
        dateType?: 'Issue' | 'PermanentStorage' | 'issue' | 'permanentStorage';
    }): Promise<KSeFInvoiceHeader[]> {
        console.log('[KSeF_SERVICE] Step 6: Fetching invoice metadata (Sync Incremental)...');

        // Default range: Last 7 days (Wizjoner Final Flow to prevent 504 Timeouts)
        const from = options?.dateFrom || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const to = options?.dateTo || new Date().toISOString();

        const headers = await this.getHeaders('application/json', {
            accessToken: options?.accessToken,
            customToken: options?.testToken,
        });

        const pageSize = options?.pageSize || 100;
        const pageOffset = options?.pageOffset || 0;
        
        // Final URL with pageOffset/pageSize as Query Parameters (KSeF V2 requirement)
        const url = `${KSEF_BASE_URL}/v2/invoices/query/metadata?pageOffset=${pageOffset}&pageSize=${pageSize}`;
        
        // Subject mapping to PascalCase (Subject1 = Seller, Subject2 = Buyer)
        const subjectMap: Record<string, string> = {
            'subject1': 'Subject1',
            'subject2': 'Subject2',
            'subject3': 'Subject3',
            'Subject1': 'Subject1',
            'Subject2': 'Subject2',
            'Subject3': 'Subject3',
        };
        const mappedSubject = subjectMap[options?.subjectType || 'subject2'] || 'Subject2';

        // DateType mapping (Default to Issue, handle PermanentStorage for Incremental Sync)
        const dateTypeMap: Record<string, string> = {
            'issue': 'Issue',
            'Issue': 'Issue',
            'permanentStorage': 'PermanentStorage',
            'PermanentStorage': 'PermanentStorage'
        };
        const mappedDateType = dateTypeMap[options?.dateType || ''] || 'Issue';

        // Helper to format date with +02:00 (Polish Summer Time)
        const formatKSeFDate = (isoStr: string, isEnd: boolean) => {
            const d = new Date(isoStr);
            const pad = (n: number) => n.toString().padStart(2, '0');
            const datePart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            const timePart = isEnd ? "23:59:59" : "00:00:00";
            return `${datePart}T${timePart}+02:00`;
        };

        // KSeF Query Metadata Body (NO paging, NO invoiceType)
        const bodyPayload = {
            subjectType: mappedSubject,
            dateRange: {
                dateType: mappedDateType,
                from: formatKSeFDate(from, false),
                to: formatKSeFDate(to, true)
            }
        };

        const rawBody = JSON.stringify(bodyPayload);
        console.log(`[KSeF_DEBUG] RAW BODY TO KSeF:`, rawBody);

        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: rawBody,
            signal: AbortSignal.timeout(25000)
        });

        const rawText = await res.text();
        if (res.status === 404) return [];

        if (!res.ok) {
            console.error("[KSeF_DEBUG] Full Error Response:", rawText);
            throw new Error(`KSeF status ${res.status}: ${rawText.substring(0, 100)}`);
        }

        const data = JSON.parse(rawText);
        console.log(`[KSeF_DEBUG] FULL RESPONSE DATA:`, JSON.stringify(data, null, 2));
        
        const invoices = data.invoices || data.invoiceHeaderList || data.invoiceHeaders || [];
        
        // Inject direction (INCOME for Subject1, EXPENSE for Subject2)
        const direction = mappedSubject === 'Subject1' ? 'INCOME' : 'EXPENSE';
        return invoices.map((inv: any) => ({
            ...inv,
            _apiDirection: direction
        }));
    }

    /**
     * Fetch & Parse XML
     */
    async fetchAndParse(ksefNumber: string, options?: { accessToken?: string; testToken?: string }): Promise<KsefParsedInvoice> {
        console.log(`[KSeF_SERVICE] Step 7: Fetching detail XML for ${ksefNumber}...`);

        const headers = await this.getHeaders('application/xml', {
            accessToken: options?.accessToken,
            customToken: options?.testToken,
        });

        const res = await fetch(`${KSEF_BASE_URL}/v2/invoices/ksef/${ksefNumber}`, {
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

        const lineItems = sourceWiersze.map((item: { P_7?: string; P_8B?: string; P_8A?: string; P_9B?: string; P_12?: string }) => ({
            name: (useZamowienie ? `[ZAM] ` : "") + (item.P_7 || 'Pozycja bez nazwy'),
            quantity: parseFloat(item.P_8B || '0'),
            unit: item.P_8A || 'szt.',
            netPrice: parseFloat(item.P_9B || '0'),
            vatRate: item.P_12 || 'zw',
        }));


        const netAmount = new Decimal(fa.P_13_1 || 0).plus(fa.P_13_2 || 0).plus(fa.P_13_3 || 0);
        const grossAmount = new Decimal(fa.P_15 || 0);

        return {
            ksefNumber: String(ksefNumber),
            invoiceNumber: String(fa.P_2 || 'Unknown'),
            issueDate: new Date(fa.P_1),
            dueDate: new Date(fa.P_1),
            sellerNip: String(sprzedawca?.NIP || 'Brak'),
            sellerName: String(sprzedawca?.Nazwa || 'Brak'),
            sellerAddress: String(faktura.Podmiot1?.Adres?.AdresL1 || 'Brak adresu'),
            sellerBankAccount: null,
            buyerNip: String(nabywca?.NIP || 'Brak'),
            buyerName: String(nabywca?.Nazwa || 'Brak'),
            counterpartyNip: String(nabywca?.NIP || 'Brak'), // Legacy compatibility
            counterpartyName: String(nabywca?.Nazwa || 'Brak'), // Legacy compatibility
            ksefType: String(rodzajFaktury || 'VAT'),
            netAmount,
            vatAmount: grossAmount.minus(netAmount),
            grossAmount,
            currency: String(fa.KodWaluty || 'PLN'),
            paymentStatus: 'UNPAID',
            lineItems,
            rawXml,
        };
    }
}
