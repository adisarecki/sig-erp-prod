"use server"

import { revalidatePath } from "next/cache"
import { getCurrentTenantId } from "@/lib/tenant"
import { getAdminDb } from "@/lib/firebaseAdmin"
import prisma from "@/lib/prisma"

/**
 * 1. Dodawanie kontrahenta
 */
export async function addContractor(formData: FormData): Promise<{ success: boolean, error?: string }> {
    try {
        const adminDb = getAdminDb()
    const name = formData.get("name") as string
    let nip = (formData.get("nip") as string || "").replace(/\s/g, "")
    let address = formData.get("address") as string || ""
    const status = formData.get("status") as string
    const type = formData.get("type") as string || "INWESTOR"

    // Heuristic: If address looks like a NIP and nip is empty, swap them
    if (!nip && /^\d{10}$/.test(address.trim())) {
        nip = address.trim()
        address = ""
    }

    if (!name) throw new Error("Nazwa firmy jest wymagana.")

    const tenantId = await getCurrentTenantId()

    // 1. Zapis kontrahenta w Firestore
    const contractorRef = await adminDb.collection("contractors").add({
        tenantId,
        name,
        nip: nip || null,
        address: address || null,
        type,
        status: status || "ACTIVE",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    })

    // 2. Automatyczny Obiekt (Siedziba/Magazyn)
    const objectName = type === "INWESTOR" ? "Siedziba Główna" : "Oddział / Magazyn"
    const objectRef = adminDb.collection("objects").doc() // Rezerwujemy ID

    await objectRef.set({
        contractorId: contractorRef.id,
        name: objectName,
        address: address || null,
        createdAt: new Date().toISOString()
    })

    // 3. Prisma Sync
    await (prisma.contractor.create as any)({
        data: {
            id: contractorRef.id,
            tenantId,
            name,
            nip: nip || null,
            address: address || null,
            type,
            status: status || "ACTIVE",
            objects: {
                create: {
                    id: objectRef.id, // Używamy tego samego ID co w Firestore
                    name: objectName,
                    address: address || null
                }
            }
        }
    })

    revalidatePath("/crm")
    revalidatePath("/")
    return { success: true }
    } catch (error: any) {
        console.error("[CRM_ACTION] Add Contractor error:", error)
        return { success: false, error: error.message || "Błąd podczas dodawania kontrahenta." }
    }
}

/**
 * 2. Edycja kontrahenta
 */
export async function updateContractor(formData: FormData): Promise<{ success: boolean, error?: string }> {
    try {
        const adminDb = getAdminDb()
        const id = formData.get("id") as string
        const name = formData.get("name") as string
        let nip = (formData.get("nip") as string || "").replace(/\s/g, "")
        let address = formData.get("address") as string || ""
        const status = formData.get("status") as string
        const type = formData.get("type") as string

        // Heuristic: If address looks like a NIP and nip is empty, swap them
        if (!nip && /^\d{10}$/.test(address.trim())) {
            nip = address.trim()
            address = ""
        }

        if (!id || !name) throw new Error("ID oraz Nazwa firmy są wymagane.")

        const tenantId = await getCurrentTenantId()

        // 1. Firestore Update
        const contractorRef = adminDb.collection("contractors").doc(id)
        const contractorDoc = await contractorRef.get()
        
        if (!contractorDoc.exists) {
            throw new Error("Kontrahent nie istnieje w bazie Firestore.")
        }

        await contractorRef.update({
            name,
            nip: nip || null,
            address: address || null,
            type,
            status: status || "ACTIVE",
            updatedAt: new Date().toISOString()
        })

        // 2. Prisma Sync (z Auto-Healingiem)
        try {
            await (prisma.contractor.update as any)({
                where: { id },
                data: {
                    name,
                    nip: nip || null,
                    address: address || null,
                    type,
                    status: status || "ACTIVE"
                }
            })
        } catch (error) {
            console.warn("[CRM_SYNC] Contractor not found in Prisma during update. Attempting auto-heal for ID:", id)
            
            try {
                await (prisma.contractor.create as any)({
                    data: {
                        id: id,
                        tenantId,
                        name,
                        nip: nip || null,
                        address: address || null,
                        type,
                        status: status || "ACTIVE"
                    }
                })
                console.info("[CRM_SYNC] Contractor successfully auto-healed in Prisma.")
            } catch (createErr) {
                console.error("[CRM_SYNC] Fatal error during contractor auto-heal:", createErr)
                // Kontynuujemy, bo Firestore jest OK, ale zwracamy info o błędzie synchro
                return { success: true, error: "Dane zapisane w Firestore, ale synchronizacja SQL nie powiodła się." }
            }
        }

        try {
            revalidatePath("/crm")
            revalidatePath("/")
        } catch (e) {
            console.warn("[CRM] Revalidation warning (ignored):", e)
        }

        return { success: true }
    } catch (error: any) {
        console.error("[CRM_ACTION] Update Contractor error:", error)
        return { success: false, error: error.message || "Błąd podczas aktualizacji kontrahenta." }
    }
}

export async function updateObject(formData: FormData): Promise<{ success: boolean, error?: string }> {
    try {
        const adminDb = getAdminDb()
        const id = formData.get("id") as string
        const name = formData.get("name") as string

        if (!id || !name) throw new Error("ID obiektu oraz Nazwa są wymagane.")

        // 1. Firestore Update
        const objRef = adminDb.collection("objects").doc(id)
        const objDoc = await objRef.get()

        if (!objDoc.exists) {
            throw new Error("Obiekt nie istnieje w bazie Firestore.")
        }

        await objRef.update({
            name,
            updatedAt: new Date().toISOString()
        })

        // 2. Prisma Sync (z Auto-Healingiem)
        try {
            await prisma.object.update({
                where: { id },
                data: { name }
            })
        } catch (error) {
            console.warn("[CRM_SYNC] Object not found in Prisma during update. Attempting auto-heal for ID:", id)

            const data = objDoc.data()!
            // Sprawdź czy kontrahent istnieje w Prisma (zabezpieczenie relacji)
            const contractorExists = await prisma.contractor.findUnique({
                where: { id: data.contractorId }
            })

            if (contractorExists) {
                await (prisma.object.create as any)({
                    data: {
                        id: id,
                        contractorId: data.contractorId,
                        name: name,
                        address: data.address || null
                    }
                })
                console.info("[CRM_SYNC] Object successfully auto-healed in Prisma.")
            }
        }

        try {
            revalidatePath("/crm")
            revalidatePath("/projects")
        } catch (e) {
            console.warn("[CRM] Revalidation warning (ignored):", e)
        }

        return { success: true }
    } catch (error: any) {
        console.error("[CRM_ACTION] Update Object error:", error)
        return { success: false, error: error.message || "Błąd podczas aktualizacji obiektu." }
    }
}

/**
 * 3. Szybkie dodawanie z OCR
 */
export async function createContractor(data: { name: string; nip?: string; address?: string; type?: string }) {
    const adminDb = getAdminDb()
    const tenantId = await getCurrentTenantId()
    const type = data.type || "DOSTAWCA"

    try {
        const contractorRef = await adminDb.collection("contractors").add({
            tenantId,
            name: data.name,
            nip: data.nip || null,
            address: data.address || null,
            type,
            status: "ACTIVE",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })

        const objectName = type === "INWESTOR" ? "Siedziba Główna" : "Oddział / Magazyn"
        const objectRef = adminDb.collection("objects").doc()
        await objectRef.set({
            contractorId: contractorRef.id,
            name: objectName,
            address: data.address || null,
            createdAt: new Date().toISOString()
        })

        await (prisma.contractor.create as any)({
            data: {
                id: contractorRef.id,
                tenantId,
                name: data.name,
                nip: data.nip || null,
                address: data.address || null,
                type,
                status: "ACTIVE",
                objects: {
                    create: {
                        id: objectRef.id,
                        name: objectName,
                        address: data.address || null
                    }
                }
            }
        })

        revalidatePath("/finance")
        revalidatePath("/crm")

        return { success: true, id: contractorRef.id }
    } catch (error) {
        console.error("[CRM_ACTION] Quick Create error:", error)
        throw new Error("Nie udało się dodać kontrahenta.")
    }
}

/**
 * 4. USUWANIE (Pojedyncze i Batch - Dual Sync)
 */
// ... reszta kodu ...

export async function deleteContractor(id: string) {
    const adminDb = getAdminDb()
    const tenantId = await getCurrentTenantId()

    try {
        // 1. Sprawdzenie naruszeń w SQL (Faktury/Projekty)
        const invoiceCount = await prisma.invoice.count({ where: { contractorId: id } })
        const projectCount = await prisma.project.count({ where: { contractorId: id } })

        if (invoiceCount > 0 || projectCount > 0) {
            throw new Error(`Nie można usunąć kontrahenta: Znaleziono ${invoiceCount} faktur i ${projectCount} projektów przypisanych do tej firmy.`)
        }

        // 2. Usuwanie z Firestore
        await adminDb.collection("contractors").doc(id).delete()

        // 3. Usuwanie z Prisma (Kaskadowo usunie obiekty i kontakty)
        await prisma.contractor.delete({ where: { id } })

        revalidatePath("/crm")
        revalidatePath("/")
        return { success: true }
    } catch (error) {
        console.error("[CRM_DELETE_ERROR]", error)
        throw error
    }
}

export async function deleteSelectedContractors(ids: string[]) {
    const adminDb = getAdminDb()
    const tenantId = await getCurrentTenantId();

    try {
        const batch = adminDb.batch()
        for (const id of ids) {
            batch.delete(adminDb.collection("contractors").doc(id))
        }

        // Sprawdzenie naruszeń dla grupy
        const violations = await prisma.invoice.count({ where: { contractorId: { in: ids } } })
        if (violations > 0) {
            throw new Error(`Wykryto ${violations} dokumentów powiązanych z zaznaczonymi firmami. Usuwanie zablokowane.`)
        }

        await batch.commit()
        await prisma.contractor.deleteMany({ where: { id: { in: ids } } })

        revalidatePath("/crm")
        revalidatePath("/")
        return { success: true }
    } catch (error) {
        console.error("[CRM_BULK_DELETE_ERROR]", error)
        throw error
    }
}

/**
 * 5. POBIERANIE
 */
export async function getContractors() {
    const adminDb = getAdminDb()
    const tenantId = await getCurrentTenantId()
    const snapshot = await adminDb.collection("contractors")
        .where("tenantId", "==", tenantId)
        .get()

    const contractors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }))

    // Pobierz obiekty TYLKO dla kontrahentów tego tenanta
    const contractorIds = contractors.map(c => c.id)
    if (contractorIds.length === 0) return []

    const objectsSnap = await adminDb.collection("objects")
        .where("contractorId", "in", contractorIds)
        .get()

    const allObjects = objectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }))

    return contractors
        .map(c => ({
            ...c,
            objects: allObjects.filter(o => o.contractorId === c.id)
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
}