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
            console.log(`[KSeF_SERVICE] Step 2a: Fetching dynamic public key from: ${url} (Attempt ${i + 1}/${retryCount})`);
            const res = await fetch(url);
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

        } catch (err: any) {
            console.error(`[KSeF_SERVICE] Public key attempt ${i + 1} failed: ${err.message}`);
            lastError = err;
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

        const token = options?.accessToken || options?.customToken || await this.getAccessToken();
        headers['Authorization'] = `Bearer ${token}`;

        return headers;
    }

    /**
     * KSeF v2.0 4-Step Handshake (JWT v2 Update)
     * 1. POST /v2/auth/challenge
     * 2. Key Fetch & RSA-OAEP Encryption
     * 3. POST /v2/auth/ksef-token (Init) -> Reference Number
     * 4. GET /v2/auth/{referenceNumber} -> Poll for "Success"
     * 5. POST /v2/auth/token/redeem (Final) -> accessToken & refreshToken
     */
    async getAccessToken(nip?: string, token?: string): Promise<string> {
        const now = Date.now();

        // 0. Use cache if valid
        if (cachedAccessToken && (now - tokenFetchTime < TOKEN_CACHE_TTL)) {
            return cachedAccessToken;
        }

        const targetNip = nip || process.env.KSEF_NIP || DEFAULT_NIP;
        const targetToken = token || KSEF_TOKEN;

        if (!targetToken) throw new Error('KSEF_TOKEN missing in environment.');

        console.log(`[KSeF_SERVICE] Starting JWT v2 Handshake for NIP: ${targetNip}...`);

        // ── KROK 1: Wyzwanie (Challenge) ─────────────────────
        const challengeRes = await fetch(`${KSEF_BASE_URL}/v2/auth/challenge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nip: targetNip }),
        });

        const challengeText = await challengeRes.text();
        if (!challengeRes.ok) {
            throw new Error(`Step 1 Challenge failed (${challengeRes.status}): ${challengeText}`);
        }

        const { challenge, timestampMs } = JSON.parse(challengeText);
        if (!challenge || !timestampMs) throw new Error('Invalid Challenge response');

        // ── KROK 2: Klucz i Szyfrowanie ──────
        const encryptedToken = await encryptKSeFToken(targetToken, timestampMs);

        // ── KROK 3: Inicjalizacja Tokena (ksef-token) ────────
        const initRes = await fetch(`${KSEF_BASE_URL}/v2/auth/ksef-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                challenge,
                contextIdentifier: {
                    type: "Nip",
                    value: targetNip
                },
                encryptedToken
            }),
        });

        const initText = await initRes.text();
        if (!initRes.ok && initRes.status !== 202) {
            throw new Error(`Step 3 Initialization failed (${initRes.status}): ${initText}`);
        }

        const initData = JSON.parse(initText);
        const referenceNumber = initData.referenceNumber;
        const authenticationToken = initData.authenticationToken?.token;
        
        if (!referenceNumber) throw new Error('No referenceNumber in Step 3 response');
        console.log('[KSeF_SERVICE] Step 3 referenceNumber:', referenceNumber);

        // ── KROK 4: Cierpliwy Handshake (Polling Statusu z Exponential Backoff) ──
        let pollAttempts = 0;
        const maxPollAttempts = 10; // Rozszerzone do 10 prób dla stabilności weekendowej
        let isSuccess = false;
        let currentDelay = 2000; // Start od 2 sekund

        while (pollAttempts < maxPollAttempts) {
            pollAttempts++;
            const statusRes = await fetch(`${KSEF_BASE_URL}/v2/auth/${referenceNumber}`, {
                method: 'GET',
                headers: { 
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${authenticationToken}`
                }
            });

            if (statusRes.ok) {
                const statusText = await statusRes.text();
                const statusData = JSON.parse(statusText);
                const statusCode = statusData.exception?.serviceCode || statusData.statusCode || "OK";
                
                console.log(`[KSeF_SERVICE] Polling status (${pollAttempts}/${maxPollAttempts}) [${statusCode}]: ${statusData.status}`);
                
                if (statusData.status === "Success") {
                    isSuccess = true;
                    break;
                }
                
                // Zadanie: Logowanie statusu "Processing" (np. 310)
                if (statusData.status === "Processing" || statusCode === "310") {
                    console.log(`[KSeF_SERVICE] Sesja wciąż przetwarzana (Processing). Czekamy...`);
                }

            } else {
                const errText = await statusRes.text();
                // Błąd rzucaj tylko, gdy dostaniesz błąd krytyczny (np. 4xx/5xx inne niż 200/202)
                console.warn(`[KSeF_SERVICE] Status check returned non-200 (${statusRes.status}). Retrying... Details: ${errText.substring(0, 50)}`);
            }

            // Exponential Backoff: 2s -> 4s -> 8s (do max 16s)
            console.log(`[KSeF_SERVICE] Wykładniczy Backoff: Następna próba za ${currentDelay / 1000}s...`);
            await new Promise(r => setTimeout(r, currentDelay));
            currentDelay = Math.min(currentDelay * 2, 16000); 
        }

        if (!isSuccess) {
            throw new Error(`KSeF Auth Polling timed out (Final status not Success) after ${pollAttempts} attempts for ${referenceNumber}`);
        }

        // ── KROK 5: Wymiana na JWT (Redeem) ──────
        const redeemRes = await fetch(`${KSEF_BASE_URL}/v2/auth/token/redeem`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${authenticationToken}`
            },
            body: JSON.stringify({})
        });

        const redeemText = await redeemRes.text();
        if (!redeemRes.ok) {
            throw new Error(`Step 5 Redeem failed (${redeemRes.status}): ${redeemText}`);
        }

        const redeemData = JSON.parse(redeemText);
        const finalAccessToken = redeemData.accessToken?.token || redeemData.sessionToken?.token;

        if (!finalAccessToken) {
            throw new Error('No accessToken found in Redeem response');
        }

        // 6. Update Cache
        cachedAccessToken = finalAccessToken;
        tokenFetchTime = Date.now();

        console.log('[KSeF_SERVICE] JWT v2 Handshake Completed.');
        return finalAccessToken;
    }

    /**
     * Legacy wrapper to maintain compatibility with existing controllers
     */
    async getSessionToken(nip?: string, token?: string): Promise<string> {
        return this.getAccessToken(nip, token);
    }

    /**
     * Query for received invoices (Subject2 = EXPENSE)
     * v2.0 Synchronous Query (Step 5 Metadata)
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

        const from = options?.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const to = options?.dateTo || new Date().toISOString();

        const headers = await this.getHeaders('application/json', {
            accessToken: options?.accessToken,
            customToken: options?.testToken,
        });

        const pageSize = options?.pageSize || 100;
        const pageOffset = 0;
        
        // KSeF JWT v2 Query Metadata: /v2/invoices/query/metadata (No query params, all in body)
        const url = `${KSEF_BASE_URL}/v2/invoices/query/metadata`;
        
        console.log(`[KSeF_SERVICE] POST ${url}...`);

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
                invoiceType: isSales ? "sale" : "purchase"
            },
            paging: {
                offset: pageOffset,
                limit: pageSize
            }
        };

        console.log(`[KSeF_DEBUG] Sending JWT v2 Query:`, JSON.stringify(bodyPayload, null, 2));

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                ...headers
            },
            body: JSON.stringify(bodyPayload),
        });

        const rawText = await res.text();

        // Task: Handle 404 as "Brak faktur" (No results found in period)
        if (res.status === 404) {
            console.log("[KSeF_SERVICE] No invoices found for this period. Returning empty list.");
            return [];
        }

        if (!res.ok) {
            console.error("[KSeF_DEBUG] Full Error Response:", rawText);
            throw new Error(`KSeF status ${res.status}: ${rawText.substring(0, 100)}`);
        }

        const data = JSON.parse(rawText);
        const invoiceHeaders = data.invoiceHeaderList || [];

        if (invoiceHeaders.length === 0) {
            console.log('[KSeF_SERVICE] Step 5: Success but no invoices found in this range.');
        } else {
            console.log(`[KSeF_SERVICE] Step 5 OK: Found ${invoiceHeaders.length} invoice headers.`);
        }

        return invoiceHeaders;
    }

    /**
     * Fetch & Parse XML for a given KSeF reference number
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
        });

        const rawXml = await res.text();
        if (!res.ok) {
            console.error("[KSeF_DEBUG] Detail Fetch Error:", rawXml);
            throw new Error(`KSeF detail fetch status ${res.status}: ${rawXml.substring(0, 100)}`);
        }

        const parsed = this.parser.parse(rawXml);

        // Map FA (3) Schema (Standard FA 3 polymorphic support)
        const faktura = parsed.Faktura;
        if (!faktura) throw new Error('Invalid KSeF XML: Missing <Faktura> root element');

        const fa = faktura.Fa;
        const sprzedawca = faktura.Podmiot1?.DaneIdentyfikacyjne;
        const nabywca = faktura.Podmiot2?.DaneIdentyfikacyjne;

        if (!fa || !sprzedawca) throw new Error('Invalid KSeF XML: Missing <Fa> or <Podmiot1> identification');

        // Polymorphic Line Items mapping
        const rodzajFaktury = fa.RodzajFaktury; // 'ZAL' or others
        let lineItems: any[] = [];

        // Logical Switch: If ZAL and matching detail exists, use it exclusively. Otherwise fallback to standard lines.
        const useZamowienie = rodzajFaktury === 'ZAL' && fa.Zamowienie?.ZamowienieWiersz;
        const sourceWiersze = useZamowienie ? fa.Zamowienie.ZamowienieWiersz : (fa.FaWiersz || []);

        lineItems = sourceWiersze.map((item: any) => ({
            name: (useZamowienie ? `[ZAM] ` : "") + (item.P_7 || 'Pozycja bez nazwy'),
            quantity: parseFloat(item.P_8B || '0'),
            unit: item.P_8A || 'szt.',
            netPrice: parseFloat(item.P_9B || '0'),
            vatRate: item.P_12 || 'zw',
        }));

        const netAmountDecimal = new Decimal(fa.P_13_1 || 0)
            .plus(fa.P_13_2 || 0)
            .plus(fa.P_13_3 || 0)
            .plus(fa.P_13_4 || 0)
            .plus(fa.P_13_5 || 0)
            .plus(fa.P_13_6 || 0)
            .plus(fa.P_13_7 || 0);

        const vatAmountDecimal = new Decimal(fa.P_14_1 || 0)
            .plus(fa.P_14_2 || 0)
            .plus(fa.P_14_3 || 0);

        let grossAmountDecimal = new Decimal(fa.P_15 || 0);

        // Fallback if P_15 is missing or zero (requested for robustness)
        if (grossAmountDecimal.isZero()) {
            grossAmountDecimal = netAmountDecimal.plus(vatAmountDecimal);
        }

        // Extract Bank Account
        let bankAccount = null;
        if (fa.Platnosc?.RachunekBankowy?.NrRB) {
            bankAccount = fa.Platnosc.RachunekBankowy.NrRB;
        } else if (fa.Platnosc?.AdnotacjaOPlatnosci?.RachunekBankowy?.NrRB) {
            bankAccount = fa.Platnosc.AdnotacjaOPlatnosci.RachunekBankowy.NrRB;
        }

        // Extract Due Date
        let dueDate = new Date(fa.P_1);
        dueDate.setDate(dueDate.getDate() + 14); // 14 days fallback

        if (fa.Platnosc?.TerminyPlatnosci?.Termin) {
            dueDate = new Date(fa.Platnosc.TerminyPlatnosci.Termin);
        } else if (fa.Platnosc?.TerminyPlatnosci?.TerminPlatnosci && fa.Platnosc.TerminyPlatnosci.TerminPlatnosci.length > 0) {
            const firstTermin = Array.isArray(fa.Platnosc.TerminyPlatnosci.TerminPlatnosci)
                ? fa.Platnosc.TerminyPlatnosci.TerminPlatnosci[0]
                : fa.Platnosc.TerminyPlatnosci.TerminPlatnosci;
            if (firstTermin.Termin) {
                dueDate = new Date(firstTermin.Termin);
            }
        }

        return {
            ksefNumber,
            invoiceNumber: fa.P_2 || 'Unknown',
            issueDate: new Date(fa.P_1),
            dueDate,
            counterpartyNip: nabywca?.NIP || 'Brak',
            counterpartyName: nabywca?.Nazwa || 'Brak',
            sellerNip: sprzedawca.NIP || 'Brak',
            sellerName: sprzedawca.Nazwa || 'Brak',
            sellerAddress: faktura.Podmiot1?.Adres?.AdresL1 || 'Brak adresu',
            sellerBankAccount: bankAccount,
            ksefType: rodzajFaktury || 'VAT',
            netAmount: netAmountDecimal,
            vatAmount: vatAmountDecimal,
            grossAmount: grossAmountDecimal,
            currency: fa.KodWaluty || 'PLN',
            paymentStatus: (fa.Platnosc?.Zaplacono === 1 || new Date(fa.P_1).getTime() === dueDate.getTime()) ? 'PAID' : 'UNPAID',
            lineItems,
            rawXml,
        };
    }
}
