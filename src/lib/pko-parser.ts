export interface ParsedBankTransaction {
    id: string; // Temporary ID for UI
    date: Date;
    amount: string; // Raw decimal string
    description: string;
    senderName: string;
    contractor: {
        name: string;
        nip: string | null;
        address: string | null;
    }
}

export interface ParsedContractor {
    id: string; // Temporary ID for UI rendering
    originalName: string;
    suggestedName: string;
    nip: string | null;
    address: string | null;
    occurrences: number;
}

/**
 * PKO BP CSV column layout (0-indexed):
 * 0: Data operacji
 * 1: Data waluty
 * 2: Typ transakcji
 * 3: Kwota
 * 4: Waluta
 * 5: Saldo po operacji
 * 6: Rachunek nadawcy/odbiorcy (IBAN)
 * 7: Nazwa nadawcy/odbiorcy       ← SOURCE OF TRUTH for contractor name + address
 * 8: Adres nadawcy/odbiorcy       ← Fallback / secondary address
 * 9: Tytuł                        ← Contains NIP clues
 */

// Phrases that indicate internal/ATM/card transactions that should be filtered out
const TRASH_PHRASES = [
    "wypłata w bankomacie",
    "wpłata w bankomacie",
    "przelew własny",
    "przelew wewnętrzny",
    "płatność blik",
    "zakup przy użyciu karty",
    "zapłata kartą",
    "prowizja od",
    "opłata za prowadzenie",
    "rozliczenie transakcji",
    "przelew na własne konto",
    "własne środki",
    "blik",
]

/**
 * Splits a combined "Name + Address" string from column 7.
 */
function splitNameAndAddress(raw: string): { name: string; address: string | null } {
    if (!raw || raw.trim().length === 0) {
        return { name: "", address: null };
    }

    const parts = raw.split(/[\n\r|]+/).map(p => p.trim()).filter(p => p.length > 0);
    const postalCodeRegex = /\b\d{2}-\d{3}\b/;
    const addressKeywords = /\b(ul\.|ulica|al\.|aleja|os\.|osiedle|pl\.|plac|droga|skr|skrzynka)\b/i;

    const nameParts: string[] = [];
    const addressParts: string[] = [];

    for (const part of parts) {
        if (postalCodeRegex.test(part) || addressKeywords.test(part)) {
            addressParts.push(part);
        } else {
            nameParts.push(part);
        }
    }

    if (nameParts.length === 0 && parts.length > 0) {
        nameParts.push(parts[0]);
        addressParts.splice(0, 1);
    }

    const name = nameParts.join(" ").replace(/\s+/g, " ").trim();
    const address = addressParts.length > 0 ? addressParts.join(", ").trim() : null;

    return { name, address };
}

function isTrashRecord(col7: string): boolean {
    const lower = col7.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return TRASH_PHRASES.some(phrase =>
        lower.includes(phrase.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
    );
}

/**
 * Parses a PKO BP CSV export and extracts entries as ParsedBankTransaction.
 */
export function parsePkoCsv(csvContent: string): ParsedBankTransaction[] {
    const lines = csvContent.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];

    const separator = lines[0].includes(';') ? ';' : ',';
    const results: ParsedBankTransaction[] = [];

    for (let i = 1; i < lines.length; i++) {
        const regexPattern = new RegExp(`(?:^|${separator})("(?:[^"]|"")*"|[^${separator}]*)`, 'g');
        const rowData: string[] = [];
        let match;

        while ((match = regexPattern.exec(lines[i])) !== null) {
            let val = match[1];
            if (val.startsWith('"') && val.endsWith('"')) {
                val = val.slice(1, -1).replace(/""/g, '"');
            }
            rowData.push(val.trim());
        }

        if (rowData.length < 9) continue;

        const dateStr = rowData[0]; // Data operacji
        const amountStr = rowData[3].replace(',', '.'); // Kwota
        const col7 = rowData[7] || ""; // Nazwa nadawcy/odbiorcy

        if (isTrashRecord(col7)) continue;

        const { name, address: addressFromCol7 } = splitNameAndAddress(col7);
        if (name.trim().length < 2) continue;

        const col8 = rowData[8] || "";
        const addressFallback = col8.trim().length > 2 ? col8.trim() : null;

        const fullRowText = rowData.join(" ");
        const nipMatch = fullRowText.replace(/-/g, '').match(/\b\d{10}\b/);
        const nip = nipMatch ? nipMatch[0] : null;

        const finalAddress = addressFromCol7 ?? addressFallback;

        results.push({
            id: `pko_csv_${i}`,
            date: new Date(dateStr),
            amount: amountStr,
            description: rowData[9] || "Przelew", // Tytuł
            senderName: name,
            contractor: {
                name: toTitleCase(name),
                nip: nip,
                address: finalAddress
            }
        });
    }

    return results;
}

export function parsePkoCsvToContractors(csvContent: string): ParsedContractor[] {
    const transactions = parsePkoCsv(csvContent);
    const contractorMap = new Map<string, { nip: string | null; address: string | null; count: number }>();

    for (const tx of transactions) {
        const key = tx.contractor.name.toUpperCase().replace(/\s+/g, ' ').trim();
        if (contractorMap.has(key)) {
            const existing = contractorMap.get(key)!;
            existing.count += 1;
            if (!existing.nip && tx.contractor.nip) existing.nip = tx.contractor.nip;
            if (!existing.address && tx.contractor.address) existing.address = tx.contractor.address;
        } else {
            contractorMap.set(key, { nip: tx.contractor.nip, address: tx.contractor.address, count: 1 });
        }
    }

    const results: ParsedContractor[] = [];
    let idx = 0;
    for (const [key, val] of contractorMap.entries()) {
        results.push({
            id: `ctr_${idx++}`,
            originalName: key,
            suggestedName: toTitleCase(key),
            nip: val.nip,
            address: val.address || "",
            occurrences: val.count
        });
    }

    return results.sort((a, b) => b.occurrences - a.occurrences);
}

// Formats "JAN KOWALSKI SPÓŁKA" → "Jan Kowalski Spółka"
function toTitleCase(str: string): string {
    return str.replace(
        /\w\S*/g,
        txt => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
    );
}
