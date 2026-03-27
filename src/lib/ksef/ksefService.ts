import { XMLParser } from 'fast-xml-parser';
import prisma from '@/lib/prisma';
import Decimal from 'decimal.js';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';

const KSEF_BASE_URL = (process.env.KSEF_BASE_URL || 'https://api.ksef.mf.gov.pl/v2').replace(/\/$/, '');
const KSEF_TOKEN = process.env.KSEF_TOKEN;
const DEFAULT_NIP = '9542761368';

// In-memory cache for the MF Public Key
let cachedPublicKey: string | null = null;
let keyFetchTime: number = 0;
const KEY_CACHE_TTL = 1000 * 60 * 60; // 1 hour

/**
 * Fetch KSeF Public Key dynamically from MF API
 * @returns PEM string
 */
async function fetchKSeFPublicKey(): Promise<string> {
    const now = Date.now();
    if (cachedPublicKey && (now - keyFetchTime < KEY_CACHE_TTL)) {
        return cachedPublicKey;
    }

    console.log("[KSeF_SERVICE] Fetching dynamic public key from MF...");
    const url = `${KSEF_BASE_URL}/ksefPublicKey`;
    const res = await fetch(url);
    
    if (!res.ok) {
        throw new Error(`Failed to fetch KSeF public key from ${url}: ${res.status}`);
    }

    const data = await res.text();
    
    // Robust parsing: key might be raw PEM or wrapped in JSON
    let publicKey = data;
    try {
        const json = JSON.parse(data);
        publicKey = json.publicKey || json.key || data;
    } catch {
        // Not JSON, assume raw PEM
    }

    if (!publicKey.includes("BEGIN PUBLIC KEY")) {
        console.warn("[KSeF_SERVICE] Fetched key might be in invalid format, but proceeding...");
    }

    cachedPublicKey = publicKey;
    keyFetchTime = now;
    return publicKey;
}

// Helper: Encrypt token|timestamp with MF public key (RSA-OAEP, SHA-256)
async function encryptTokenWithTimestamp(token: string, timestamp: string): Promise<string> {
    const publicKey = await fetchKSeFPublicKey();
    const payload = `${token}|${timestamp}`;
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

export class KSeFService {
    private parser: XMLParser;

    constructor() {
        this.parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_"
        });
    }

    /**
     * Get Authorization Headers
     * Priority: sessionToken (v2.0) -> customToken (Bearer) -> env.KSEF_TOKEN (Bearer)
     */
    private getHeaders(contentType: string = "application/json", options?: { sessionToken?: string; customToken?: string }) {
        const headers: Record<string, string> = {
            "Content-Type": contentType,
            "Accept": contentType === "application/xml" ? "application/xml" : "application/json",
        };

        if (options?.sessionToken) {
            headers["SessionToken"] = options.sessionToken;
        } else {
            const token = options?.customToken || KSEF_TOKEN;
            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }
        }

        return headers;
    }

    /**
     * Step 1: KSeF v2.0 Session Handshake (Challenge -> Encrypted Token -> SessionToken)
     */
    async getSessionToken(nip?: string, token?: string): Promise<string> {
        const targetNip = nip || process.env.KSEF_NIP || DEFAULT_NIP;
        const targetToken = token || KSEF_TOKEN;

        if (!targetToken) throw new Error("KSEF_TOKEN missiong in environment.");

        console.log(`[KSeF_SERVICE] Initializing session (v2.0) for NIP: ${targetNip}...`);
        
        // 1. Get challenge (timestamp)
        const challengeRes = await fetch(`${KSEF_BASE_URL}/auth/challenge`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nip: targetNip }),
        });
        
        if (!challengeRes.ok) {
            const errorText = await challengeRes.text();
            throw new Error(`Challenge failed (${challengeRes.status}): ${errorText}`);
        }
        
        const { timestamp } = await challengeRes.json();
        if (!timestamp) throw new Error("No timestamp in challenge response");

        // 2. Encrypt token|timestamp using DYNAMIC key
        const encryptedToken = await encryptTokenWithTimestamp(targetToken, timestamp);

        // 3. Exchange for sessionToken
        const sessionRes = await fetch(`${KSEF_BASE_URL}/auth/ksef-token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nip: targetNip, encryptedToken }),
        });
        
        if (!sessionRes.ok) {
            const errorText = await sessionRes.text();
            throw new Error(`Session establishment failed (${sessionRes.status}): ${errorText}`);
        }
        
        const { sessionToken } = await sessionRes.json();
        if (!sessionToken) throw new Error("No sessionToken in response");
        
        console.log("[KSeF_SERVICE] v2.0 Session established.");
        return sessionToken;
    }

    /**
     * Step 2: Query for invoices metadata (Subject2 = Received Invoices)
     * @param options.dateFrom Start date (ISO)
     * @param options.dateTo End date (ISO)
     * @param options.pageSize Limit (Default 50)
     */
    async queryLatestInvoices(options?: { 
        sessionToken?: string; 
        testToken?: string;
        dateFrom?: string;
        dateTo?: string;
        pageSize?: number;
    }): Promise<any[]> {
        console.log("[KSeF_SERVICE] Querying invoices (limit 50)...");

        // Default to last 30 days if no dates provided
        const from = options?.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const to = options?.dateTo || new Date().toISOString();

        const queryRes = await fetch(`${KSEF_BASE_URL}/online/Query/Invoice/Sync`, {
            method: "POST",
            headers: this.getHeaders("application/json", { 
                sessionToken: options?.sessionToken, 
                customToken: options?.testToken 
            }),
            body: JSON.stringify({
                queryCriteria: {
                    subjectType: "Subject2", // Received (EXPENSE)
                    type: "All",
                    invoicingDateFrom: from,
                    invoicingDateTo: to
                },
                pageSize: options?.pageSize || 50,
                pageOffset: 0
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
     * Step 3: Fetch & Parse XML
     */
    async fetchAndParse(ksefNumber: string, options?: { sessionToken?: string; testToken?: string }): Promise<KsefParsedInvoice> {
        console.log(`[KSeF_SERVICE] Fetching detail XML for ${ksefNumber}...`);

        const res = await fetch(`${KSEF_BASE_URL}/online/Invoice/Get/${ksefNumber}`, {
            method: "GET",
            headers: this.getHeaders("application/xml", { 
                sessionToken: options?.sessionToken, 
                customToken: options?.testToken 
            })
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
            invoiceNumber: invoiceData.P_2 || "Unknown",
            issueDate: new Date(invoiceData.P_1),
            counterpartyNip: invoiceData.Podmiot2?.DaneIdentyfikacyjne?.NIP || "Brak",
            counterpartyName: invoiceData.Podmiot2?.DaneIdentyfikacyjne?.Nazwa || "Brak",
            netAmount: new Decimal(invoiceData.P_13_1 || 0),
            vatAmount: new Decimal(invoiceData.P_14_1 || 0),
            grossAmount: new Decimal(invoiceData.P_15 || 0),
            rawXml
        };
    }
}
