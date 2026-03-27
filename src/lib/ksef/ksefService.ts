import { XMLParser } from 'fast-xml-parser';
import Decimal from 'decimal.js';
import crypto from 'crypto';

// Base URL: https://api.ksef.mf.gov.pl/api
// All KSeF v2 paths are prepended with /v2
const KSEF_BASE_URL = (process.env.KSEF_BASE_URL || 'https://api.ksef.mf.gov.pl/api').replace(/\/$/, '');
const KSEF_TOKEN = process.env.KSEF_TOKEN;
const DEFAULT_NIP = '9542751368';

// In-memory cache for the MF Public Key
let cachedPublicKey: crypto.KeyObject | null = null;
let keyFetchTime: number = 0;
const KEY_CACHE_TTL = 1000 * 60 * 60; // 1 hour

/**
 * Fetch KSeF Public Key dynamically from MF API.
 * Endpoint: GET /api/v2/security/public-key-certificates
 * Returns array: [{ certificate: base64DER, usage: ["AsymmetricKeyEncryption"] }]
 */
async function fetchKSeFPublicKey(): Promise<crypto.KeyObject> {
    const now = Date.now();
    if (cachedPublicKey && (now - keyFetchTime < KEY_CACHE_TTL)) {
        return cachedPublicKey;
    }

    const url = `${KSEF_BASE_URL}/v2/security/public-key-certificates`;
    console.log(`[KSeF_SERVICE] Fetching dynamic public key from: ${url}`);

    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch KSeF public key (${res.status}): ${await res.text()}`);
    }

    const certs: Array<{ certificate: string; usage: string[] }> = await res.json();

    // Find the cert used for asymmetric key encryption
    const encCert = certs.find(c =>
        c.usage.some(u => u.toLowerCase().includes('asymmetric') || u.toLowerCase().includes('encryption'))
    ) || certs[0];

    if (!encCert?.certificate) {
        throw new Error('No valid encryption certificate found in KSeF response');
    }

    // Certificate is DER encoded in Base64 – convert to KeyObject
    const derBuffer = Buffer.from(encCert.certificate, 'base64');
    const keyObject = crypto.createPublicKey({ key: derBuffer, format: 'der', type: 'spki' });

    cachedPublicKey = keyObject;
    keyFetchTime = now;
    console.log('[KSeF_SERVICE] Dynamic public key fetched and cached.');
    return keyObject;
}

/**
 * Encrypt `token|timestampMs` with the MF public key (RSA-OAEP, SHA-256).
 * timestampMs is the Unix timestamp in milliseconds from the challenge response.
 */
async function encryptToken(token: string, timestampMs: number): Promise<string> {
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
    rawXml: string;
}

// ─── Service ───────────────────────────────────────────────────────────────────

export class KSeFService {
    private parser: XMLParser;

    constructor() {
        this.parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_'
        });
    }

    /**
     * Get Authorization Headers
     * Priority: sessionToken (v2.0) -> customToken (Bearer) -> env.KSEF_TOKEN (Bearer)
     */
    private getHeaders(contentType: string = 'application/json', options?: { sessionToken?: string; customToken?: string }) {
        const headers: Record<string, string> = {
            'Content-Type': contentType,
            'Accept': contentType === 'application/xml' ? 'application/xml' : 'application/json',
        };

        if (options?.sessionToken) {
            headers['SessionToken'] = options.sessionToken;
        } else {
            const token = options?.customToken || KSEF_TOKEN;
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        return headers;
    }

    /**
     * KSeF v2.0 Session Handshake
     *
     * Flow:
     *   1. POST /v2/auth/challenge  →  { challenge, timestamp, timestampMs }
     *   2. Encrypt `token|timestampMs` with MF public key (RSA-OAEP SHA-256)
     *   3. POST /v2/auth/ksef-token { challenge, encryptedToken }  →  { sessionToken }
     */
    async getSessionToken(nip?: string, token?: string): Promise<string> {
        const targetNip = nip || process.env.KSEF_NIP || DEFAULT_NIP;
        const targetToken = token || KSEF_TOKEN;

        if (!targetToken) throw new Error('KSEF_TOKEN missing in environment.');

        console.log(`[KSeF_SERVICE] Initializing session (v2.0) for NIP: ${targetNip}...`);

        // ── Step 1: Challenge ────────────────────────────────
        const challengeUrl = `${KSEF_BASE_URL}/v2/auth/challenge`;
        const challengeRes = await fetch(challengeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nip: targetNip }),
        });

        if (!challengeRes.ok) {
            const errorText = await challengeRes.text();
            throw new Error(`Challenge failed (${challengeRes.status}): ${errorText}`);
        }

        const challengeData = await challengeRes.json();
        const { challenge, timestampMs } = challengeData;

        if (!challenge) throw new Error('No challenge in response');
        if (!timestampMs) throw new Error('No timestampMs in challenge response');

        console.log(`[KSeF_SERVICE] Challenge OK: ${challenge}`);

        // ── Step 2: Encrypt token|timestampMs ───────────────
        const encryptedToken = await encryptToken(targetToken, timestampMs);
        console.log('[KSeF_SERVICE] Token encrypted OK.');

        // ── Step 3: Exchange for sessionToken ───────────────
        const tokenUrl = `${KSEF_BASE_URL}/v2/auth/ksef-token`;
        const sessionRes = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ challenge, encryptedToken }),
        });

        if (!sessionRes.ok) {
            const errorText = await sessionRes.text();
            throw new Error(`Session establishment failed (${sessionRes.status}): ${errorText}`);
        }

        const sessionData = await sessionRes.json();
        const sessionToken = sessionData.sessionToken || sessionData.token;
        if (!sessionToken) throw new Error(`No sessionToken in response: ${JSON.stringify(sessionData)}`);

        console.log('[KSeF_SERVICE] v2.0 Session established.');
        return sessionToken;
    }

    /**
     * Query for received invoices (Subject2 = EXPENSE)
     * @param options.dateFrom  ISO date string
     * @param options.dateTo    ISO date string
     * @param options.pageSize  Max 50 (KSeF native limit)
     */
    async queryLatestInvoices(options?: {
        sessionToken?: string;
        testToken?: string;
        dateFrom?: string;
        dateTo?: string;
        pageSize?: number;
    }): Promise<any[]> {
        console.log('[KSeF_SERVICE] Querying invoices (limit 50)...');

        const from = options?.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const to = options?.dateTo || new Date().toISOString();

        const queryRes = await fetch(`${KSEF_BASE_URL}/v2/online/Query/Invoice/Sync`, {
            method: 'POST',
            headers: this.getHeaders('application/json', {
                sessionToken: options?.sessionToken,
                customToken: options?.testToken,
            }),
            body: JSON.stringify({
                queryCriteria: {
                    subjectType: 'Subject2', // Received (EXPENSE)
                    type: 'All',
                    invoicingDateFrom: from,
                    invoicingDateTo: to,
                },
                pageSize: options?.pageSize || 50,
                pageOffset: 0,
            }),
        });

        if (!queryRes.ok) {
            const errorDetails = await queryRes.text();
            throw new Error(`KSeF Query Failed (${queryRes.status}): ${errorDetails}`);
        }

        const data = await queryRes.json();
        return data.invoiceList || [];
    }

    /**
     * Fetch & Parse XML for a given KSeF reference number
     */
    async fetchAndParse(ksefNumber: string, options?: { sessionToken?: string; testToken?: string }): Promise<KsefParsedInvoice> {
        console.log(`[KSeF_SERVICE] Fetching detail XML for ${ksefNumber}...`);

        const res = await fetch(`${KSEF_BASE_URL}/v2/online/Invoice/Get/${ksefNumber}`, {
            method: 'GET',
            headers: this.getHeaders('application/xml', {
                sessionToken: options?.sessionToken,
                customToken: options?.testToken,
            }),
        });

        if (!res.ok) {
            const errorDetails = await res.text();
            throw new Error(`KSeF Fetch Failed (${res.status}): ${errorDetails}`);
        }

        const rawXml = await res.text();
        const jsonObj = this.parser.parse(rawXml);

        const invoiceData = jsonObj.Faktura?.Fa || jsonObj.Fa || {};

        return {
            ksefNumber,
            invoiceNumber: invoiceData.P_2 || 'Unknown',
            issueDate: new Date(invoiceData.P_1),
            counterpartyNip: invoiceData.Podmiot2?.DaneIdentyfikacyjne?.NIP || 'Brak',
            counterpartyName: invoiceData.Podmiot2?.DaneIdentyfikacyjne?.Nazwa || 'Brak',
            netAmount: new Decimal(invoiceData.P_13_1 || 0),
            vatAmount: new Decimal(invoiceData.P_14_1 || 0),
            grossAmount: new Decimal(invoiceData.P_15 || 0),
            rawXml,
        };
    }
}
