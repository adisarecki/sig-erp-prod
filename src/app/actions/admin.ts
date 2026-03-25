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
            "contractors", 
            "projects", 
            "project_stages", 
            "invoices", 
            "transactions", 
            "audit_logs", 
            "liabilities",
            "users",
            "bank_transactions"
        ]

        let totalFsDeleted = 0;

        // Fetch all contractor IDs to delete objects (which don't have tenantId)
        const contractorsSnap = await adminDb.collection("contractors").where("tenantId", "==", tenantId).get()
        const contractorIds = contractorsSnap.docs.map(doc => doc.id)

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

        // Purge Objects (linked to contractors)
        if (contractorIds.length > 0) {
            try {
                for (let i = 0; i < contractorIds.length; i += 10) {
                    const chunk = contractorIds.slice(i, i + 10)
                    const objsSnap = await adminDb.collection("objects").where("contractorId", "in", chunk).get()
                    if (!objsSnap.empty) {
                        const batch = adminDb.batch()
                        objsSnap.docs.forEach(doc => batch.delete(doc.ref))
                        await batch.commit()
                        totalFsDeleted += objsSnap.size
                    }
                }
                console.log(`[MASTER_RESET] Firestore: Purged objects for ${contractorIds.length} contractors`)
            } catch (err) {
                console.error(`[MASTER_RESET] Error purging objects:`, err)
            }
        }

        // 2. PRISMA (SQL) ATOMIC PURGE
        console.log(`[MASTER_RESET] Starting Prisma SQL Purge...`)
        try {
            await prisma.$transaction(async (tx) => {
                // A. InvoicePayments (dependent via rel)
                await tx.invoicePayment.deleteMany({
                    where: { invoice: { tenantId } }
                })

                // B. Invoices & Transactions
                await tx.invoice.deleteMany({ where: { tenantId } })
                await tx.transaction.deleteMany({ where: { tenantId } })

                // C. Bank & Accounts
                await tx.bankTransactionRaw.deleteMany({ where: { tenantId } })
                await tx.bankAccount.deleteMany({ where: { tenantId } })

                // D. Liabilities & Legacy
                await tx.liability.deleteMany({ where: { tenantId } })
                await tx.legacyDebtInstallment.deleteMany({
                    where: { debt: { tenantId } }
                })
                await tx.legacyDebt.deleteMany({ where: { tenantId } })

                // E. Projects
                await tx.projectStage.deleteMany({
                    where: { project: { tenantId } }
                })
                await tx.project.deleteMany({ where: { tenantId } })

                // F. Contractors
                await tx.contractor.deleteMany({ where: { tenantId } })

                // G. Audit Logs & Users (Security Risk: Purge only if intended)
                await tx.auditLog.deleteMany({ where: { tenantId } })
                await tx.user.deleteMany({ where: { tenantId } })
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
            revalidatePath("/finance")
            revalidatePath("/projects")
        } catch (e) {
             console.warn("[MASTER_RESET] Revalidation warning (ignored):", e)
        }

        return { 
            success: true, 
            message: `Baza wyczyszczona. Usunięto ${totalFsDeleted} dokumentów Firestore oraz wszystkie rekordy SQL.` 
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
