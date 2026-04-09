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
  vaultValue: Decimal;
  unpaidInvoicesGross: Decimal;
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
    where: { tenantId }
  });

  // 1. Unrealized Invoices (from Prisma Mirror)
  // [TODO] Move Unpaid tracking to Ledger if necessary, 
  // currently Prisma Invoice model tracks paymentStatus.
  const unpaidInvoices = await prisma.invoice.findMany({
    where: { tenantId, paymentStatus: 'UNPAID', status: 'ACTIVE' }
  });
  const unpaidTotalGross = unpaidInvoices.reduce((sum: Decimal, inv: any) => sum.plus(new Decimal(String(inv.amountGross))), new Decimal(0));

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

  // 3. Safe to Spend calculation (Vector 117 Logic)
  // Formula: Real Cash - (VAT Debt if any) - (Retention Vaults)
  // VAT Balance < 0 means we owe money (Debt).
  const vatDebt = vatBalance.lt(0) ? vatBalance.abs() : new Decimal(0);
  
  // CIT Reserve = 19% of Net Profit (fuelAccrualNet) if profitable
  const citReserve = fuelAccrualNet.gt(0) ? fuelAccrualNet.mul(new Decimal("0.19")) : new Decimal(0);
  
  const safeToSpend = realCashBalance
    .minus(vatDebt)
    .minus(citReserve)
    .minus(vaultValue); // Locked retention is strictly not spendable

  return {
    realCashBalance,
    safeToSpend,
    vatBalance,
    fuelAccrualNet,
    citReserve,
    vaultValue,
    unpaidInvoicesGross: unpaidTotalGross,
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
    where: { tenantId, projectId }
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
