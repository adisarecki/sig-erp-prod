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

        // 0. Sprawdzenie czy NIP już istnieje (Intelligent Upsert)
        if (nip) {
            const existingQuery = await adminDb.collection("contractors")
                .where("tenantId", "==", tenantId)
                .where("nip", "==", nip)
                .limit(1)
                .get()
            
            if (!existingQuery.empty) {
                return { success: true } 
            }

            // Prisma Check (Backup)
            const prismaContractor = await prisma.contractor.findFirst({
                where: { tenantId, nip }
            })
            if (prismaContractor) {
                return { success: true }
            }
        } else {
            // 0a. Jeśli brak NIP, sprawdź czy istnieje już firma o tej samej nazwie (Deduplikacja)
            const existingByName = await prisma.contractor.findFirst({
                where: { 
                    tenantId, 
                    name: { equals: name, mode: 'insensitive' } 
                }
            })
            if (existingByName) {
                throw new Error(`Kontrahent o nazwie "${name}" już istnieje w bazie. Podaj NIP, aby rozróżnić firmy o tej samej nazwie lub wybierz istniejącą kartotekę.`)
            }
        }

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
    await (prisma.contractor.upsert as any)({
        where: { id: contractorRef.id },
        update: {
            name,
            address: address || null,
            status: status || "ACTIVE"
        },
        create: {
            id: contractorRef.id,
            tenantId,
            name,
            nip: nip || null,
            address: address || null,
            type,
            status: status || "ACTIVE",
            objects: {
                create: {
                    id: objectRef.id,
                    name: objectName,
                    address: address || null
                }
            }
        }
    })

    revalidatePath("/crm")
    revalidatePath("/")
    return { success: true }
    } catch (error: unknown) {
        console.error("[CRM_ACTION] Add Contractor error:", error)
        const errorMessage = error instanceof Error ? error.message : "Błąd podczas dodawania kontrahenta."
        return { success: false, error: errorMessage }
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

        // 1. Firestore Update (z Auto-Healingiem)
        const contractorRef = adminDb.collection("contractors").doc(id)
        const contractorDoc = await contractorRef.get()
        
        if (!contractorDoc.exists) {
            console.warn("[CRM_SYNC] Kontrahent uciekł z Firestore. Auto-heal dla ID:", id)
            await contractorRef.set({
                tenantId,
                name,
                nip: nip || null,
                address: address || null,
                type,
                status: status || "ACTIVE",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })
        } else {
            await contractorRef.update({
                name,
                nip: nip || null,
                address: address || null,
                type,
                status: status || "ACTIVE",
                updatedAt: new Date().toISOString()
            })
        }

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
                await prisma.contractor.create({
                data: {
                    id: id,
                    tenantId,
                    name,
                    nip: nip || null,
                    address: address || null,
                    type: type,
                    status: "ACTIVE"
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
    } catch (error: unknown) {
        console.error("[CRM_ACTION] Update Contractor error:", error)
        const errorMessage = error instanceof Error ? error.message : "Błąd podczas aktualizacji kontrahenta."
        return { success: false, error: errorMessage }
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
    } catch (error: unknown) {
        console.error("[CRM_ACTION] Update Object error:", error)
        const errorMessage = error instanceof Error ? error.message : "Błąd podczas aktualizacji obiektu."
        return { success: false, error: errorMessage }
    }
}

/**
 * 3. Szybkie dodawanie z OCR
 */
export async function createContractor(data: { name: string; nip?: string; address?: string; type?: string }) {
    const adminDb = getAdminDb()
    const tenantId = await getCurrentTenantId()
    const type = data.type || "DOSTAWCA"

    // 0. Intelligent Upsert check
    if (data.nip) {
        const existingQuery = await adminDb.collection("contractors")
            .where("tenantId", "==", tenantId)
            .where("nip", "==", data.nip)
            .limit(1)
            .get()
        
        if (!existingQuery.empty) {
            return { success: true, id: existingQuery.docs[0].id }
        }

        // Prisma Check
        const prismaContractor = await prisma.contractor.findFirst({
            where: { tenantId, nip: data.nip }
        })
        if (prismaContractor) {
            return { success: true, id: prismaContractor.id }
        }
    } else {
        // 0a. Sprawdzenie po nazwie (Deduplikacja)
        const existingByName = await prisma.contractor.findFirst({
            where: { 
                tenantId, 
                name: { equals: data.name, mode: 'insensitive' } 
            }
        })
        if (existingByName) {
            return { success: true, id: existingByName.id } // Zwróć istniejącego zamiast tworzyć szum
        }
    }

    try {
        const contractorRef = adminDb.collection("contractors").doc()
        await contractorRef.set({
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

        await (prisma.contractor.upsert as any)({
            where: { id: contractorRef.id },
            update: {
                name: data.name,
                address: data.address || null
            },
            create: {
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
 * 5. POBIERANIE (Prisma-First for Reporting & Consistency)
 */
export async function getContractors() {
    try {
        const tenantId = await getCurrentTenantId()
        
        const contractors = await prisma.contractor.findMany({
            where: { tenantId },
            include: {
                objects: {
                    select: { id: true, name: true, address: true }
                },
                invoices: {
                    select: { 
                        id: true, 
                        amountGross: true, 
                        dueDate: true, 
                        type: true,
                        status: true 
                    }
                }
            },
            orderBy: { name: 'asc' }
        })

        // Map do formatu oczekiwanego przez frontend (obsługa Decimal -> number)
        return contractors.map(c => ({
            ...c,
            invoices: c.invoices.map(inv => ({
                ...inv,
                amountGross: Number(inv.amountGross)
            }))
        }))
    } catch (error) {
        console.error("[CRM_GET_CONTRACTORS_ERROR]", error)
        return []
    }
}

/**
 * 6. WYSZUKIWANIE (Server Side)
 */
export async function searchContractors(query: string) {
    const tenantId = await getCurrentTenantId()
    if (!query || query.length < 2) return []

    try {
        const results = await prisma.contractor.findMany({
            where: {
                tenantId,
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { nip: { contains: query, mode: 'insensitive' } }
                ]
            },
            take: 10,
            orderBy: { name: 'asc' }
        })

        return results.map(c => ({
            id: c.id,
            name: c.name,
            nip: c.nip,
            address: c.address
        }))
    } catch (error) {
        console.error("[CRM_SEARCH_ERROR]", error)
        return []
    }
}