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
        return { success: true, message: `Oczyszczono ${idsToDelete.length} rekordów Orlenu.` }

    } catch (error: any) {
        console.error("[HEALER_ERROR]", error)
        return { success: false, error: error.message || "Błąd podczas operacji leczenia bazy." }
    }
}

/**
 * Synchronizuje wszystkich kontrahentów oraz ich faktury z Firestore do Prismy.
 * Naprawia "dziury" w bazie relacyjnej i aktualizuje statusy płatności.
 */
export async function syncAllContractorsToPrisma() {
    try {
        const tenantId = await getCurrentTenantId()
        const adminDb = getAdminDb()

        console.log(`[SYNC] Starting full master sync for tenant: ${tenantId}`)

        // 1. Synchronizacja Kontrahentów
        const contractorSnap = await adminDb.collection("contractors")
            .where("tenantId", "==", tenantId)
            .get()

        let contractorCount = 0
        for (const doc of contractorSnap.docs) {
            const d = doc.data()
            await (prisma.contractor.upsert as any)({
                where: { id: doc.id },
                update: {
                    name: d.name,
                    nip: d.nip || null,
                    address: d.address || null,
                    type: d.type || "DOSTAWCA",
                    status: d.status || "ACTIVE"
                },
                create: {
                    id: doc.id,
                    tenantId,
                    name: d.name,
                    nip: d.nip || null,
                    address: d.address || null,
                    type: d.type || "DOSTAWCA",
                    status: d.status || "ACTIVE"
                }
            })
            contractorCount++
        }

        // 2. Synchronizacja Statusów Faktur (Krytyczne dla Sald)
        const invoiceSnap = await adminDb.collection("invoices")
            .where("tenantId", "==", tenantId)
            .get()

        let invoiceCount = 0
        for (const doc of invoiceSnap.docs) {
            const d = doc.data()
            // Tylko update statusu, aby nie nadpisać relacji jeśli istnieją w Prisma
            await (prisma.invoice.updateMany as any)({
                where: { id: doc.id, tenantId },
                data: {
                    status: d.status,
                    amountGross: d.amountGross || 0,
                    dueDate: d.dueDate ? new Date(d.dueDate) : undefined
                }
            })
            invoiceCount++
        }

        revalidatePath("/crm")
        revalidatePath("/finanse")
        return { success: true, message: `Master Sync zakończony. Zsynchronizowano ${contractorCount} firm i ${invoiceCount} statusów faktur.` }

    } catch (error: any) {
        console.error("[MASTER_SYNC_ERROR]", error)
        return { success: false, error: error.message || "Błąd podczas Master Sync." }
    }
}
