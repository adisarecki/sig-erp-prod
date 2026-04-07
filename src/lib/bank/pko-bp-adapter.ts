import Decimal from "decimal.js";

export interface PkoBpTransaction {
    date: Date;
    amount: Decimal;
    rawType: string;
    counterpartyName: string;
    title: string;
    balanceAfter: Decimal;
}

export class PkoBpCsvAdapter {
    /**
     * Vector 104/106 Mapping Protocol:
     * Delimiter: , | Encoding: utf-8
     * Col 0 -> Date
     * Col 3 -> Amount
     * Col 5 -> rawType (Typ operacji)
     * Col 6 -> Counterparty (Unnamed: 6)
     * Col 8 -> Title (Unnamed: 8)
     * Col 9 -> BalanceAfter (Saldo po operacji)
     */
    static parse(csvContent: string): PkoBpTransaction[] {
        const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
        
        let startIndex = 0;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('Data operacji') || (lines[i].includes('Kwota') && lines[i].includes('Tytuł'))) {
                startIndex = i + 1;
                break;
            }
        }

        const dataLines = lines.slice(startIndex);
        
        return dataLines.map(line => {
            const columns = this.splitCsvLine(line);
            
            const dateStr = columns[0] || "";
            const amountRaw = columns[3] || "0";
            const balanceRaw = columns[9] || "0";
            
            const rawType = columns[5] || "PRZELEW";
            const counterpartyName = columns[6] || "Nieznany";
            const title = columns[8] || "";

            // Vector 120.3: Hardened Numeric Extraction
            const amountStr = this.extractNumericPart(amountRaw);
            const balanceAfterStr = this.extractNumericPart(balanceRaw);

            return {
                date: new Date(dateStr),
                amount: new Decimal(amountStr),
                rawType: rawType.trim(),
                counterpartyName: counterpartyName.trim(),
                title: title.trim(),
                balanceAfter: new Decimal(balanceAfterStr)
            };
        }).filter(tx => !tx.amount.isZero() && !isNaN(tx.date.getTime()));
    }

    /**
     * Extracts only the numeric part of a string (e.g. "Kwota: -1 234,56" -> "-1234.56")
     */
    private static extractNumericPart(val: string): string {
        if (!val) return "0";
        
        // 1. Replace comma with dot and remove plus sign
        let cleaned = val.replace(',', '.').replace('+', '');
        
        // 2. Remove all spaces (even non-breaking ones often found in bank statements)
        cleaned = cleaned.replace(/\s/g, '');
        
        // 3. Extract the first sequence that looks like a number (including negative sign)
        // This handles "Kwota Cash Back: 0.00" by picking just "0.00"
        const match = cleaned.match(/-?\d+(\.\d+)?/);
        return match ? match[0] : "0";
    }

    private static splitCsvLine(line: string): string[] {
        const results = [];
        let current = "";
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                results.push(current.trim().replace(/^"|"$/g, ''));
                current = "";
            } else {
                current += char;
            }
        }
        results.push(current.trim().replace(/^"|"$/g, ''));
        return results;
    }
}

