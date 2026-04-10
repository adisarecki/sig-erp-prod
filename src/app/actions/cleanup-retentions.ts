"use server"

import prisma from "@/lib/prisma"
import { getAdminDb } from "@/lib/firebaseAdmin"
import { getCurrentTenantId } from "@/lib/tenant"
import { revalidatePath } from "next/cache"

export async function cleanupRetentionGhostEntries() {
    try {
        const tenantId = await getCurrentTenantId()
        const adminDb = getAdminDb()

        console.log(`[CLEANUP] Starting cleanup for tenant: ${tenantId}`)

        // 1. Identify "Ghost" Ledger Entries
        // Strategy: Entries of type RETENTION_LOCK where the sourceId is NOT a valid invoice ID
        const allInvoices = await prisma.invoice.findMany({
            where: { tenantId },
            select: { id: true }
        })
        const validInvoiceIds = new Set(allInvoices.map(i => i.id))

        const ghostLedgerEntries = await prisma.ledgerEntry.findMany({
            where: {
                tenantId,
                type: 'RETENTION_LOCK'
            }
        })

        const entriesToDelete = ghostLedgerEntries.filter(e => !validInvoiceIds.has(e.sourceId))
        const entryIdsToDelete = entriesToDelete.map(e => e.id)

        if (entryIdsToDelete.length > 0) {
            console.log(`[CLEANUP] Found ${entryIdsToDelete.length} ghost LEDGER entries. Deleting...`)
            await prisma.ledgerEntry.deleteMany({
                where: { id: { in: entryIdsToDelete } }
            })
        }

        // 2. Identify "Ghost" Retention records in Firestore/Prisma
        // Logic: Delete anything with source: "PROJECT" that doesn't have an invoiceId
        const retentions = await (prisma as any).retention.findMany({
            where: { 
                tenantId,
                OR: [
                    { source: "PROJECT" },
                    { invoiceId: null }
                ]
            }
        })

        const retentionIdsToDelete = retentions.map((r: any) => r.id)

        if (retentionIdsToDelete.length > 0) {
            console.log(`[CLEANUP] Found ${retentionIdsToDelete.length} ghost RETENTION records. Deleting...`)
            
            // Delete from Firestore
            const batch = adminDb.batch()
            for (const id of retentionIdsToDelete) {
                batch.delete(adminDb.collection("retentions").doc(id))
            }
            await batch.commit()

            // Delete from Prisma
            await (prisma as any).retention.deleteMany({
                where: { id: { in: retentionIdsToDelete } }
            })
        }

        console.log(`[CLEANUP] Finished. Total Ledger entries removed: ${entriesToDelete.length}, Total Retention records removed: ${retentions.length}`)
        
        revalidatePath("/")
        revalidatePath("/finanse")
        revalidatePath("/projects")
        
        return { 
            success: true, 
            message: `Wyczyszczono ${entriesToDelete.length} wpisów księgowych i ${retentions.length} rekordów kaucji.` 
        }
    } catch (error: any) {
        console.error("[CLEANUP_ERROR]", error)
        return { success: false, error: error.message }
    }
}
