import Decimal from "decimal.js";

export interface CSVTransaction {
    transactionDate: string;
    amount: number;
    type: 'INCOME' | 'EXPENSE';
    counterpartyRaw: string;
    title: string;
    description: string;
    typeDescription: string;
    reference: string;
}

export class CSVBankParser {
    /**
     * Normalizes common PKO BP encoding artifacts (CP1250/UTF-8 garble)
     */
    private static normalizeEncoding(text: string): string {
        return text
            .replace(/│/g, 'ł')
            .replace(/╣/g, 'ą')
            .replace(/ťŠ/g, 'ść')
            .replace(/╩î/g, 'ę')
            .replace(/ú/g, 'ł') // Sometimes L is ú
            .replace(/╩/g, 'ę')
            .replace(/ť/g, 'ś')
            .replace(/┐/g, 'ż')
            .replace(/ą/g, 'ą') // Ensure standard polish is preserved
            .replace(/ć/g, 'ć')
            .replace(/ę/g, 'ę')
            .replace(/ł/g, 'ł')
            .replace(/ń/g, 'ń')
            .replace(/ó/g, 'ó')
            .replace(/ś/g, 'ś')
            .replace(/ź/g, 'ź')
            .replace(/ż/g, 'ż');
    }

    static parse(csvContent: string): CSVTransaction[] {
        const normalizedContent = this.normalizeEncoding(csvContent);
        const lines = normalizedContent.split(/\r?\n/).filter(line => line.trim().length > 0);
        
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
            const rawAmount = columns[3] ? columns[3].replace(',', '.').replace('+', '') : '0';
            const amountVal = new Decimal(rawAmount);
            
            const col5 = columns[5] || "";
            const col6 = columns[6] || "";
            const col7 = columns[7] || "";

            // Logic for Counterparty: Usually Col 6
            let counterparty = col6;
            
            // Logic for Title: Try Col 7, then Col 5
            let title = col7;
            if (!title.toLowerCase().includes('tytu') && col5.toLowerCase().includes('tytu')) {
                title = col5;
            } else if (!title && col5) {
                title = col5;
            }

            const sanitization = this.sanitize(counterparty, title);

            return {
                transactionDate: rawDate,
                amount: amountVal.toNumber(),
                type: amountVal.isNegative() ? 'EXPENSE' : 'INCOME',
                counterpartyRaw: sanitization.counterparty,
                title: sanitization.title,
                description: col5,
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
            } else if (char === ',' && !inQuotes) {
                // IMPORTANT: PKO BP Sample uses COMMA as separator in some exports, 
                // but SEMICOLON in others. We'll detect it.
                // If the user's sample has "","", then it's comma.
                results.push(current.trim().replace(/^"|"$/g, ''));
                current = "";
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
            .replace(/^Płatość kartą:?\s*/i, '') // typo handling
            .replace(/^Lokalizacja:?\s*/i, '')
            .replace(/^Adres:?\s*/i, '')
            .replace(/^Nazwa odbiorcy:?\s*/i, '')
            .replace(/^Nazwa zleceniodawcy:?\s*/i, '')
            .replace(/^Odbiorca:?\s*/i, '')
            .replace(/^Nazwa nadawcy:?\s*/i, '')
            .trim();

        let cleanTitle = title
            .replace(/^Tytuł:?\s*/i, '')
            .replace(/^Tytuł/i, '')
            .trim();

        const keywords = ['ZABKA', 'ORLEN', 'CIRCLE K', 'STOKROTKA', 'BIEDRONKA', 'SHELL', 'LIDL', 'BP', 'MOYA', 'AUCHAN', 'CARREFOUR', 'ARKADIA'];
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
