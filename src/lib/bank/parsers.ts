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
    // PKO BP CSV is win1250 encoding
    const content = iconv.decode(buffer, "win1250");
    const lines = content.split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
    
    if (lines.length < 2) return [];

    // Auto-detect separator: ; or ,
    const firstLine = lines[0];
    const separator = firstLine.includes(';') ? ';' : ',';

    let startIndex = 0;
    for (let i = 0; i < lines.length; i++) {
        // Find header row (Data operacji, Kwota, etc.)
        if (lines[i].includes('Data operacji') || lines[i].includes('Kwota')) {
            startIndex = i + 1;
            break;
        }
    }

    const dataLines = lines.slice(startIndex);
    // Regex for CSV split handling quotes: (?:^|sep)("(?:[^"]|"")*"|[^sep]*)
    const regexPattern = new RegExp(`(?:^|${separator})("(?:[^"]|"")*"|[^${separator}]*)`, 'g');

    return dataLines.map((line, index) => {
        const columns: string[] = [];
        let match;
        
        // Reset regex index for each line
        regexPattern.lastIndex = 0;
        while ((match = regexPattern.exec(line)) !== null) {
            let val = match[1];
            if (val && val.startsWith('"') && val.endsWith('"')) {
                val = val.slice(1, -1).replace(/""/g, '"');
            }
            columns.push((val || "").trim());
        }
        
        // HOTFIX: Payload Consolidation — PKO BP splits description across many columns.
        // Grab column[5] (Opis transakcji) + all subsequent overflow columns and join them.
        const descriptionParts = columns.slice(5).filter(c => c.length > 0);
        const fullRawDescription = descriptionParts.join(' ').trim();

        // Layer 1: Strictly Raw Extraction (No mutations)
        return {
            rawDate: columns[0] || "",
            rawAmount: columns[3] || "0",
            rawType: columns[2] || "UNKNOWN",
            rawDescription: fullRawDescription,   // Consolidated: Opis transakcji + Column1, _1, _2 …
            rawCounterparty: columns[6] || "",   // Nazwa odbiorcy/nadawcy
            rawTitle: columns[7] || "",           // Tytuł
            rawReference: `CSV-PKO-${index}-${columns[0]}-${(columns[3] || "").replace(/[^\d]/g, '')}`,
            rawAccountNumber: "", 
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
