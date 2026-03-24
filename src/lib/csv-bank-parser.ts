import Decimal from "decimal.js";

export interface CSVTransaction {
    transactionDate: string;
    amount: number;
    type: 'INCOME' | 'EXPENSE';
    counterpartyRaw: string;
    title: string;
    description: string;
    typeDescription: string; // Column 2 in PKO BP
    reference: string;
}

export class CSVBankParser {
    /**
     * Parses PKO BP CSV format
     * Column 0: Data operacji
     * Column 2: Typ transakcji (e.g. Przelew do ZUS)
     * Column 3: Kwota
     * Column 5: Opis transakcji
     * Column 6: Dane kontrahenta / Lokalizacja
     * Column 7: Tytuł
     */
    static parse(csvContent: string): CSVTransaction[] {
        const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
        
        // Find the header or skip standard PKO metadata
        let startIndex = 0;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('Data operacji') || lines[i].includes('Kwota')) {
                startIndex = i + 1;
                break;
            }
        }

        const dataLines = lines.slice(startIndex);

        return dataLines.map((line, index) => {
            const columns = this.splitCsvLine(line);
            
            const rawDate = columns[0];
            const typeDescription = columns[2] || "";
            const rawAmount = columns[3] ? columns[3].replace(',', '.') : '0';
            const amountVal = new Decimal(rawAmount);
            
            const rawDescription = columns[5] || "";
            const rawCounterparty = columns[6] || "";
            const rawTitle = columns[7] || "";

            const sanitization = this.sanitize(rawCounterparty, rawTitle);

            return {
                transactionDate: rawDate,
                amount: amountVal.toNumber(),
                type: amountVal.isNegative() ? 'EXPENSE' : 'INCOME',
                counterpartyRaw: sanitization.counterparty,
                title: sanitization.title,
                description: rawDescription,
                typeDescription: typeDescription,
                reference: `PKO-CSV-${index}-${rawDate}-${Math.abs(amountVal.toNumber())}`
            };
        });
    }

    private static splitCsvLine(line: string): string[] {
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
        // Advanced stripping of PKO BP prefixes
        let cleanCounterparty = counterparty
            .replace(/^Płatność kartą:?\s*/i, '')
            .replace(/^Lokalizacja:?\s*/i, '')
            .replace(/^Adres:?\s*/i, '')
            .replace(/^Nazwa odbiorcy:?\s*/i, '')
            .replace(/^Nazwa zleceniodawcy:?\s*/i, '')
            .replace(/^Odbiorca:?\s*/i, '')
            .trim();

        let cleanTitle = title
            .replace(/^Tytuł:?\s*/i, '')
            .replace(/^Tytu\u0142:?\s*/i, '') // Handle encoding if title has Polish L
            .trim();

        // Vendor extraction for management costs / terminal payments
        const keywords = ['ZABKA', 'ORLEN', 'CIRCLE K', 'STOKROTKA', 'BIEDRONKA', 'SHELL', 'LIDL', 'BP', 'MOYA', 'AUCHAN', 'CARREFOUR'];
        const upperCounterparty = cleanCounterparty.toUpperCase();
        
        for (const kw of keywords) {
            if (upperCounterparty.includes(kw)) {
                cleanCounterparty = kw;
                break;
            }
        }

        return {
            counterparty: cleanCounterparty || "Nieznany",
            title: cleanTitle || "Transakcja Bankowa"
        };
    }
}
