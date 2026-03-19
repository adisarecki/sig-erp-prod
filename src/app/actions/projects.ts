"use server"

import { revalidatePath } from "next/cache"
import { getCurrentTenantId } from "@/lib/tenant"
import { getAdminDb } from "@/lib/firebaseAdmin"

/**
 * POBIERANIE - Dashboard i Lista Projektów
 */
export async function getProjects() {
    const adminDb = getAdminDb()
    const tenantId = await getCurrentTenantId()
    const snapshot = await adminDb.collection("projects")
        .where("tenantId", "==", tenantId)
        .where("lifecycleStatus", "==", "ACTIVE")
        .orderBy("createdAt", "desc")
        .get()

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

/**
 * DODAWANIE PROJEKTU
 */
export async function addProject(formData: FormData) {
    const adminDb = getAdminDb()
    const name = formData.get("name") as string
    const contractorId = formData.get("contractorId") as string
    const objectId = formData.get("objectId") as string
    const budgetEstimated = formData.get("budgetEstimated") as string

    if (!name || !contractorId || !budgetEstimated) {
        throw new Error("Wymagane pola to: Nazwa Projektu, Kontrahent oraz Budżet Szacowany.")
    }

    const tenantId = await getCurrentTenantId()
    let targetObjectId = objectId

    if (!targetObjectId) {
        const objectsSnap = await adminDb.collection("objects")
            .where("contractorId", "==", contractorId)
            .limit(1)
            .get()

        if (!objectsSnap.empty) {
            targetObjectId = objectsSnap.docs[0].id
        } else {
            const newObjRef = adminDb.collection("objects").doc()
            await newObjRef.set({
                contractorId: contractorId,
                name: "Siedziba Główna",
                createdAt: new Date().toISOString()
            })
            targetObjectId = newObjRef.id
        }
    }

    await adminDb.collection("projects").add({
        tenantId,
        name,
        contractorId,
        objectId: targetObjectId,
        budgetEstimated: Number(budgetEstimated),
        budgetUsed: 0,
        status: "PLANNED",
        lifecycleStatus: "ACTIVE",
        type: "NOWY",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    })

    revalidatePath("/projects")
    revalidatePath("/")

    return { success: true }
}

/**
 * AKTUALIZACJA
 */
export async function updateProject(id: string, data: { name: string, budgetEstimated: string }) {
    const adminDb = getAdminDb()
    if (!id) throw new Error("ID projektu jest wymagane.")
    const tenantId = await getCurrentTenantId()

    await adminDb.collection("projects").doc(id).update({
        name: data.name,
        budgetEstimated: Number(data.budgetEstimated),
        updatedAt: new Date().toISOString()
    })

    revalidatePath("/projects")
    revalidatePath("/")

    return { success: true }
}

/**
 * ARCHIWIZACJA
 */
export async function archiveProject(id: string) {
    const adminDb = getAdminDb()
    if (!id) throw new Error("ID projektu jest wymagane.")

    await adminDb.collection("projects").doc(id).update({
        lifecycleStatus: "ARCHIVED",
        updatedAt: new Date().toISOString()
    })

    revalidatePath("/projects")
    revalidatePath("/")

    return { success: true }
}

/**
 * SZCZEGÓŁY PROJEKTU (Widok Cockpit)
 */
export async function getProjectWithDetails(id: string) {
    const adminDb = getAdminDb()
    if (!id) throw new Error("ID projektu jest wymagane.")
    const tenantId = await getCurrentTenantId()

    const projectSnap = await adminDb.collection("projects").doc(id).get()
    if (!projectSnap.exists) return null
    const project = { id: projectSnap.id, ...projectSnap.data() as any }
    if (project.tenantId !== tenantId) return null

    // Pobieramy powiązane dane (NoSQL Batch)
    const [contractorSnap, objectSnap, stagesSnap, invoicesSnap, transactionsSnap] = await Promise.all([
        adminDb.collection("contractors").doc(project.contractorId).get(),
        adminDb.collection("objects").doc(project.objectId).get(),
        adminDb.collection("project_stages").where("projectId", "==", id).orderBy("createdAt", "asc").get(),
        adminDb.collection("invoices").where("projectId", "==", id).where("status", "!=", "REVERSED").get(),
        adminDb.collection("transactions").where("projectId", "==", id).where("status", "!=", "REVERSED").orderBy("transactionDate", "desc").get()
    ])

    return {
        ...project,
        contractor: contractorSnap.exists ? { id: contractorSnap.id, ...contractorSnap.data() as any } : null,
        object: objectSnap.exists ? { id: objectSnap.id, ...objectSnap.data() as any } : null,
        stages: stagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        invoices: invoicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        transactions: transactionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    }
}