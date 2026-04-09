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
    private static normalizeEncoding(text: string): string {
        // Since we now use TextDecoder('windows-1250') in the upload client,
        // we no longer need these manual fallbacks. Returning text directly.
        return text;
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

            const normalizedCounterparty = this.normalizeTransactionTitle(col6);

            
            const normalizedTitle = this.normalizeTransactionTitle(title, true);

            return {
                transactionDate: rawDate,
                amount: amountVal.toNumber(),
                type: amountVal.isNegative() ? 'EXPENSE' : 'INCOME',
                counterpartyRaw: normalizedCounterparty,
                title: normalizedTitle,
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

    public static normalizeTransactionTitle(raw: string, isTitle: boolean = false): string {
        if (!raw) return "Nieznany";
        
        // 1. Remove Prefix/Suffixes
        let clean = raw
            .replace(/Płatność kartą:?\s*/ig, '')
            .replace(/Płatość kartą:?\s*/ig, '')
            .replace(/Lokalizacja:?\s*/ig, '')
            .replace(/Adres:?\s*/ig, '')
            .replace(/Nazwa odbiorcy:?\s*/ig, '')
            .replace(/Nazwa zleceniodawcy:?\s*/ig, '')
            .replace(/Odbiorca:?\s*/ig, '')
            .replace(/Nazwa nadawcy:?\s*/ig, '')
            .replace(/Tytuł:?\s*/ig, '')
            .replace(/^Tytuł/ig, '')
            .replace(/ZAPŁATA ZA FAKTURĘ/ig, 'Zapłata za fakturę')
            .replace(/ZAPŁATA/ig, 'Zapłata');

        // 2. Strip numeric garbage (IDs > 4 digits like 000483921)
        clean = clean.replace(/[0-9]{5,}/g, '');

        // 3. Extract common vendors
        const vendorMap: { [key: string]: string } = {
            'ZABKA': 'Żabka',
            'ŻABKA': 'Żabka',
            'ORLEN': 'Orlen',
            'CIRCLE K': 'Circle K',
            'STOKROTKA': 'Stokrotka',
            'BIEDRONKA': 'Biedronka',
            'SHELL': 'Shell',
            'LIDL': 'Lidl',
            'BP': 'BP',
            'MOYA': 'Moya',
            'AUCHAN': 'Auchan',
            'CARREFOUR': 'Carrefour',
            'ARKADIA': 'Arkadia',
            'PKO BP': 'PKO BP',
            'GOOGLE': 'Google',
            'MICROSOFT': 'Microsoft',
            'AMZN': 'Amazon',
            'AMAZON': 'Amazon',
            'APPLE': 'Apple',
            'ALLEGRO': 'Allegro',
            'INPOST': 'InPost'
        };

        const upper = clean.toUpperCase();
        for (const [key, normalized] of Object.entries(vendorMap)) {
            if (upper.includes(key)) {
                return normalized; // Instant hit
            }
        }

        // 4. Fallback Normalize Casing & Clean
        clean = clean.replace(/^[-\s,]+|[-\s,]+$/g, '');
        
        // Simple Capitalization
        if (clean.length > 2 && clean === clean.toUpperCase()) {
            clean = clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
        }

        return clean.trim() || (isTitle ? "Transakcja Bankowa" : "Nieznany");
    }
}
