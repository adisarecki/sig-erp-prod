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
            const amountStr = columns[3] ? columns[3].replace(',', '.').replace('+', '') : "0";
            const rawType = columns[5] || "PRZELEW";
            const counterpartyName = columns[6] || "Nieznany";
            const title = columns[8] || "";
            const balanceAfterStr = columns[9] ? columns[9].replace(',', '.').replace('+', '') : "0";

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
