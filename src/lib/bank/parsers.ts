import iconv from "iconv-lite";
import { RawTransaction } from "./types";

/**
 * LAYER 1: EXTRACT & PARSE (Strictly Format-Specific)
 */

function extractNrb(text: string): string {
    // Standard Polish NRB is 26 digits. Sometimes with spaces.
    const clean = text.replace(/\s/g, '');
    const match = clean.match(/[0-9]{26}/);
    return match ? match[0] : "";
}

export function parseCSV(buffer: Buffer): RawTransaction[] {
    // PKO BP CSV is win1250
    const content = iconv.decode(buffer, "win1250");
    const lines = content.split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
    
    let startIndex = 0;
    for (let i = 0; i < lines.length; i++) {
        // Find header row
        if (lines[i].includes('Data operacji') || lines[i].includes('Kwota')) {
            startIndex = i + 1;
            break;
        }
    }

    const dataLines = lines.slice(startIndex);

    return dataLines.map((line, index) => {
        // PKO BP Spec: separator: ;
        const columns = splitCsvLine(line, ';');
        
        // Basic columns
        const rawDate = columns[0] || "";
        const rawTypeDescription = columns[2] || "";
        const rawAmount = columns[3] || "0";
        const rawDescription = columns[5] || ""; // Opis transakcji
        const rawCounterpartyCol = columns[6] || "";
        const rawTitleCol = columns[7] || "";

        // REGEX EXTRACTION (Normalization Layer)
        // rachunek_nadawcy_odbiorcy: 26 digits after "Rachunek:"
        const ibanMatch = rawDescription.match(/Rachunek:\s?([0-9\s]{26,32})/);
        const rawIban = ibanMatch ? ibanMatch[1].replace(/\s/g, '') : "";

        // kontrahent: after "Odbiorca:" or "Nadawca:"
        const contractorMatch = rawDescription.match(/(?:Odbiorca|Nadawca):\s?([^:]+?)(?=\s(?:Rachunek|Lokalizacja|Tytuł|NIP):|$)/i);
        const extractedCounterparty = contractorMatch ? contractorMatch[1].trim() : "";

        // lokalizacja: after "Lokalizacja: Adres:"
        const locationMatch = rawDescription.match(/Lokalizacja:\s?Adres:\s?([^:]+?)(?=\s(?:Rachunek|Odbiorca|Nadawca|Tytuł|NIP):|$)/i);
        const rawAddress = locationMatch ? locationMatch[1].trim() : "";

        // nip: 10 digits after "NIP:"
        const nipMatch = rawDescription.match(/NIP:\s?([0-9]{10})/);
        const rawNip = nipMatch ? nipMatch[1] : "";

        return {
            rawDate,
            rawAmount,
            rawType: rawTypeDescription,
            rawDescription,
            rawCounterparty: extractedCounterparty || rawCounterpartyCol || "Nieznany",
            rawTitle: rawTitleCol,
            rawReference: `PKO-CSV-${index}-${rawDate}-${rawAmount.replace(/[^\d]/g, '')}`,
            rawAccountNumber: rawIban || extractNrb(rawDescription + " " + rawCounterpartyCol),
            rawIban,
            rawNip,
            rawAddress
        };
    });
}

export function parseMT940(buffer: Buffer): RawTransaction[] {
    const content = iconv.decode(buffer, "win1250");
    const transactions: RawTransaction[] = [];
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    
    let currentTx: Partial<RawTransaction> | null = null;
    let currentTag: string | null = null;

    for (const line of lines) {
        if (line.startsWith(':61:')) {
            if (currentTx && currentTx.rawAmount) {
                transactions.push(currentTx as RawTransaction);
            }
            const data = line.substring(4);
            const amountPart = data.substring(10);
            const amountMatch = amountPart.match(/[0-9,.]+/);
            const amount = amountMatch ? amountMatch[0] : "0";
            const type = amountPart.includes('D') ? 'EXPENSE' : 'INCOME';

            currentTx = {
                rawDate: data.substring(0, 6),
                rawAmount: type === 'EXPENSE' ? `-${amount}` : amount,
                rawType: type,
                rawDescription: "",
                rawCounterparty: "",
                rawTitle: "",
                rawReference: data.substring(data.lastIndexOf('//') + 2).trim(),
                rawAccountNumber: ""
            };
            currentTag = ':61:';
        } else if (line.startsWith(':86:')) {
            if (currentTx) {
                const desc = line.substring(4);
                currentTx.rawDescription = desc;
                currentTx.rawAccountNumber = extractNrb(desc);
                currentTag = ':86:';
            }
        } else if (line.startsWith(':') && line.match(/^:\d{2,3}[A-Z]?:/)) {
            currentTag = line.substring(0, line.indexOf(':', 1) + 1);
        } else {
            if (currentTag === ':86:' && currentTx) {
                currentTx.rawDescription += " " + line;
                if (!currentTx.rawAccountNumber) {
                    currentTx.rawAccountNumber = extractNrb(currentTx.rawDescription || "");
                }
            }
        }
    }

    if (currentTx && currentTx.rawAmount) {
        transactions.push(currentTx as RawTransaction);
    }

    return transactions;
}

function splitCsvLine(line: string, separator: string = ';'): string[] {
    // Sanitization: Remove outer quotes from the whole line if present
    const cleanLine = line.replace(/^"|"$/g, '');
    
    const results = [];
    let current = "";
    let inQuotes = false;
    
    for (let i = 0; i < cleanLine.length; i++) {
        const char = cleanLine[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === separator && !inQuotes) {
            results.push(current.trim().replace(/^"|"$/g, ''));
            current = "";
        } else {
            current += char;
        }
    }
    results.push(current.trim().replace(/^"|"$/g, ''));
    return results;
}
