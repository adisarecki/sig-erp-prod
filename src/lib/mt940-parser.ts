import Decimal from "decimal.js";

/**
 * MT940 Transaction Object
 */
export interface MT940Transaction {
    reference: string;      // Tag :20:
    date: Date;           // Tag :61:
    amount: Decimal;      // Tag :61: (Positive for CR, cells for DR?)
    type: 'INCOME' | 'EXPENSE'; // CR -> INCOME, DR -> EXPENSE
    description: string;   // Tag :86:
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
            // Tag :20: Transaction Reference Number
            if (line.startsWith(':20:')) {
                currentRef = line.substring(4).trim();
                continue;
            }

            // Tag :61: Statement Line
            // Format: YYMMDD[MMDD]DC[Currency]AmountTransactionType[Reference]
            // Example: :61:2403240324CR1250,50N064NONREF
            if (line.startsWith(':61:')) {
                // If we have a pending transaction, push it (though :86: usually follows immediately)
                if (currentTransaction) {
                    transactions.push(currentTransaction as MT940Transaction);
                }

                const content = line.substring(4);
                const dateRaw = content.substring(0, 6); // YYMMDD
                const year = 2000 + parseInt(dateRaw.substring(0, 2));
                const month = parseInt(dateRaw.substring(2, 4)) - 1;
                const day = parseInt(dateRaw.substring(4, 6));
                const date = new Date(year, month, day);

                // Find DC (Debit/Credit)
                // It can be D, C, RC, RD
                const dcMatch = content.match(/[C|D|RC|RD]{1,2}/);
                const dc = dcMatch ? dcMatch[0] : 'C';
                const isCredit = dc.includes('C');

                // Extract Amount
                // After DC, before Transaction Type (usually N, F, S, etc.)
                // Example: 1250,50N
                const amountPart = content.substring(dcMatch ? content.indexOf(dc) + dc.length : 6);
                const amountMatch = amountPart.match(/(\d+,\d{2})/);
                const amountStr = amountMatch ? amountMatch[1].replace(',', '.') : '0';
                const amount = new Decimal(amountStr);

                currentTransaction = {
                    reference: currentRef,
                    date: date,
                    amount: amount,
                    type: isCredit ? 'INCOME' : 'EXPENSE',
                    bankReference: content.substring(content.length - 16).trim(), // Placeholder for bank-specific ref
                    description: ""
                };
                continue;
            }

            // Tag :86: Information to Account Owner (Description)
            if (line.startsWith(':86:') && currentTransaction) {
                currentTransaction.description = line.substring(4).trim();
                // Check if next lines are also part of :86: (some formats use multiline without tags)
                continue;
            }
            
            // Multiline description support (often lines after :86: that don't start with :)
            if (currentTransaction && line && !line.startsWith(':')) {
                currentTransaction.description += " " + line.trim();
            }
        }

        // Push last one
        if (currentTransaction) {
            transactions.push(currentTransaction as MT940Transaction);
        }

        return transactions;
    }
}
