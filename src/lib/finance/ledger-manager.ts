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
 * Records a financial event in the Central Ledger (PostgreSQL).
 * Also handles mirroring to the relational Transaction table and 
 * creating 'LEDGER_DERIVED' snapshots for UI efficiency.
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
        amount: new Decimal(String(input.amount)),
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
    const entries = [];

    // 1. Net Entry
    entries.push(await tx.ledgerEntry.create({
      data: {
        tenantId,
        projectId,
        source: 'INVOICE',
        sourceId: invoiceId,
        amount: new Decimal(String(amountNet)).mul(type === 'INCOME' ? 1 : -1),
        type: type === 'INCOME' ? 'INCOME' : 'EXPENSE',
        date
      }
    }));

    // 2. VAT Entry (Vector 099 signs)
    entries.push(await tx.ledgerEntry.create({
      data: {
        tenantId,
        projectId,
        source: 'INVOICE',
        sourceId: invoiceId,
        amount: new Decimal(String(vatAmount)).mul(type === 'INCOME' ? -1 : 1),
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
          amount: new Decimal(String(retainedAmount)),
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
