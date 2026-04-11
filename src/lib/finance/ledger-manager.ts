import prisma from "@/lib/prisma";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { assertFinancialMasterWrite } from "../authority/guards";
import Decimal from "decimal.js";
// @ts-ignore - Prisma environment lag
const db = prisma as any;

export type LedgerSource = 'INVOICE' | 'BANK_PAYMENT' | 'SHADOW_COST';
export type LedgerType = 'INCOME' | 'EXPENSE' | 'VAT_SHIELD' | 'RETENTION_LOCK';

/**
 * [VECTOR 109] Ledger Manager
 * Centralized engine for all financial writes.
 * Enforces PostgreSQL as the Absolute SSoT.
 */

export interface LedgerEntryInput {
  tenantId: string;
  projectId?: string;
  source: LedgerSource;
  sourceId: string;
  amount: Decimal | number;
  type: LedgerType;
  date: Date;
}

/**
 * [VECTOR 117] Sign Authority
 * Strictly applies signs based on business logic. 
 * Prevents sign reversal errors from UI or legacy data.
 */
export function applyFinancialSign(amount: Decimal | number, type: LedgerType): Decimal {
  const absVal = new Decimal(String(amount)).abs();
  switch (type) {
    case 'INCOME':
      return absVal; // Positive
    case 'EXPENSE':
      return absVal.mul(-1); // Negative
    case 'VAT_SHIELD':
      // VAT Shield is (+) for Expenses (refund expectation) 
      // and (-) for Income (debt expectation).
      // This is handled in recordInvoiceToLedger more explicitly.
      return new Decimal(String(amount));
    case 'RETENTION_LOCK':
      return absVal; // Always positive (Vaulted)
    default:
      return new Decimal(String(amount));
  }
}

/**
 * Records a financial event in the Central Ledger (PostgreSQL).
 */
export async function recordLedgerEntry(input: LedgerEntryInput, txClient?: any) {
  // 1. Guardrail Check (Vector 109)
  await assertFinancialMasterWrite(`CREATE_LEDGER_ENTRY_${input.type}`, input.sourceId);

  const action = async (tx: any) => {
    // 2. Create the LedgerEntry (The Truth)
    const entry = await tx.ledgerEntry.create({
      data: {
        tenantId: input.tenantId,
        projectId: input.projectId,
        source: input.source,
        sourceId: input.sourceId,
        amount: applyFinancialSign(input.amount, input.type),
        type: input.type,
        date: input.date
      }
    });
    return entry;
  };

  if (txClient) return await action(txClient);
  return await prisma.$transaction(action);
}

/**
 * Convenience method for Invoices.
 * Creates Net, VAT, and potentially Retention entries in one atomic operation.
 */
export async function recordInvoiceToLedger(params: {
  tenantId: string;
  projectId?: string;
  invoiceId: string;
  amountNet: Decimal | number;
  vatAmount: Decimal | number;
  retainedAmount?: Decimal | number;
  type: 'INCOME' | 'EXPENSE';
  date: Date;
}, txClient?: any) {
  const { tenantId, projectId, invoiceId, amountNet, vatAmount, retainedAmount, type, date } = params;

  const action = async (tx: any) => {
    // [VECTOR 160.1] Idempotency: Clear existing invoice-related entries before re-recording
    await tx.ledgerEntry.deleteMany({
      where: {
        tenantId,
        source: 'INVOICE',
        sourceId: invoiceId
      }
    });

    const entries = [];

    // 1. Net Entry
    entries.push(await tx.ledgerEntry.create({
      data: {
        tenantId,
        projectId,
        source: 'INVOICE',
        sourceId: invoiceId,
        amount: applyFinancialSign(amountNet, type === 'INCOME' ? 'INCOME' : 'EXPENSE'),
        type: type === 'INCOME' ? 'INCOME' : 'EXPENSE',
        date
      }
    }));

    // 2. VAT Entry (Vector 099 signs)
    const vatSignMultiplier = type === 'INCOME' ? -1 : 1;
    entries.push(await tx.ledgerEntry.create({
      data: {
        tenantId,
        projectId,
        source: 'INVOICE',
        sourceId: invoiceId,
        amount: new Decimal(String(vatAmount)).abs().mul(vatSignMultiplier),
        type: 'VAT_SHIELD',
        date
      }
    }));

    // 3. Retention Entry (if applicable)
    if (retainedAmount && new Decimal(String(retainedAmount)).gt(0)) {
      entries.push(await tx.ledgerEntry.create({
        data: {
          tenantId,
          projectId,
          source: 'INVOICE',
          sourceId: invoiceId,
          amount: new Decimal(String(retainedAmount)).abs(),
          type: 'RETENTION_LOCK',
          date
        }
      }));
    }

    return entries;
  };

  if (txClient) return await action(txClient);
  return await prisma.$transaction(action);
}
