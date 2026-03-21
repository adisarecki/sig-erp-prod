"use server"

import { getAdminDb } from "@/lib/firebaseAdmin"
import { getCurrentTenantId } from "@/lib/tenant"
import prisma from "@/lib/prisma"

/**
 * Healer: Wymuszenie synchronizacji projektów z Firestore do Prisma.
 * Odnajduje zgubione rekordy, weryfikuje istnienie obiektów i zapisuje braki w Prismie.
 */
export async function forceSyncProjects() {
    try {
        const tenantId = await getCurrentTenantId()
        const adminDb = getAdminDb()

        // 1. Pobieramy master state z Firestore
        const fsProjectsSnap = await adminDb.collection("projects").where("tenantId", "==", tenantId).get()
        const fsProjects = fsProjectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }))

        // 2. Pobieramy obecny stan w Prisma
        const pProjects = await prisma.project.findMany({ where: { tenantId } })
        const pProjectIds = new Set(pProjects.map(p => p.id))

        // 3. Znajdujemy duchy w Firestore (projekty których nie ma w Prisma)
        const missingProjects = fsProjects.filter(p => !pProjectIds.has(p.id))

        if (missingProjects.length === 0) {
            return {
                success: true,
                message: "Brak zaginionych projektów. Bazy są zsynchronizowane."
            }
        }

        let syncedCount = 0

        // 4. Liniowa naprawa z tworzeniem brakujących obiektów jeśli trzeba
        for (const proj of missingProjects) {
            // Sprawdzamy czy kontrahent istnieje, inaczej odrzucamy próbę naprawy
            const contractorExists = await prisma.contractor.findUnique({ where: { id: proj.contractorId } })
            if (!contractorExists) {
                console.warn(`[HEALER] Pomijam projekt ${proj.id} - brak kontrahenta ${proj.contractorId} w bazie Prisma.`)
                continue
            }

            // Sprawdzamy obiekt, jeżeli brak - odtwarzamy go (aby uniknąc błędu relacji)
            const objectExists = await prisma.object.findUnique({ where: { id: proj.objectId } })
            if (!objectExists) {
                const fsObjectSnap = await adminDb.collection("objects").doc(proj.objectId).get()
                let objName = "Siedziba Główna (Healer)"
                if (fsObjectSnap.exists) {
                    objName = fsObjectSnap.data()?.name || objName
                }

                await prisma.object.create({
                    data: {
                        id: proj.objectId,
                        contractorId: proj.contractorId,
                        name: objName,
                        description: "Obiekt zsynchronizowany awaryjnie przez system Healer"
                    }
                })
            }

            // Upsert / Create właściwego projektu
            await prisma.project.create({
                data: {
                    id: proj.id,
                    tenantId: proj.tenantId,
                    name: proj.name,
                    contractorId: proj.contractorId,
                    objectId: proj.objectId,
                    type: proj.type || "NOWY",
                    status: proj.status || "PLANNED",
                    lifecycleStatus: proj.lifecycleStatus || "ACTIVE",
                    budgetEstimated: Number(proj.budgetEstimated) || 0,
                    budgetUsed: Number(proj.budgetUsed) || 0
                }
            })
            syncedCount++;
        }

        return {
            success: true,
            message: `Pomyślnie zsynchronizowano ${syncedCount} zgubionych projektów.`
        }
    } catch (error: any) {
        console.error("[HEALER_SYNC_ERROR]", error)
        return {
            success: false,
            error: error.message || "Błąd krytyczny podczas działania systemu Healer."
        }
    }
}
