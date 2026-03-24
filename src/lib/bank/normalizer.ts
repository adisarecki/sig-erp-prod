import { RawTransaction, NormalizedTx } from "./types";

/**
 * LAYER 2: NORMALIZE (Golden Rule)
 * Unifies diverse raw formats into a predictable ERP-ready structure.
 */

export function normalizeTransaction(raw: RawTransaction): NormalizedTx {
    // 1. Clean Amount (Crucial for PKO BP)
    // Remove spaces, replace commas with dots, handles 1 000,00 -> 1000.00
    const cleanAmountStr = raw.rawAmount
        .replace(/\s/g, '')
        .replace(',', '.')
        .replace('+', '');
    
    const amount = parseFloat(cleanAmountStr);
    const type: 'INCOME' | 'EXPENSE' = amount >= 0 ? 'INCOME' : 'EXPENSE';

    // 2. Standardize Date
    let dateObj = new Date(raw.rawDate);
    if (isNaN(dateObj.getTime())) {
        // Handle YYMMDD (MT940) or other PKO variants
        if (raw.rawDate.length === 6) {
            const year = `20${raw.rawDate.substring(0, 2)}`;
            const month = raw.rawDate.substring(2, 4);
            const day = raw.rawDate.substring(4, 6);
            dateObj = new Date(`${year}-${month}-${day}`);
        } else {
            dateObj = new Date(); // Fallback to now if unparseable
        }
    }

    // 3. Metadata
    return {
        date: dateObj,
        amount: Math.abs(amount),
        type,
        counterparty: (raw.rawCounterparty || "Nieznany").trim(),
        title: (raw.rawTitle || "Transakcja Bankowa").trim(),
        description: (raw.rawDescription || "").trim(),
        reference: raw.rawReference || `REF-${dateObj.getTime()}-${Math.abs(amount)}`
    };
}
