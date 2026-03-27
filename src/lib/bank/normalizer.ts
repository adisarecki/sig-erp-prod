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
    // Szukamy nazwy po 'Nazwa nadawcy/odbiorcy' LUB po 'Adres:' (dla kart)
    const vendorMatch = fullDesc.match(
        /(?:Nazwa nadawcy|Nazwa odbiorcy|Adres):\s*(.*?)(?=\s*(?:Adres nadawcy|Adres odbiorcy|Tytuł|Lokalizacja|Miasto|Data wykonania|$))/i
    );
    if (vendorMatch && vendorMatch[1].trim()) {
        // Czyścimy nazwę z ewentualnych pozostałości technicznych
        counterparty = vendorMatch[1].trim().replace(/^(Z\d{4,}\s*K\.\d+|000\d+\s*)/i, '');
    } else if (raw.rawCounterparty && raw.rawCounterparty.trim() && raw.rawCounterparty !== "Nieznany") {
        // Fallback: use the dedicated Nazwa column if regex found nothing
        counterparty = raw.rawCounterparty.trim();
    }

    // --- PATTERN 3: TYTUŁ (transaction title, with lookahead stop) ---
    const titleMatch = fullDesc.match(/Tytuł:\s*(.*?)(?=\s*(?:Lokalizacja|Data wykonania|Adres|$))/i);
    if (titleMatch && titleMatch[1].trim()) {
        extractedTitle = titleMatch[1].trim();
    }

    // --- PATTERN 4: LOKALIZACJA / ADRES (Card Payments) ---
    // Handles the pattern: "Lokalizacja: Adres: <addr> Miasto:"
    if (raw.rawType === 'Płatność kartą' || raw.rawType === 'Wypłata z bankomatu') {
        const cardLocationMatch = fullDesc.match(/Lokalizacja:\s*Adres:\s*(.*?)\s*Miasto:/i);
        if (cardLocationMatch && cardLocationMatch[1].trim()) {
            address = cardLocationMatch[1].trim();
            // For card payments, vendor name is the address if no Nazwa match succeeded
            if (!vendorMatch) {
                counterparty = address;
            }
        } else {
            // Fallback: old regex for "Adres: ... Miasto:"
            const cardVendorMatch = fullDesc.match(/(?:Adres:|Lokalizacja:)\s?([^:]+?)(?=\sMiasto:|$)/i);
            if (cardVendorMatch) {
                counterparty = cardVendorMatch[1].trim();
            }
        }
    }

    // 3. Złota Reguła "Pustej Nazwy"
    // Jeśli po wszystkich operacjach counterparty jest puste lub "Nieznany", 
    // robimy fallback na pierwsze 30 znaków z pola Tytuł.
    const cleanCounterparty = counterparty.trim();
    const finalCounterparty = (cleanCounterparty && cleanCounterparty !== "Nieznany") 
        ? cleanCounterparty 
        : (extractedTitle || raw.rawTitle || "Transakcja").substring(0, 30).trim();

    // 4. Metadata Assemble
    return {
        date: dateObj,
        amount: Math.abs(amount),
        type,
        counterparty: finalCounterparty,
        title: (extractedTitle || raw.rawTitle || "Transakcja Bankowa").trim(),
        description: fullDesc.trim(),
        reference: raw.rawReference || `REF-${dateObj.getTime()}-${Math.abs(amount)}`,
        accountNumber: accountNumber ? accountNumber.replace(/\s/g, '') : null,
        address: address.trim() || null,
        nip: raw.rawNip || null,
        iban: raw.rawIban || (accountNumber ? accountNumber.replace(/\s/g, '') : null)
    };
}
