import { XMLParser } from 'fast-xml-parser';
import prisma from '@/lib/prisma';
import Decimal from 'decimal.js';

const KSEF_BASE_URL = (process.env.KSEF_BASE_URL || 'https://api-test.ksef.mf.gov.pl/api').replace(/\/$/, '');
const KSEF_TOKEN = process.env.KSEF_TOKEN;

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
     * Get Authorization Headers (Direct Bearer Token)
     * @param customToken Optional token to override the .env value for testing/verification
     */
    private getHeaders(contentType: string = 'application/json', customToken?: string) {
        const token = customToken || KSEF_TOKEN;
        if (!token) throw new Error("KSEF_TOKEN is missing in .env and no test token provided");
        
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': contentType,
            'Accept': 'application/json'
        };
    }

    /**
     * Step 2: Query for invoices metadata (Directly using Token)
     * POST /online/Query/Invoice/Sync
     * @param options.testToken Optional token for diagnostic simulation
     */
    async queryLatestInvoices(options?: { testToken?: string }): Promise<any[]> {
        console.log("[KSeF_SERVICE] Querying latest invoices...");

        const queryRes = await fetch(`${KSEF_BASE_URL}/online/Query/Invoice/Sync`, {
            method: 'POST',
            headers: this.getHeaders('application/json', options?.testToken),
            body: JSON.stringify({
                queryCriteria: {
                    subjectType: "Subject2", // Received (EXPENSE)
                    type: "All"
                }
            })
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
     * GET /online/Invoice/Get/{ksefNumber}
     * @param options.testToken Optional token for diagnostic simulation
     */
    async fetchAndParse(ksefNumber: string, options?: { testToken?: string }): Promise<KsefParsedInvoice> {
        console.log(`[KSeF_SERVICE] Fetching invoice ${ksefNumber}...`);

        const res = await fetch(`${KSEF_BASE_URL}/online/Invoice/Get/${ksefNumber}`, {
            method: 'GET',
            headers: {
                ...this.getHeaders('application/xml', options?.testToken),
                'Accept': 'application/xml'
            }
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
