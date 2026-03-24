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
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    
    let startIndex = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Data operacji') || lines[i].includes('Kwota')) {
            startIndex = i + 1;
            break;
        }
    }

    const dataLines = lines.slice(startIndex);

    return dataLines.map((line, index) => {
        const columns = splitCsvLine(line);
        const col5 = columns[5] || "";
        const col6 = columns[6] || "";

        return {
            rawDate: columns[0] || "",
            rawAmount: columns[3] || "0",
            rawType: columns[2] || "",
            rawDescription: col5,
            rawCounterparty: col6,
            rawTitle: columns[7] || "",
            rawReference: `PKO-CSV-${index}-${columns[0]}-${columns[3]}`,
            rawAccountNumber: extractNrb(col5 + " " + col6)
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

function splitCsvLine(line: string): string[] {
    const results = [];
    let current = "";
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if ((char === ',' || char === ';') && !inQuotes) {
            results.push(current.trim().replace(/^"|"$/g, ''));
            current = "";
        } else {
            current += char;
        }
    }
    results.push(current.trim().replace(/^"|"$/g, ''));
    return results;
}
