"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getCurrentTenantId } from "@/lib/tenant"
import { getAdminDb } from "@/lib/firebaseAdmin"

/**
 * FULL RESET: Usuwa wszystkie dane operacyjne dla obecnego tenantId.
 * Uwaga: To jest operacja destrukcyjna!
 */
export async function fullResetTenantData() {
    const tenantId = await getCurrentTenantId()
    const adminDb = getAdminDb()

    if (!tenantId) {
        throw new Error("Brak autoryzacji: Nie znaleziono ID tenanta.")
    }

    try {
        console.log(`[MASTER_RESET] Starting Atomic Purge for tenant: ${tenantId}`)

        // 1. FIRESTORE ATOMIC PURGE
        const fsCollections = [
            "projects", 
            "project_stages", 
            "invoices", 
            "transactions", 
            "audit_logs", 
            "liabilities",
            "bank_transactions",
            "bank_staging",
            "ksef_invoices",
            "bank_balance_states",
            "notifications",
            "retentions",
            "assets",
            "ledger_entries",
            "sync_audit_records",
            "processed_events"
        ]

        let totalFsDeleted = 0;

        // Purge Standard Collections by tenantId
        for (const colName of fsCollections) {
            try {
                const snap = await adminDb.collection(colName).where("tenantId", "==", tenantId).get()
                if (!snap.empty) {
                    const batch = adminDb.batch()
                    snap.docs.forEach(doc => batch.delete(doc.ref))
                    await batch.commit()
                    totalFsDeleted += snap.size
                    console.log(`[MASTER_RESET] Firestore: Purged ${snap.size} docs from ${colName}`)
                }
            } catch (err) {
                console.error(`[MASTER_RESET] Error purging collection ${colName}:`, err)
            }
        }

        // 2. PRISMA (SQL) ATOMIC PURGE
        console.log(`[MASTER_RESET] Starting Prisma SQL Purge...`)
        try {
            await prisma.$transaction(async (tx) => {
                // A. Data with Deep Foreign Keys (Ledger, Payments, Assets)
                await tx.invoicePayment.deleteMany({
                    where: { invoice: { tenantId } }
                })
                await tx.ledgerEntry.deleteMany({ where: { tenantId } })
                await tx.asset.deleteMany({ where: { tenantId } })
                await (tx as any).retention.deleteMany({ where: { tenantId } })

                // B. Financial Documents & Transactions
                await tx.invoice.deleteMany({ where: { tenantId } })
                await tx.transaction.deleteMany({ where: { tenantId } })

                // C. Banking & KSeF Pipeline
                await tx.bankTransactionRaw.deleteMany({ where: { tenantId } })
                await tx.bankStaging.deleteMany({ where: { tenantId } })
                await tx.ksefInvoice.deleteMany({ where: { tenantId } })
                await tx.bankBalanceState.deleteMany({ where: { tenantId } })

                // D. Liabilities & Legacy Debts
                await tx.liability.deleteMany({ where: { tenantId } })
                await tx.legacyDebtInstallment.deleteMany({
                    where: { debt: { tenantId } }
                })
                await tx.legacyDebt.deleteMany({ where: { tenantId } })

                // E. Projects (Contractors are KEPT per user request)
                await tx.projectStage.deleteMany({
                    where: { project: { tenantId } }
                })
                await tx.project.deleteMany({ where: { tenantId } })

                // F. System & Audit (Keeping Users & Roles)
                await tx.notification.deleteMany({ where: { tenantId } })
                await tx.auditLog.deleteMany({ where: { tenantId } })
                
                // G. Cleanup global records linked to tenant entries (Sync & Conflicts)
                await tx.identityConflictRecord.deleteMany({ where: { tenantId } })
                // SyncAuditRecord doesn't have tenantId filter easily, 
                // but since all related entities are gone, it's mostly orphaned.
                
            }, { timeout: 30000 }) // 30s timeout for deep purge
            
            console.log(`[MASTER_RESET] Prisma SQL Purge SUCCESS`)
        } catch (err) {
            console.error(`[MASTER_RESET] Prisma SQL Purge FAILED:`, err)
            throw new Error("Błąd podczas czyszczenia bazy SQL (Prisma). Część danych Firestore mogła zostać usunięta.")
        }

        console.log(`[MASTER_RESET] Full Atomic Purge SUCCESS for tenant: ${tenantId}`)

        try {
            revalidatePath("/")
            revalidatePath("/crm")
            revalidatePath("/finanse")
            revalidatePath("/projects")
            revalidatePath("/assets")
            revalidatePath("/settings")
        } catch (e) {
             console.warn("[MASTER_RESET] Revalidation warning (ignored):", e)
        }

        return { 
            success: true, 
            message: `Baza wyczyszczona (z zachowaniem Kontrahentów). Usunięto ${totalFsDeleted} dokumentów Firestore oraz wszystkie rekordy SQL.` 
        }
    } catch (error: unknown) {
        console.error("[MASTER_RESET] Fatal Error:", error)
        const errorMessage = error instanceof Error ? error.message : "Błąd krytyczny podczas czyszczenia bazy danych."
        return { 
            success: false, 
            error: errorMessage 
        }
    }
}
