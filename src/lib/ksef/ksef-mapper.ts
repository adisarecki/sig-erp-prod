import { XMLParser } from 'fast-xml-parser';
import { Decimal } from 'decimal.js';

const OWNER_NIP = '9542751368';

export interface KSeFInvoiceData {
    ksefNumber: string;
    issueDate: Date;
    dueDate: Date;
    sellerNip: string;
    sellerName: string;
    buyerNip: string;
    buyerName: string;
    amountNet: Decimal;
    amountGross: Decimal;
    taxRate: Decimal;
    type: 'INCOME' | 'EXPENSE';
    externalId: string; // Invoice number (P_2)
}

export class KSeFMapper {
    private parser: XMLParser;

    constructor() {
        this.parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_"
        });
    }

    /**
     * Parse raw XML FA(3) to KSeFInvoiceData
     */
    parseXml(xml: string, ksefNumber: string): KSeFInvoiceData {
        const jsonObj = this.parser.parse(xml);
        
        // Root is usually Faktura or KSeF:Faktura
        const root = jsonObj.Faktura || jsonObj['KSeF:Faktura'] || jsonObj;
        const main = root.Naglowek || {};
        const fa = root.Fa || {};
        
        // SPRZEDAWCA (P_4B)
        const sellerNip = fa.P_4B ? String(fa.P_4B).replace(/\D/g, '') : '';
        const sellerName = fa.P_3A || fa.P_3B || 'Nieznany Sprzedawca';

        // NABYWCA (P_5B)
        const buyerNip = fa.P_5B ? String(fa.P_5B).replace(/\D/g, '') : '';
        const buyerName = fa.P_3C || fa.P_3D || 'Nieznany Nabywca';

        // DATY
        const issueDate = fa.P_1 ? new Date(fa.P_1) : new Date();
        
        // Due date (Termin płatności) might be in P_15 or supplementary nodes
        // Standard FA(3) often doesn't have a specific tag for due date, 
        // it's usually in descriptive fields or TerminyPlatnosci
        let dueDate = issueDate;
        if (fa.TerminPlatnosci) {
             dueDate = new Date(fa.TerminPlatnosci);
        } else if (fa.P_15) {
            // Some vendors put due date in P_15 if it's a fixed value
            // But usually P_15 is Gross amount in FA(1/2). In FA(3) it's different.
        }

        // KWOTY
        const amountGross = new Decimal(fa.P_15 || 0);
        const amountNet = new Decimal(fa.P_13_1 || 0); // Sum of Net at 23/22% etc.
        const taxRate = amountNet.gt(0) ? amountGross.minus(amountNet).dividedBy(amountNet) : new Decimal(0);

        const type = sellerNip === OWNER_NIP ? 'INCOME' : 'EXPENSE';
        const invoiceNumber = fa.P_2 || ksefNumber;

        return {
            ksefNumber,
            issueDate,
            dueDate,
            sellerNip,
            sellerName,
            buyerNip,
            buyerName,
            amountNet,
            amountGross,
            taxRate: taxRate.toDecimalPlaces(4),
            type,
            externalId: invoiceNumber
        };
    }

    /**
     * Map KSeF search result item to a summary
     */
    mapSearchResult(item: any): any {
        return {
            ksefNumber: item.ksefReferenceNumber,
            issueDate: item.invoicingDate,
            sellerNip: item.sellerIdentifier?.identifier,
            buyerNip: item.buyerIdentifier?.identifier,
            grossAmount: item.grossAmount,
            status: 'UNVERIFIED'
        };
    }
}
