"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { assertFinancialMasterWrite } from "@/lib/finance/authority/guards"

/**
 * [VECTOR 132] Ledger Healer Protocol
 * Automatically identifies and purges orphan ledger entries that have no parent Invoice or Transaction.
 * This is a standard drift-resolution maintenance task.
 */
export async function purgeOrphanLedgerEntries() {
    try {
        await assertFinancialMasterWrite('LEDGER_HEALER', 'system');

        const result = await prisma.$transaction(async (tx: any) => {
            // 1. Get all Ledger Entries
            const entries = await tx.ledgerEntry.findMany();
            
            // 2. Get all valid IDs
            const invoices = await tx.invoice.findMany({ select: { id: true } });
            const transactions = await tx.transaction.findMany({ select: { id: true } });
            
            const validInvoiceIds = new Set(invoices.map((i: any) => i.id));
            const validTransactionIds = new Set(transactions.map((t: any) => t.id));

            // 3. Identify Orphans
            const orphanIds = entries
                .filter((e: any) => {
                    if (e.source === 'INVOICE') return !validInvoiceIds.has(e.sourceId);
                    if (e.source === 'BANK_PAYMENT' || e.source === 'SHADOW_COST') return !validTransactionIds.has(e.sourceId);
                    return false;
                })
                .map((e: any) => e.id);

            if (orphanIds.length === 0) {
                return { success: true, count: 0 };
            }

            // 4. Purge
            const deleted = await tx.ledgerEntry.deleteMany({
                where: { id: { in: orphanIds } }
            });

            return { success: true, count: deleted.count };
        });

        if (result.count > 0) {
            revalidatePath("/");
            revalidatePath("/finanse");
        }

        return result;
    } catch (error) {
        console.error("[PURGE_ORPHANS_ERROR]", error);
        return { success: false, error: error instanceof Error ? error.message : "Błąd podczas czyszczenia rejestru." };
    }
}
