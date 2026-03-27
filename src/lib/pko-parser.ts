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
    };
    iban?: string | null;
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
 * PKO BP CSV column layout (0-indexed) – ACTUAL FORMAT:
 * 0: Data operacji
 * 1: Data waluty
 * 2: Typ transakcji
 * 3: Kwota
 * 4: Waluta
 * 5..N: Opis transakcji (variable columns – overflow across multiple cells)
 *
 * CRITICAL: Columns 5+ must be concatenated into one fullDesc string.
 * The content then varies by transaction type:
 *  - Card payment:  col5="Tytuł: <code>", col6="Lokalizacja: Adres: <vendor> Miasto: ..."
 *  - Bank transfer: col5="Rachunek odbiory: <iban>", col6="Nazwa odbiorcy: <name>", col7="Tytuł: ..."
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

// ─── Regex extraction helpers (mirrors normalizer.ts logic) ──────────────────

function extractVendorName(fullDesc: string): string {
    // Pattern 1: Explicit name keyword (transfers)
    const nameMatch = fullDesc.match(
        /(?:Nazwa nadawcy|Nazwa odbiorcy):\s*(.*?)(?=\s*(?:Adres nadawcy|Adres odbiorcy|Tytuł|Lokalizacja|Miasto|Data wykonania|$))/i
    );
    if (nameMatch && nameMatch[1].trim()) {
        return nameMatch[1].trim().replace(/^(Z\d{4,}\s*K\.\d+|000\d+\s*)/i, '');
    }
    // Pattern 2: Card payment vendor from "Lokalizacja: Adres: <name> Miasto:"
    const cardMatch = fullDesc.match(/Lokalizacja:\s*Adres:\s*(.*?)\s*Miasto:/i);
    if (cardMatch && cardMatch[1].trim()) {
        return cardMatch[1].trim().replace(/^(Z\d{4,}\s*K\.\d+|000\d+\s*)/i, '');
    }
    // Pattern 3: Plain "Adres:" (fallback for card)
    const adresMatch = fullDesc.match(/Adres:\s*(.*?)(?=\s*(?:Tytuł|Lokalizacja|Miasto|Data wykonania|$))/i);
    if (adresMatch && adresMatch[1].trim()) {
        return adresMatch[1].trim().replace(/^(Z\d{4,}\s*K\.\d+|000\d+\s*)/i, '');
    }
    return "";
}

function extractTitle(fullDesc: string): string {
    const match = fullDesc.match(/Tytuł:\s*(.*?)(?=\s*(?:Lokalizacja|Data wykonania|Adres|Numer karty|$))/i);
    return match ? match[1].trim() : "";
}

function extractIban(fullDesc: string): string {
    const match = fullDesc.match(/(?:Rachunek nadawcy|Rachunek odbiorcy):\s*([\d\s]{26,35})/);
    return match ? match[1].replace(/\s/g, '') : "";
}

function extractAddress(fullDesc: string): string | null {
    // From "Adres nadawcy/odbiorcy:"
    const match = fullDesc.match(/Adres (?:nadawcy|odbiorcy):\s*(.*?)(?=\s*(?:Tytuł|Nazwa|Numer|$))/i);
    if (match && match[1].trim()) return match[1].trim();
    // From "Lokalizacja: ... Miasto: <city> Kraj:"
    const cityMatch = fullDesc.match(/Miasto:\s*(.*?)(?=\s*(?:Kraj:|$))/i);
    if (cityMatch && cityMatch[1].trim()) return cityMatch[1].trim();
    return null;
}

function extractNip(fullDesc: string): string | null {
    const cleaned = fullDesc.replace(/-/g, '');
    const nipMatch = cleaned.match(/(?:NIP|nip)[,:\s]+([0-9]{10})|\b([0-9]{10})\b/);
    if (nipMatch) {
        const candidate = nipMatch[1] || nipMatch[2];
        // Exclude obvious IBAN fragments (26+ digit sequences)
        if (candidate && !cleaned.includes(candidate.repeat(2))) return candidate;
    }
    return null;
}

/**
 * Parses a PKO BP CSV export and extracts entries as ParsedBankTransaction.
 */
export function parsePkoCsv(csvContent: string): ParsedBankTransaction[] {
    const lines = csvContent.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];

    const separator = lines[0].includes(';') ? ';' : ',';
    const results: ParsedBankTransaction[] = [];

    // Find header/data start
    let dataStart = 1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Data operacji') || lines[i].includes('Kwota')) {
            dataStart = i + 1;
            break;
        }
    }

    for (let i = dataStart; i < lines.length; i++) {
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

        if (rowData.length < 5) continue;

        const dateStr   = rowData[0]; // Data operacji
        const txType    = rowData[2]; // Typ transakcji
        const amountStr = rowData[3].replace(',', '.'); // Kwota

        // Consolidate ALL description columns from index 5 onwards
        const fullDesc = rowData.slice(5).filter(c => c.length > 0).join(' ').trim();
        if (!fullDesc) continue;

        // --- Extract entities from fullDesc ---
        let vendorName = extractVendorName(fullDesc);
        const title    = extractTitle(fullDesc);
        const iban     = extractIban(fullDesc);
        const address  = extractAddress(fullDesc);
        const nip      = extractNip(fullDesc);

        // Golden Rule: if no vendor found, fall back to first 30 chars of title
        if (!vendorName && title) {
            vendorName = title.substring(0, 30).trim();
        }

        // Skip rows with less than 2 meaningful chars in vendor name
        if (vendorName.trim().length < 2) continue;

        // Clean up title: remove technical transaction codes (pure numbers/spaces)
        const cleanTitle = /^[\d\s]+$/.test(title) ? (txType || 'Przelew') : (title || txType || 'Przelew');

        results.push({
            id: `pko_csv_${i}`,
            date: new Date(dateStr),
            amount: amountStr,
            description: cleanTitle,
            senderName: vendorName,
            contractor: {
                name: toTitleCase(vendorName),
                nip,
                address
            },
            iban
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
