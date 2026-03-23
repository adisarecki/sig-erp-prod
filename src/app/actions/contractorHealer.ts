"use server"

import { getCurrentTenantId } from "@/lib/tenant"
import { getAdminDb } from "@/lib/firebaseAdmin"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"

/**
 * Jednorazowa operacja "Czysta Kartoteka" dla partnera ORLEN.
 * Usuwa śmieciowe rekordy bez NIP-u, zostawiając ten właściwy.
 */
export async function cleanupDuplicateContractors() {
    try {
        const tenantId = await getCurrentTenantId()
        const adminDb = getAdminDb()

        console.log(`[HEALER] Starting cleanup for tenant: ${tenantId}`)

        // 1. Znajdź wszystkich "Orlenów" w Prisma (najszybciej)
        const orlens = await prisma.contractor.findMany({
            where: {
                tenantId,
                name: { contains: "Orlen", mode: "insensitive" }
            }
        })

        if (orlens.length <= 1) {
            return { success: true, message: "Nie znaleziono duplikatów Orlenu do usunięcia." }
        }

        const withNip = orlens.filter(c => c.nip && c.nip.length > 0)
        const withoutNip = orlens.filter(c => !c.nip)

        if (withNip.length === 0) {
            return { success: false, error: "Znaleziono wielu kontrahentów Orlen, ale żaden nie ma NIP-u. Ustaw NIP ręcznie w jednym z nich przed leczeniem." }
        }

        const idsToDelete = withoutNip.map(c => c.id)

        if (idsToDelete.length === 0) {
            return { success: true, message: "Wszystkie rekordy Orlen posiadają NIP. Deduplikacja nie jest wymagana lub wymaga ręcznej interwencji." }
        }

        console.log(`[HEALER] Identified ${idsToDelete.length} 'trash' Orlen records.`)

        // 2. Sprawdź czy rekordy do usunięcia mają powiązane dane (bezpieczeństwo)
        for (const id of idsToDelete) {
            const invoiceCount = await prisma.invoice.count({ where: { contractorId: id } })
            const projectCount = await prisma.project.count({ where: { contractorId: id } })

            if (invoiceCount > 0 || projectCount > 0) {
                console.warn(`[HEALER] Skipping deletion of contractor ${id} - has ${invoiceCount} invoices and ${projectCount} projects. Consider manual merge.`)
                continue
            }

            // 3. Usuń z Firestore
            try {
                await adminDb.collection("contractors").doc(id).delete()
                console.log(`[HEALER] Deleted from Firestore: ${id}`)
            } catch (fsErr) {
                console.error(`[HEALER] Firestore delete failed for ${id}:`, fsErr)
            }

            // 4. Usuń z Prisma
            try {
                await prisma.contractor.delete({ where: { id } })
                console.log(`[HEALER] Deleted from Prisma: ${id}`)
            } catch (pErr) {
                console.error(`[HEALER] Prisma delete failed for ${id}:`, pErr)
            }
        }

        revalidatePath("/crm")
        return { success: true, message: `Oczyszczono ${idsToDelete.length} rekordów.` }

    } catch (error: any) {
        console.error("[HEALER_ERROR]", error)
        return { success: false, error: error.message || "Błąd podczas operacji leczenia bazy." }
    }
}
