import prisma from "@/lib/prisma";
import Decimal from "decimal.js";

// @ts-ignore - Prisma environment lag
const db = prisma as any;

/**
 * [VECTOR 109] Ledger Service
 * Centralized READ point for financial truth.
 * All dashboard KPIs must source from here.
 */

export interface FinancialSnapshot {
  realCashBalance: Decimal;
  safeToSpend: Decimal;
  vatBalance: Decimal;
  fuelAccrualNet: Decimal;
  citReserve: Decimal;
  /** Real Profit: fuelAccrualNet minus citReserve. This is what you actually keep. */
  realProfit: Decimal;
  vaultValue: Decimal;
  /** @deprecated use unpaidReceivables / unpaidPayables */
  unpaidInvoicesGross: Decimal;
  /** Należności – unpaid sales invoices (Accounts Receivable). Positive = money incoming. */
  unpaidReceivables: Decimal;
  /** Zobowiązania – unpaid cost invoices (Accounts Payable). Positive number, subtract from balance. */
  unpaidPayables: Decimal;
  timestamp: string;
  source: 'POSTGRES_LEDGER';
  status: 'LEDGER_DERIVED';
}

/**
 * Builds a full financial snapshot from PostgreSQL LedgerEntry aggregates.
 * This is the definitive source for dashboard KPI widgets.
 */
export async function getFinancialSnapshot(tenantId: string): Promise<FinancialSnapshot> {
  const entries = await db.ledgerEntry.findMany({
    where: { tenantId, recordContext: 'OPERATIONAL' }
  });

  // 1. Unrealized Invoices — split into Receivables vs Payables (Vector 109 Refactor)
  // We source status from Invoice but AMOUNTS from LedgerEntry (SSoT)
  const unrealizedInvoices = await prisma.invoice.findMany({
    where: { 
      tenantId, 
      recordContext: 'OPERATIONAL',
      paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
      status: { in: ['ACTIVE', 'XML_MISSING', 'PENDING'] }
    },
    select: { id: true, type: true }
  });

  const unrealizedIds = unrealizedInvoices.map((inv: any) => inv.id);
  const unrealizedLedgerEntries = await db.ledgerEntry.findMany({
    where: { 
      tenantId, 
      recordContext: 'OPERATIONAL',
      source: 'INVOICE',
      sourceId: { in: unrealizedIds }
    }
  });

  const SALES_TYPES = new Set(['SPRZEDAŻ', 'INCOME', 'REVENUE']);
  const COST_TYPES  = new Set(['ZAKUP', 'EXPENSE', 'COST', 'KSeF_PURCHASE']);

  // Receivables: money we will RECEIVE — positive (+)
  // Formula: Sum of INCOME + VAT_SHIELD (abs) - RETENTION_LOCK
  const unpaidReceivables = unrealizedInvoices
    .filter((inv: any) => SALES_TYPES.has(inv.type))
    .reduce((sum: Decimal, inv: any) => {
      const invEntries = unrealizedLedgerEntries.filter((e: any) => e.sourceId === inv.id);
      
      const net = invEntries.find((e: any) => e.type === 'INCOME')?.amount || new Decimal(0);
      const vat = invEntries.find((e: any) => e.type === 'VAT_SHIELD')?.amount || new Decimal(0);
      const retention = invEntries.find((e: any) => e.type === 'RETENTION_LOCK')?.amount || new Decimal(0);

      // Gross - Retention = Net + ABS(VAT) - Retention
      return sum.plus(new Decimal(String(net)).plus(new Decimal(String(vat)).abs()).minus(new Decimal(String(retention)).abs()));
    }, new Decimal(0));

  // Payables: money we will PAY OUT — kept as positive for UI display
  const unpaidPayables = unrealizedInvoices
    .filter((inv: any) => COST_TYPES.has(inv.type))
    .reduce((sum: Decimal, inv: any) => {
      const invEntries = unrealizedLedgerEntries.filter((e: any) => e.sourceId === inv.id);
      
      const net = invEntries.find((e: any) => e.type === 'EXPENSE')?.amount || new Decimal(0);
      const vat = invEntries.find((e: any) => e.type === 'VAT_SHIELD')?.amount || new Decimal(0);
      const retention = invEntries.find((e: any) => e.type === 'RETENTION_LOCK')?.amount || new Decimal(0);

      // Gross - Retention = ABS(Net) + ABS(VAT) - ABS(Retention)
      return sum.plus(new Decimal(String(net)).abs().plus(new Decimal(String(vat)).abs()).minus(new Decimal(String(retention)).abs()));
    }, new Decimal(0));

  // Legacy combined figure (kept for backwards-compat)
  const unpaidTotalGross = unpaidReceivables.plus(unpaidPayables);

  // 2. Ledger Aggregates
  const realCashBalance = entries
    .filter((e: any) => e.source === 'BANK_PAYMENT' || e.source === 'SHADOW_COST')
    .reduce((sum: Decimal, e: any) => sum.plus(new Decimal(String(e.amount))), new Decimal(0));

  const fuelAccrualNet = entries
    .filter((e: any) => e.type === 'INCOME' || e.type === 'EXPENSE')
    .reduce((sum: Decimal, e: any) => sum.plus(new Decimal(String(e.amount))), new Decimal(0));

  const vaultValue = entries
    .filter((e: any) => e.type === 'RETENTION_LOCK')
    .reduce((sum: Decimal, e: any) => sum.plus(new Decimal(String(e.amount))), new Decimal(0));

  const vatBalance = entries
    .filter((e: any) => e.type === 'VAT_SHIELD')
    .reduce((sum: Decimal, e: any) => sum.plus(new Decimal(String(e.amount))), new Decimal(0));

  // 3. Safe to Spend (Vector 117 Logic)
  const vatDebt = vatBalance.lt(0) ? vatBalance.abs() : new Decimal(0);
  
  // CIT Reserve uses configured rate (default 9%)
  const citRate = new Decimal(process.env.NEXT_PUBLIC_CIT_RATE || '0.09');
  const citReserve = fuelAccrualNet.gt(0) ? fuelAccrualNet.mul(citRate) : new Decimal(0);
  const realProfit = fuelAccrualNet.minus(citReserve);
  
  const safeToSpend = realCashBalance
    .minus(vatDebt)
    .minus(citReserve)
    .minus(vaultValue)
    .minus(unpaidPayables);

  return {
    realCashBalance,
    safeToSpend,
    vatBalance,
    fuelAccrualNet,
    citReserve,
    realProfit,
    vaultValue,
    unpaidInvoicesGross: unpaidTotalGross,
    unpaidReceivables,
    unpaidPayables,
    timestamp: new Date().toISOString(),
    source: 'POSTGRES_LEDGER',
    status: 'LEDGER_DERIVED'
  };
}

/**
 * Aggregates Ledger entries for a specific project.
 */
export async function getProjectFinancials(tenantId: string, projectId: string) {
  const entries = await db.ledgerEntry.findMany({
    where: { tenantId, projectId, recordContext: 'OPERATIONAL' }
  });

  const income = entries
    .filter((e: any) => e.type === 'INCOME') // Strictly Net Income (+)
    .reduce((sum: Decimal, e: any) => sum.plus(new Decimal(String(e.amount))), new Decimal(0));

  const expense = entries
    .filter((e: any) => e.type === 'EXPENSE') // Strictly Net Expense (-)
    .reduce((sum: Decimal, e: any) => sum.plus(new Decimal(String(e.amount))), new Decimal(0));

  return {
    income,
    expense: expense.abs(), // UI expects positive expense for display
    margin: income.plus(expense), // Mathematically Net Margin (Vector 117)
    lockedRetention: entries
      .filter((e: any) => e.type === 'RETENTION_LOCK')
      .reduce((sum: Decimal, e: any) => sum.plus(new Decimal(String(e.amount)).abs()), new Decimal(0))
  };
}
