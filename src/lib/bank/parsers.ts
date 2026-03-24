import iconv from "iconv-lite";
import { RawTransaction } from "./types";

/**
 * LAYER 1: EXTRACT & PARSE (Strictly Format-Specific)
 */

export function parseCSV(buffer: Buffer): RawTransaction[] {
    // PKO BP CSV is win1250
    const content = iconv.decode(buffer, "win1250");
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    
    // Find header
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
        return {
            rawDate: columns[0] || "",
            rawAmount: columns[3] || "0",
            rawType: columns[2] || "",
            rawDescription: columns[5] || "",
            rawCounterparty: columns[6] || "",
            rawTitle: columns[7] || "",
            rawReference: `PKO-CSV-${index}-${columns[0]}-${columns[3]}`
        };
    });
}

export function parseMT940(buffer: Buffer): RawTransaction[] {
    // MT940 is often win1250 in Polish banks
    const content = iconv.decode(buffer, "win1250");
    const transactions: RawTransaction[] = [];
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    
    let currentTx: Partial<RawTransaction> | null = null;
    let currentTag: string | null = null;

    for (const line of lines) {
        if (line.startsWith(':61:')) {
            // Save previous
            if (currentTx && currentTx.rawAmount) {
                transactions.push(currentTx as RawTransaction);
            }
            // New transaction
            const data = line.substring(4);
            // Format :61: YYMMDD[MMDD] DebitCreditAmount...
            // Extract Amount (usually starts at index 10-12 depending on date)
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
                rawReference: data.substring(data.lastIndexOf('//') + 2).trim()
            };
            currentTag = ':61:';
        } else if (line.startsWith(':86:')) {
            if (currentTx) {
                currentTx.rawDescription = line.substring(4);
                currentTag = ':86:';
            }
        } else if (line.startsWith(':') && line.match(/^:\d{2,3}[A-Z]?:/)) {
            // New tag started
            currentTag = line.substring(0, line.indexOf(':', 1) + 1);
        } else {
            // Multiline continuation
            if (currentTag === ':86:' && currentTx) {
                currentTx.rawDescription += " " + line;
            }
        }
    }

    // Push last
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
