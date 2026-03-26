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

    // --- CONDITION A: CARD PAYMENTS ---
    if (raw.rawType === 'Płatność kartą' || raw.rawType === 'Wypłata z bankomatu') {
        // Target columns 6 (rawCounterparty) or 5 (rawDescription) containing "Lokalizacja:"
        const targetString = `${raw.rawCounterparty} ${raw.rawDescription}`;
        // Regex to extract strictly between Adres: (or Lokalizacja: ) and Miasto:
        const cardVendorMatch = targetString.match(/(?:Adres:|Lokalizacja:)\s?([^:]+?)(?=\sMiasto:|$)/i);
        if (cardVendorMatch) {
            counterparty = cardVendorMatch[1].trim();
        }
    } 
    // --- CONDITION B: BANK TRANSFERS ---
    else if (['Przelew na konto', 'Przelew z konta', 'Przelew do ZUS', 'Przelew podatkowy'].includes(raw.rawType)) {
        // 1. IBAN Extraction (26 digits) from rawDescription (Opis transakcji)
        const ibanMatch = raw.rawDescription.replace(/\s/g, '').match(/(?:Rachunekodbiorcy:|Rachuneknadawcy:)([0-9]{26})/i);
        if (ibanMatch) {
            accountNumber = ibanMatch[1];
        }

        // 2. Vendor Extraction from rawCounterparty (Nazwa odbiorcy/nadawcy)
        // Usually, the rawCounterparty column in PKO for transfers contains strictly the name if not prefixed.
        // But the user specifies: "Extract the string after the prefix Nazwa odbiorcy/nadawcy:"
        const vendorMatch = raw.rawCounterparty.match(/(?:Nazwa odbiorcy\/nadawcy:)\s?(.+)$/i);
        if (vendorMatch) {
            counterparty = vendorMatch[1].trim();
        }
    }

    // 3. Metadata Assemble
    return {
        date: dateObj,
        amount: Math.abs(amount),
        type,
        counterparty: counterparty.trim(),
        title: (raw.rawTitle || "Transakcja Bankowa").trim(),
        description: (raw.rawDescription || "").trim(),
        reference: raw.rawReference || `REF-${dateObj.getTime()}-${Math.abs(amount)}`,
        accountNumber: accountNumber ? accountNumber.replace(/\s/g, '') : null,
        address: address.trim() || undefined
    };
}
