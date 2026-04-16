/**
 * Core Financial Math Engine
 * MANDATORY STRICT LAYER: This is the ONLY allowed source for cross-module financial aggregation.
 * No UI components or independent services are allowed to use localized .reduce calculations for financial sums.
 */

import Decimal from "decimal.js";

export type FinancialItem = {
  netAmount?: number | string | Decimal;
  vatAmount?: number | string | Decimal;
  grossAmount?: number | string | Decimal;
  citRate?: number | string | Decimal; // Optionally passed at item level or overridden globally
};

export type ReconciledTotals = {
  totalNet: number;
  totalVat: number;
  totalGross: number;
  estimatedCit: number;
};

/**
 * Calculates strict, signed aggregates directly handling positive and negative values.
 * Negative deltas (corrections) must organically reduce the aggregate total.
 * ABSOLUTELY NO .abs() FUNCTION CALLS ARE ALLOWED INSIDE THIS ENGINE OR BY ITS CONSUMERS.
 * 
 * @param items Array of raw or typed financial items
 * @param globalCitRate Optional fallback CIT rate, defaults to 0.09 (9%)
 */
export function calculateReconciledTotals(
  items: FinancialItem[],
  globalCitRate: number | string | Decimal = 0.09
): ReconciledTotals {
  let totalNet = new Decimal(0);
  let totalVat = new Decimal(0);
  let totalGross = new Decimal(0);

  for (const item of items) {
    if (item.netAmount != null) {
      totalNet = totalNet.add(new Decimal(String(item.netAmount)));
    }
    if (item.vatAmount != null) {
      totalVat = totalVat.add(new Decimal(String(item.vatAmount)));
    }
    if (item.grossAmount != null) {
      totalGross = totalGross.add(new Decimal(String(item.grossAmount)));
    }
  }

  // CIT is derived strictly from the finalized reconciled totalNet (Vector 200)
  // Negative totalNet (loss) means CIT is exactly zero or negative (tax shield) depending on requirement
  // Let's preserve standard strict math: CIT is simply totalNet * rate
  const citRateDec = new Decimal(String(globalCitRate));
  const estimatedCit = totalNet.gt(0) ? totalNet.mul(citRateDec) : new Decimal(0);

  return {
    totalNet: totalNet.toDP(2).toNumber(),
    totalVat: totalVat.toDP(2).toNumber(),
    totalGross: totalGross.toDP(2).toNumber(),
    estimatedCit: estimatedCit.toDP(2).toNumber(),
  };
}

/**
 * Standardizes raw item data into signed FinancialItems for aggregation.
 * - INCOME: Net (+), VAT (-), Gross (+)
 * - COST: Net (-), VAT (+), Gross (-)
 * - VAT logic: Positive (+) result in totalVat means a REFUND (Good).
 */
export function mapToFinancialItem(
  type: 'INCOME' | 'REVENUE' | 'SPRZEDAŻ' | 'COST' | 'EXPENSE' | 'ZAKUP' | 'WYDATEK',
  net: number | string | Decimal,
  vat: number | string | Decimal,
  gross: number | string | Decimal
): FinancialItem {
  const isIncome = ['INCOME', 'REVENUE', 'SPRZEDAŻ', 'PRZYCHÓD'].includes(type.toUpperCase());
  const n = new Decimal(String(net));
  const v = new Decimal(String(vat));
  const g = new Decimal(String(gross));

  if (isIncome) {
    return {
      netAmount: n,
      vatAmount: v.negated(), // Sales VAT is a liability (reduces balance)
      grossAmount: g
    };
  } else {
    return {
      netAmount: n.negated(), // Expense reduces net balance
      vatAmount: v,           // Cost VAT is an asset (increases balance)
      grossAmount: g.negated()
    };
  }
}

/**
 * Convenience method strictly for string display to preserve minus signs naturally.
 */
export function formatSignedCurrency(amount: number | string | Decimal): string {
  const dec = new Decimal(String(amount));
  return `${dec.isPositive() && dec.gt(0) ? "+" : ""}${dec.toDP(2).toString()} PLN`;
}
