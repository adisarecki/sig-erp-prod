import { RawTransaction, NormalizedTx } from "./types";

/**
 * LAYER 2: NORMALIZE (Golden Rule)
 * Unifies diverse raw formats into a predictable ERP-ready structure.
 */

export function normalizeTransaction(raw: RawTransaction): NormalizedTx {
    // LAYER 2: THE REGEX ENGINE
    
    // 1. Universal Sanitization: Amount (Float)
    const cleanAmountStr = raw.rawAmount
        .replace(/\s/g, '')
        .replace(',', '.')
        .replace('+', '')
        .replace(/[^\d.-]/g, ''); 
    
    const amount = parseFloat(cleanAmountStr);
    const type: 'INCOME' | 'EXPENSE' = amount >= 0 ? 'INCOME' : 'EXPENSE';

    // 2. Universal Sanitization: Date (ISO format YYYY-MM-DD)
    let dateObj = new Date(raw.rawDate);
    if (isNaN(dateObj.getTime())) {
        if (raw.rawDate.length === 6) {
            const year = `20${raw.rawDate.substring(0, 2)}`;
            const month = raw.rawDate.substring(2, 4);
            const day = raw.rawDate.substring(4, 6);
            dateObj = new Date(`${year}-${month}-${day}`);
        } else {
            dateObj = new Date(); 
        }
    }

    let counterparty = raw.rawCounterparty || "Nieznany";
    let accountNumber = raw.rawAccountNumber || null;
    let address = raw.rawAddress || "";
    let extractedTitle = raw.rawTitle || "";

    // =======================================================================
    // HOTFIX: AGGRESSIVE REGEX ENGINE
    // All patterns operate on fullDesc (the consolidated, joined Description).
    // =======================================================================
    const fullDesc = raw.rawDescription || "";

    // --- PATTERN 1: IBAN / NRB (26 digits, ignoring spaces) ---
    // Matches either "Rachunek nadawcy:" or "Rachunek odbiorcy:"
    const ibanMatch = fullDesc.match(/(?:Rachunek nadawcy|Rachunek odbiorcy):\s*([\d\s]{26,35})/);
    if (ibanMatch) {
        accountNumber = ibanMatch[1].replace(/\s/g, ''); // Strip spaces
    }

    // --- PATTERN 2: VENDOR NAME (with lookahead stop at next keyword) ---
    const vendorMatch = fullDesc.match(
        /(?:Nazwa nadawcy|Nazwa odbiorcy|Adres):\s*(.*?)(?=\s*(?:Adres nadawcy|Adres odbiorcy|Tytuł|Lokalizacja|Miasto|Data wykonania|$))/i
    );
    if (vendorMatch && vendorMatch[1].trim()) {
        counterparty = vendorMatch[1].trim().replace(/^(Z\d{4,}\s*K\.\d+|000\d+\s*)/i, '');
    } else {
        // Pattern 2b: Card payment vendor from "Lokalizacja: Adres: <name> Miasto:"
        const cardMatch = fullDesc.match(/Lokalizacja:\s*Adres:\s*(.*?)\s*Miasto:/i);
        if (cardMatch && cardMatch[1].trim()) {
            counterparty = cardMatch[1].trim().replace(/^(Z\d{4,}\s*K\.\d+|000\d+\s*)/i, '');
        }
    }

    // --- PATTERN 3: TYTUŁ (transaction title, with lookahead stop) ---
    const titleMatch = fullDesc.match(/Tytuł:\s*(.*?)(?=\s*(?:Lokalizacja|Data wykonania|Adres|Numer karty|$))/i);
    if (titleMatch && titleMatch[1].trim()) {
        extractedTitle = titleMatch[1].trim();
    }

    // --- PATTERN 4: NIP EXTRACTION ---
    const cleanedForNip = fullDesc.replace(/-/g, '');
    const nipMatch = cleanedForNip.match(/(?:NIP|nip)[,:\s]+([0-9]{10})|\b([0-9]{10})\b/i);
    let extractedNip = raw.rawNip || null;
    if (nipMatch) {
        const candidate = nipMatch[1] || nipMatch[2];
        if (candidate && !cleanedForNip.includes(candidate.repeat(2))) {
            extractedNip = candidate;
        }
    }

    // 3. Złota Reguła "Pustej Nazwy"
    const cleanCounterparty = counterparty.trim();
    const finalCounterparty = (cleanCounterparty && cleanCounterparty !== "Nieznany") 
        ? cleanCounterparty 
        : (extractedTitle || raw.rawTitle || "Transakcja").substring(0, 30).trim();

    // 4. Metadata Assemble
    return {
        date: dateObj,
        amount: amount,
        type,
        counterparty: finalCounterparty,
        title: (extractedTitle || raw.rawTitle || "Transakcja Bankowa").trim(),
        description: fullDesc.trim(),
        reference: raw.rawReference || `REF-${dateObj.getTime()}-${amount}`,
        accountNumber: accountNumber ? accountNumber.replace(/\s/g, '') : null,
        address: address.trim() || null,
        nip: extractedNip,
        iban: raw.rawIban || (accountNumber ? accountNumber.replace(/\s/g, '') : null)
    };
}
