"use server"

import { revalidatePath } from "next/cache"
import { getCurrentTenantId } from "@/lib/tenant"
import { getAdminDb } from "@/lib/firebaseAdmin"

/**
 * 1. Dodawanie kontrahenta
 */
export async function addContractor(formData: FormData) {
    const adminDb = getAdminDb()
    const name = formData.get("name") as string
    const nip = formData.get("nip") as string
    const address = formData.get("address") as string
    const status = formData.get("status") as string
    const type = formData.get("type") as string || "INWESTOR"

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
    const objectName = type === "INWESTOR" 
        ? "Siedziba Główna" 
        : "Oddział / Magazyn (Główny)"
    
    await adminDb.collection("objects").add({
        contractorId: contractorRef.id,
        name: objectName,
        address: address || null,
        createdAt: new Date().toISOString()
    })

    // 3. Prisma Sync
    await prisma.contractor.create({
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
                    name: objectName,
                    address: address || null
                }
            }
        }
    })

    revalidatePath("/crm")
    revalidatePath("/")
    return { success: true }
}

/**
 * 2. Edycja kontrahenta
 */
export async function updateContractor(formData: FormData) {
    const adminDb = getAdminDb()
    const id = formData.get("id") as string
    const name = formData.get("name") as string
    const nip = formData.get("nip") as string
    const address = formData.get("address") as string
    const status = formData.get("status") as string
    const type = formData.get("type") as string

    if (!id || !name) throw new Error("ID oraz Nazwa firmy są wymagane.")

    const tenantId = await getCurrentTenantId()

    await adminDb.collection("contractors").doc(id).update({
        name,
        nip: nip || null,
        address: address || null,
        type,
        status: status || "ACTIVE",
        updatedAt: new Date().toISOString()
    })

    await prisma.contractor.update({
        where: { id },
        data: {
            name,
            nip: nip || null,
            address: address || null,
            type,
            status: status || "ACTIVE"
        }
    })

    revalidatePath("/crm")
    revalidatePath("/")
    return { success: true }
}

export async function updateObject(formData: FormData) {
    const adminDb = getAdminDb()
    const id = formData.get("id") as string
    const name = formData.get("name") as string

    if (!id || !name) throw new Error("ID obiektu oraz Nazwa są wymagane.")

    await adminDb.collection("objects").doc(id).update({
        name,
        updatedAt: new Date().toISOString()
    })

    await prisma.object.update({
        where: { id },
        data: { name }
    })

    revalidatePath("/crm")
    revalidatePath("/projects")
    return { success: true }
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

        const objectName = type === "INWESTOR" ? "Siedziba Główna" : "Oddział / Magazyn (Główny)"
        await adminDb.collection("objects").add({
            contractorId: contractorRef.id,
            name: objectName,
            address: data.address || null,
            createdAt: new Date().toISOString()
        })

        await prisma.contractor.create({
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
import prisma from "@/lib/prisma"

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
    
    // Pobierz obiekty dla wszystkich kontrahentów
    const objectsSnap = await adminDb.collection("objects").get()
    const allObjects = objectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }))

    return contractors
        .map(c => ({
            ...c,
            objects: allObjects.filter(o => o.contractorId === c.id)
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
}