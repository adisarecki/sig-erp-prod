import Decimal from "decimal.js";

export type FinancialType = 'INCOME' | 'SPRZEDAŻ' | 'REVENUE' | 'EXPENSE' | 'KOSZT' | 'ZAKUP' | 'PRZYCHÓD' | 'WYDATEK';

export interface MappedFinancials {
    signedNet: Decimal;
    signedVat: Decimal;
    signedGross: Decimal;
    netColor: string;
    vatColor: string;
    grossColor: string;
    isIncome: boolean;
}

/**
 * Centralny helper mapujący kwoty na wektory (znaki) i kolory zgodnie z DNA Sig ERP.
 * DNA Vector 099: Zakupy (Net -, VAT +, Gross -) | Sprzedaż (Net +, VAT -, Gross +)
 */
export function mapFinancialValues(amountNet: number | Decimal, vat: number | Decimal, type: FinancialType): MappedFinancials {
    // Failsafe: No-NaN Rule (Vector 200.5)
    // Coerce undefined, null, "", or non-numeric strings to "0"
    const normalize = (val: any) => {
        if (val === undefined || val === null || val === "" || isNaN(Number(val))) return "0";
        return String(val);
    };

    const net = new Decimal(normalize(amountNet));
    const v = new Decimal(normalize(vat));
    const gross = net.plus(v);

    const isIncome = type && typeof type === 'string' && ['INCOME', 'SPRZEDAŻ', 'REVENUE', 'PRZYCHÓD'].includes(type.toUpperCase());

    // Vector 200.5: Preserve Signed Delta. Do NOT use .abs() if we want to allow negative corrections.
    // Income: Net+, VAT-, Gross+ (unless negative correction)
    // Expense: Net-, VAT+, Gross- (unless negative refund)
    if (isIncome) {
        return {
            signedNet: net,
            signedVat: v.negated(),
            signedGross: gross,
            netColor: 'text-emerald-600',
            vatColor: 'text-rose-600',
            grossColor: 'text-emerald-600',
            isIncome: true
        };
    } else {
        return {
            signedNet: net.negated(),
            signedVat: v,
            signedGross: gross.negated(),
            netColor: 'text-rose-600',
            vatColor: 'text-emerald-600',
            grossColor: 'text-rose-600',
            isIncome: false
        };
    }
}

/**
 * Pomocnicza funkcja do pobierania klasy koloru dla salda VAT.
 */
export function getVatBalanceColor(vatBalance: number | Decimal): string {
    const balance = new Decimal(String(vatBalance));
    if (balance.eq(0)) return 'text-slate-400';
    return balance.gt(0) ? 'text-rose-500' : 'text-emerald-400';
}

/**
 * DNA Vector 099: Centralny helper kolorów dla Dashboardu.
 * Dodatni (+) -> Zielony (Emerald)
 * Ujemny (-) -> Czerwony (Rose)
 * Zero (0) -> Slate
 */
export function getFinancialColor(value: number | Decimal): string {
    const val = new Decimal(String(value));
    if (val.eq(0)) return 'text-slate-400';
    return val.gt(0) ? 'text-emerald-400' : 'text-rose-500';
}

/**
 * Universal Deep Serialization (Vector 200.6)
 * Recursively converts non-serializable objects (Firestore Timestamps, Dates, Decimals)
 * into plain JSON-safe values to prevent Server Component render crashes.
 */
export function deepSerialize<T>(data: T): T {
    if (data === null || data === undefined) return data;

    // Handle Arrays
    if (Array.isArray(data)) {
        return data.map(item => deepSerialize(item)) as unknown as T;
    }

    // Handle Objects
    if (typeof data === 'object') {
        // 1. Handle Firestore Timestamps (duck typing)
        if ('toDate' in data && typeof (data as any).toDate === 'function') {
            return (data as any).toDate().toISOString() as unknown as T;
        }

        // 2. Handle JS Dates
        if (data instanceof Date) {
            return data.toISOString() as unknown as T;
        }

        // 3. Handle Prisma / Decimal.js objects
        if ('toNumber' in data && typeof (data as any).toNumber === 'function') {
            return (data as any).toNumber() as unknown as T;
        }

        // 4. Handle generic objects (recursive)
        const result: any = {};
        for (const [key, value] of Object.entries(data)) {
            result[key] = deepSerialize(value);
        }
        return result as T;
    }

    return data;
}
