import Decimal from "decimal.js";
import { FiscalAggregates } from "./types";
import { calculateReconciledTotals, formatSignedCurrency, FinancialItem } from "../finance/coreMath";

export class FiscalCalculatorService {
  /**
   * Calculate VAT from net amount and rate
   */
  static calculateVAT(netAmount: Decimal | number, vatRate: Decimal | number = 0.23): Decimal {
    const net = new Decimal(netAmount);
    const rate = new Decimal(vatRate);
    return net.mul(rate);
  }

  /**
   * Calculate gross from net and VAT
   */
  static calculateGross(netAmount: Decimal | number, vatAmount: Decimal | number): Decimal {
    const net = new Decimal(netAmount);
    const vat = new Decimal(vatAmount);
    return net.add(vat);
  }

  /**
   * Calculate CIT from net amount and rate
   */
  static calculateCIT(netAmount: Decimal | number, citRate: Decimal | number = 0.09): Decimal {
    const net = new Decimal(netAmount);
    const rate = new Decimal(citRate);
    return net.mul(rate);
  }

  static aggregateItems(items: FinancialItem[], citRate: Decimal | number = 0.09): FiscalAggregates {
    const totals = calculateReconciledTotals(items, citRate);

    return {
      netAmount: new Decimal(totals.totalNet),
      vatAmount: new Decimal(totals.totalVat),
      grossAmount: new Decimal(totals.totalGross),
      citAmount: new Decimal(totals.estimatedCit),
    };
  }

  /**
   * Calculate fiscal liabilities
   * Returns color-coded liability states for UI
   */
  static calculateLiabilities(aggregates: FiscalAggregates) {
    const vatSaldo = aggregates.vatAmount;
    const citLiability = aggregates.citAmount;
    const grossLiability = aggregates.grossAmount;

    return {
      vatSaldo: {
        amount: vatSaldo,
        color: vatSaldo.isNegative() ? "#10b981" : "#f43f5e", // Emerald Green if NADPŁATA
        label: vatSaldo.isNegative() ? "NADPŁATA" : "DO ZAPŁATY",
      },
      citLiability: {
        amount: citLiability,
        color: citLiability.isNegative() ? "#06b6d4" : "#f43f5e", // Cyan if loss
        label: citLiability.isNegative() ? "TARCZA PODATKOWA" : "DO ZAPŁATY",
      },
      grossLiability: {
        amount: grossLiability,
        color: grossLiability.isPositive() ? "#f43f5e" : "#10b981",
        label: grossLiability.isPositive() ? "DO ZAPŁATY" : "DO ZWROTU",
      },
    };
  }

  static formatLiability(amount: Decimal): string {
    return formatSignedCurrency(amount);
  }

  /**
   * Calculate monthly summary
   */
  static calculateMonthlySummary(
    items: Array<{ issueDate: Date; netAmount: Decimal | number; vatAmount: Decimal | number; grossAmount: Decimal | number }>,
    citRate: Decimal | number = 0.09
  ) {
    const byMonth = new Map<string, FiscalAggregates>();

    items.forEach((item) => {
      const key = `${item.issueDate.getFullYear()}-${String(item.issueDate.getMonth() + 1).padStart(2, "0")}`;

      if (!byMonth.has(key)) {
        byMonth.set(key, {
          netAmount: new Decimal(0),
          vatAmount: new Decimal(0),
          grossAmount: new Decimal(0),
          citAmount: new Decimal(0),
        });
      }

      const month = byMonth.get(key)!;
      month.netAmount = month.netAmount.add(new Decimal(item.netAmount));
      month.vatAmount = month.vatAmount.add(new Decimal(item.vatAmount));
      month.grossAmount = month.grossAmount.add(new Decimal(item.grossAmount));
    });

    // Recalculate CIT for all months
    const result: Record<string, FiscalAggregates> = {};
    byMonth.forEach((aggregates, key) => {
      result[key] = {
        ...aggregates,
        citAmount: this.calculateCIT(aggregates.netAmount, citRate),
      };
    });

    return result;
  }

  /**
   * Compare two fiscal periods
   */
  static comparePeriods(current: FiscalAggregates, previous: FiscalAggregates) {
    return {
      netChange: current.netAmount.sub(previous.netAmount),
      vatChange: current.vatAmount.sub(previous.vatAmount),
      grossChange: current.grossAmount.sub(previous.grossAmount),
      citChange: current.citAmount.sub(previous.citAmount),
      netChangePercent: current.netAmount.div(previous.netAmount || 1).mul(100).sub(100),
      vatChangePercent: current.vatAmount.div(previous.vatAmount || 1).mul(100).sub(100),
    };
  }
}
