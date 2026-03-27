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
            if (!res.ok) {
                throw new Error(`Failed to fetch KSeF public key (${res.status}): ${await res.text()}`);
            }

            const certs: Array<{ certificate: string; usage: string[] }> = await res.json();
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
     * Post-handshake authorized requests in v2.0 use SessionToken header
     */
    private async getHeaders(contentType: string = 'application/json', options?: { sessionToken?: string; customToken?: string }) {
        const headers: Record<string, string> = {
            'Content-Type': contentType,
            'Accept': contentType === 'application/xml' ? 'application/xml' : 'application/json',
        };

        const token = options?.sessionToken || options?.customToken || await this.getAccessToken();
        headers['SessionToken'] = token;

        return headers;
    }

    /**
     * KSeF v2.0 4-Step Handshake (Unified)
     * 1. POST /v2/auth/challenge
     * 2. Key Fetch & RSA-OAEP Encryption
     * 3. POST /v2/auth/ksef-token (Init)
     * 4. POST /v2/auth/token/redeem (Final)
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

        console.log(`[KSeF_SERVICE] Starting v2.0 4-step Handshake for NIP: ${targetNip}...`);

        // ── KROK 1: Wyzwanie (Challenge) ─────────────────────
        const challengeUrl = `${KSEF_BASE_URL}/v2/auth/challenge`;
        const challengeRes = await fetch(challengeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nip: targetNip }),
        });

        if (!challengeRes.ok) {
            throw new Error(`Step 1 Challenge failed (${challengeRes.status}): ${await challengeRes.text()}`);
        }

        const { challenge, timestampMs } = await challengeRes.json();
        if (!challenge || !timestampMs) throw new Error('Invalid Challenge response');
        console.log('[KSeF_SERVICE] Step 1 OK: Challenge verified.');

        // ── KROK 2: Klucz i Szyfrowanie (Handled by helpers) ──────
        const encryptedToken = await encryptKSeFToken(targetToken, timestampMs);
        console.log('[KSeF_SERVICE] Step 2 OK: Token encrypted (RSA-OAEP SHA-256).');

        // ── KROK 3: Inicjalizacja Tokena ──────────────────────
        const initUrl = `${KSEF_BASE_URL}/v2/auth/ksef-token`;
        const initRes = await fetch(initUrl, {
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

        if (!initRes.ok && initRes.status !== 202) {
            throw new Error(`Step 3 Initialization failed (${initRes.status}): ${await initRes.text()}`);
        }

        const initData = await initRes.json();
        const authenticationToken = initData.authenticationToken?.token;
        if (!authenticationToken) throw new Error('No authenticationToken in Step 3 response');
        console.log('[KSeF_SERVICE] Step 3 OK: KSeF-Token initialized (202 Accepted).');

        // ── KROK 4: Pobranie Access Tokena (Redeem) ──────────
        const redeemUrl = `${KSEF_BASE_URL}/v2/auth/token/redeem`;
        const redeemRes = await fetch(redeemUrl, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authenticationToken}`
            }
        });

        if (!redeemRes.ok) {
            throw new Error(`Step 4 Redeem failed (${redeemRes.status}): ${await redeemRes.text()}`);
        }

        const redeemData = await redeemRes.json();
        const accessToken = redeemData.accessToken?.token;
        if (!accessToken) throw new Error('No accessToken in Step 4 response');

        // 5. Update Cache
        cachedAccessToken = accessToken;
        tokenFetchTime = Date.now();

        console.log('[KSeF_SERVICE] Step 4 OK: Handshake v2.0 Complete. Access Token Redeemed.');
        return accessToken;
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
        sessionToken?: string;
        testToken?: string;
        dateFrom?: string;
        dateTo?: string;
        pageSize?: number;
    }): Promise<any[]> {
        console.log('[KSeF_SERVICE] Step 5: Fetching invoice metadata (Sync Incremental)...');

        const from = options?.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const to = options?.dateTo || new Date().toISOString();

        const headers = await this.getHeaders('application/json', {
            sessionToken: options?.sessionToken,
            customToken: options?.testToken,
        });

        const url = `${KSEF_BASE_URL}/v2/online/Query/Invoice/Sync`;
        console.log(`[KSeF_SERVICE] POST ${url}...`);

        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                queryCriteria: {
                    subjectType: 'subject2', // Buyer (EXPENSE)
                    type: 'incremental',
                    acquisitionTimestampThresholdFrom: from,
                    acquisitionTimestampThresholdTo: to,
                },
                pageSize: options?.pageSize || 50,
                pageOffset: 0,
            }),
        });

        // Refined Error Handling: 
        // If we explicitly passed a sessionToken (e.g. for testing valid/invalid sessions),
        // we should NOT mask errors as empty results.
        if (res.status === 404 && !options?.sessionToken) {
            console.warn(`[KSeF_SERVICE] Step 5: Received 404 from Sync Query. (Possible no new data). returning []`);
            return [];
        }

        if (!res.ok) {
            const errorDetails = await res.text();
            throw new Error(`KSeF Step 5 Sync Query Failed (${res.status}): ${errorDetails}`);
        }

        const data = await res.json();
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
    async fetchAndParse(ksefNumber: string, options?: { sessionToken?: string; testToken?: string }): Promise<KsefParsedInvoice> {
        console.log(`[KSeF_SERVICE] Step 6: Fetching detail XML for ${ksefNumber}...`);

        const headers = await this.getHeaders('application/xml', {
            sessionToken: options?.sessionToken,
            customToken: options?.testToken,
        });

        const res = await fetch(`${KSEF_BASE_URL}/v2/online/Invoice/Get/${ksefNumber}`, {
            method: 'GET',
            headers,
        });

        if (!res.ok) {
            const errorDetails = await res.text();
            throw new Error(`KSeF Fetch Failed (${res.status}): ${errorDetails}`);
        }

        const rawXml = await res.text();
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

        return {
            ksefNumber,
            invoiceNumber: fa.P_2 || 'Unknown',
            issueDate: new Date(fa.P_1),
            counterpartyNip: nabywca?.NIP || 'Brak',
            counterpartyName: nabywca?.Nazwa || 'Brak',
            sellerNip: sprzedawca.NIP || 'Brak',
            sellerName: sprzedawca.Nazwa || 'Brak',
            sellerAddress: faktura.Podmiot1?.Adres?.AdresL1 || 'Brak adresu',
            netAmount: netAmountDecimal,
            vatAmount: vatAmountDecimal,
            grossAmount: grossAmountDecimal,
            currency: fa.KodWaluty || 'PLN',
            paymentStatus: fa.Platnosc?.Zaplacono === 1 ? 'PAID' : 'UNPAID',
            lineItems,
            rawXml,
        };
    }
}
