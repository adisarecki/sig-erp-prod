import { revalidatePath } from "next/cache"
import { getCurrentTenantId } from "@/lib/tenant"
import { adminDb } from "@/lib/firebase/admin"

/**
 * 1. Dodawanie kontrahenta
 */
export async function addContractor(formData: FormData) {
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
 * 4. USUWANIE (Batch)
 */
export async function deleteSelectedContractors(ids: string[]) {
    const tenantId = await getCurrentTenantId();

    try {
        const batch = adminDb.batch()

        for (const id of ids) {
            // W NoSQL nie mamy kaskadowego usuwania wbudowanego tak jak w SQL, 
            // więc musielibyśmy ręcznie szukać wszystkich faktur i projektów.
            // Dla celów lokalnego testu usuwamy tylko kontrahentów (dokumentacja to zaznacza).
            const ref = adminDb.collection("contractors").doc(id)
            batch.delete(ref)
        }

        await batch.commit()

        revalidatePath("/crm")
        revalidatePath("/")
        return { success: true }
    } catch (error) {
        console.error("[CRM_DELETE_ERROR]", error)
        throw new Error("Błąd podczas usuwania kontrahentów.")
    }
}

/**
 * 5. POBIERANIE
 */
export async function getContractors() {
    const tenantId = await getCurrentTenantId()
    const snapshot = await adminDb.collection("contractors")
        .where("tenantId", "==", tenantId)
        .orderBy("name", "asc")
        .get()

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}