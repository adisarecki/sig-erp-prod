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

    if (!name) throw new Error("Nazwa firmy jest wymagana.")

    const tenantId = await getCurrentTenantId()

    await adminDb.collection("contractors").add({
        tenantId,
        name,
        nip: nip || null,
        address: address || null,
        status: status || "ACTIVE",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
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

    if (!id || !name) throw new Error("ID oraz Nazwa firmy są wymagane.")

    const tenantId = await getCurrentTenantId()

    await adminDb.collection("contractors").doc(id).update({
        name,
        nip: nip || null,
        address: address || null,
        status: status || "ACTIVE",
        updatedAt: new Date().toISOString()
    })

    revalidatePath("/crm")
    revalidatePath("/")
    return { success: true }
}

/**
 * 3. Szybkie dodawanie z OCR
 */
export async function createContractor(data: { name: string; nip?: string; address?: string }) {
    const adminDb = getAdminDb()
    const tenantId = await getCurrentTenantId()

    try {
        const docRef = await adminDb.collection("contractors").add({
            tenantId,
            name: data.name,
            nip: data.nip || null,
            address: data.address || null,
            status: "ACTIVE",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })

        revalidatePath("/finance")
        revalidatePath("/crm")

        return { success: true, id: docRef.id }
    } catch (error) {
        console.error("[CRM_ACTION] Quick Create error:", error)
        throw new Error("Nie udało się dodać kontrahenta z OCR.")
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

    return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() as any }))
        .sort((a, b) => a.name.localeCompare(b.name))
}