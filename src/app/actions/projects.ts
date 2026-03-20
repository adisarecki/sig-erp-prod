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
        .get()

    return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() as any }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
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

import prisma from "@/lib/prisma"

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
 * USUWANIE (Dual Sync + Cascade)
 */
export async function deleteProject(id: string) {
    const adminDb = getAdminDb()
    const tenantId = await getCurrentTenantId()

    try {
        // 1. Usuwamy powiązane dane z Firestore (Stages, Invoices, Transactions)
        const collections = ["project_stages", "invoices", "transactions"]
        for (const col of collections) {
            const snap = await adminDb.collection(col).where("projectId", "==", id).get()
            const batch = adminDb.batch()
            snap.docs.forEach(doc => batch.delete(doc.ref))
            await batch.commit()
        }

        // 2. Usuwamy projekt z Firestore
        await adminDb.collection("projects").doc(id).delete()

        // 3. Usuwamy z Prisma (Kaskada dla Stages jest w schema, ale dla Transactions/Invoices musimy ręcznie)
        // Najpierw InvoicePayments powiązane z fakturami tego projektu
        const projectInvoices = await prisma.invoice.findMany({ where: { projectId: id }, select: { id: true } })
        const invIds = projectInvoices.map(i => i.id)
        
        await prisma.invoicePayment.deleteMany({ where: { invoiceId: { in: invIds } } })
        await prisma.invoice.deleteMany({ where: { projectId: id } })
        await prisma.transaction.deleteMany({ where: { projectId: id } })
        
        // Na końcu projekt (Stages zostaną usunięte kaskadowo przez DB)
        await prisma.project.delete({ where: { id } })

        revalidatePath("/projects")
        revalidatePath("/finance")
        revalidatePath("/")
        return { success: true }
    } catch (error) {
        console.error("[PROJECT_DELETE_ERROR]", error)
        throw error
    }
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
        adminDb.collection("project_stages").where("projectId", "==", id).get(),
        adminDb.collection("invoices").where("projectId", "==", id).get(),
        adminDb.collection("transactions").where("projectId", "==", id).get()
    ])

    const invoices = invoicesSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() as any }))
        .filter(inv => inv.status !== "REVERSED")

    const transactions = transactionsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() as any }))
        .filter(t => t.status !== "REVERSED")
        .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())

    const stages = stagesSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() as any }))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    return {
        ...project,
        contractor: contractorSnap.exists ? { id: contractorSnap.id, ...contractorSnap.data() as any } : { name: "Nieznany Kontrahent" },
        object: objectSnap.exists ? { id: objectSnap.id, ...objectSnap.data() as any } : { name: "Nieznany Obiekt", address: "Brak adresu" },
        stages,
        invoices,
        transactions
    }
}