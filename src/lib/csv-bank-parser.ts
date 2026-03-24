import Decimal from "decimal.js";

export interface CSVTransaction {
    transactionDate: string;
    amount: number;
    type: 'INCOME' | 'EXPENSE';
    counterpartyRaw: string;
    title: string;
    reference: string;
}

export class CSVBankParser {
    /**
     * Parses PKO BP CSV format
     * Column 0: Data operacji
     * Column 3: Kwota
     * Column 6: Dane kontrahenta / Lokalizacja
     * Column 7: Tytuł
     */
    static parse(csvContent: string): CSVTransaction[] {
        const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
        // Skip header if it starts with "Data operacji"
        if (lines[0]?.includes('Data operacji')) {
            lines.shift();
        }

        return lines.map((line, index) => {
            // PKO BP often uses semicolon and quotes
            const columns = this.splitCsvLine(line);
            
            const rawDate = columns[0];
            const rawAmount = columns[3] ? columns[3].replace(',', '.') : '0';
            const amountVal = new Decimal(rawAmount);
            
            const rawCounterparty = columns[6] || "";
            const rawTitle = columns[7] || "";

            const sanitization = this.sanitize(rawCounterparty, rawTitle);

            return {
                transactionDate: rawDate,
                amount: amountVal.toNumber(),
                type: amountVal.isNegative() ? 'EXPENSE' : 'INCOME',
                counterpartyRaw: sanitization.counterparty,
                title: sanitization.title,
                reference: `CSV-REF-${index}-${rawDate}`
            };
        });
    }

    private static splitCsvLine(line: string): string[] {
        // Simple regex-based CSV splitter that handles quotes and semicolons
        const results = [];
        let current = "";
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ';' && !inQuotes) {
                results.push(current.trim().replace(/^"|"$/g, ''));
                current = "";
            } else {
                current += char;
            }
        }
        results.push(current.trim().replace(/^"|"$/g, ''));
        return results;
    }

    private static sanitize(counterparty: string, title: string): { counterparty: string, title: string } {
        let cleanCounterparty = counterparty
            .replace(/^Płatność kartą:?\s*/i, '')
            .replace(/^Lokalizacja:?\s*/i, '')
            .replace(/^Adres:?\s*/i, '')
            .replace(/^Nazwa odbiorcy:?\s*/i, '')
            .replace(/^Nazwa zleceniodawcy:?\s*/i, '')
            .trim();

        let cleanTitle = title
            .replace(/^Tytuł:?\s*/i, '')
            .trim();

        // Specific PKO BP Card patterns often contain redundant data after location
        // Example: "ZABKA Z1234 WARSZAWA PL" -> "ZABKA"
        if (counterparty.toLowerCase().includes('płatność kartą')) {
            const keywords = ['ZABKA', 'ORLEN', 'CIRCLE K', 'STOKROTKA', 'BIEDRONKA', 'SHELL', 'LIDL', 'BP'];
            for (const kw of keywords) {
                if (cleanCounterparty.toUpperCase().includes(kw)) {
                    cleanCounterparty = kw;
                    break;
                }
            }
        }

        return {
            counterparty: cleanCounterparty || "Nieznany",
            title: cleanTitle || "Transakcja Bankowa"
        };
    }
}
