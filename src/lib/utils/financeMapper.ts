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
    const net = new Decimal(String(amountNet));
    const v = new Decimal(String(vat));
    const gross = net.plus(v);

    const isIncome = ['INCOME', 'SPRZEDAŻ', 'REVENUE', 'PRZYCHÓD'].includes(type.toUpperCase());

    if (isIncome) {
        return {
            signedNet: net.abs(),
            signedVat: v.abs().negated(), // VAT Należny (Liability)
            signedGross: gross.abs(),
            netColor: 'text-emerald-600',
            vatColor: 'text-rose-600',
            grossColor: 'text-emerald-600',
            isIncome: true
        };
    } else {
        return {
            signedNet: net.abs().negated(), // Koszt (Expense)
            signedVat: v.abs(),            // VAT Naliczony (Shield/Asset)
            signedGross: gross.abs().negated(),
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
    return balance.gte(0) ? 'text-emerald-400' : 'text-rose-400';
}
