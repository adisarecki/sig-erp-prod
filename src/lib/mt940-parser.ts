import Decimal from "decimal.js";

/**
 * MT940 Transaction Object
 */
export interface MT940Transaction {
    reference: string;      // Tag :20:
    date: Date;           // Tag :61:
    amount: Decimal;      // Tag :61: (Positive for CR, negative for DR handled in route)
    type: 'INCOME' | 'EXPENSE'; // CR -> INCOME, DR -> EXPENSE
    description: string;   // Full sanitized string
    title: string;         // Extracted ~20 (Title)
    counterparty: string;  // Extracted ~32/22 (Contractor)
    bankReference: string; // Internal ref from :61:
}

/**
 * MT940Parser - SWIFT MT940 Standard Parser
 * Handles tags :20: (Ref), :61: (Statement Line), :86: (Description)
 */
export class MT940Parser {
    static parse(rawContent: string): MT940Transaction[] {
        const transactions: MT940Transaction[] = [];
        const lines = rawContent.split(/\r?\n/);
        
        let currentRef = "NONREF";
        let currentTransaction: Partial<MT940Transaction> | null = null;

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            // Tag :20: Transaction Reference Number
            if (trimmedLine.startsWith(':20:')) {
                currentRef = trimmedLine.substring(4).trim();
                continue;
            }

            // Tag :61: Statement Line
            // Format: YYMMDD[MMDD]DC[Currency]AmountTransactionType[Reference]
            // Example: :61:2403240324CR1250,50N064NONREF
            if (trimmedLine.startsWith(':61:')) {
                // If we have a pending transaction, push it
                if (currentTransaction) {
                    transactions.push(currentTransaction as MT940Transaction);
                }

                const content = trimmedLine.substring(4);
                const dateRaw = content.substring(0, 6); // YYMMDD
                const year = 2000 + parseInt(dateRaw.substring(0, 2));
                const month = parseInt(dateRaw.substring(2, 4)) - 1;
                const day = parseInt(dateRaw.substring(4, 6));
                const date = new Date(year, month, day);

                // Find DC (Debit/Credit) - strictly C or D in standard, but RC/RD allowed
                const dcMatch = content.match(/[C|D|RC|RD]{1,2}/);
                const dc = dcMatch ? dcMatch[0] : 'C';
                const isCredit = dc.includes('C');

                // Extract Amount
                // The amount starts after DC. It ends at the first non-numeric/comma char after digits.
                const afterDc = content.substring(dcMatch ? content.indexOf(dc) + dc.length : 6);
                const amountMatch = afterDc.match(/^(\d+,\d{2})/);
                const amountStr = amountMatch ? amountMatch[1].replace(',', '.') : '0';
                const amount = new Decimal(amountStr);

                currentTransaction = {
                    reference: currentRef,
                    date: date,
                    amount: amount,
                    type: isCredit ? 'INCOME' : 'EXPENSE',
                    bankReference: content.substring(content.length - 16).trim(), 
                    description: "",
                    title: "",
                    counterparty: ""
                };
                continue;
            }

            // Tag :86: Information to Account Owner (Description)
            if (trimmedLine.startsWith(':86:') && currentTransaction) {
                currentTransaction.description = trimmedLine.substring(4).trim();
                continue;
            }
            
            // Multiline description support
            if (currentTransaction && trimmedLine && !trimmedLine.startsWith(':')) {
                currentTransaction.description += (currentTransaction.description ? " " : "") + trimmedLine;
            }
        }

        // Push last one
        if (currentTransaction) {
            transactions.push(currentTransaction as MT940Transaction);
        }

        // Clean up and optimize descriptions (e.g., PKO BP ~ tags)
        return transactions.map(t => {
            const { title, counterparty, fullClean } = MT940Parser.cleanDescription(t.description);
            return {
                ...t,
                title,
                counterparty,
                description: fullClean
            };
        });
    }

    /**
     * Specialized PKO BP / SWIFT cleaner for tag :86:
     */
    private static cleanDescription(rawDesc: string): { title: string, counterparty: string, fullClean: string } {
        // Strip common SWIFT operational metadata
        let cleaned = rawDesc
            .replace(/\/(TRF|KONTO|REF|CDPT|FEE|COMM|NP|TAX)\//g, ' ')
            .replace(/NONREF\/\/\w+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (!cleaned.includes('~')) {
            return { title: cleaned, counterparty: "", fullClean: cleaned };
        }

        // PKO BP uses ~ as internal tag separator
        const parts = cleaned.split('~');
        let title = "";
        let counterparty = "";

        for (const p of parts) {
            if (p.startsWith('20')) {
                const val = p.substring(2).trim();
                // Remove redundant timestamps/IDs if present (often at start of ~20)
                const sanitizedVal = val.replace(/^\d{10,}\s?/, '').trim();
                if (sanitizedVal && sanitizedVal !== '˙') title = sanitizedVal;
            } else if (p.startsWith('32') || p.startsWith('33')) {
                const val = p.substring(2).trim();
                if (val && val !== '˙') counterparty = val;
            } else if (p.startsWith('22')) {
                if (!counterparty) {
                    const val = p.substring(2).trim();
                    if (val && val !== '˙') counterparty = val;
                }
            }
        }

        // Final cleanup for title if it's still containing pure IDs
        if (title.match(/^\d+$/)) title = "";

        const fullClean = [title, counterparty].filter(Boolean).join(' | ');
        return { 
            title: title || "Transakcja Bankowa", 
            counterparty: counterparty || "Nieznany", 
            fullClean 
        };
    }
}
