"use server"

import { revalidatePath } from "next/cache"
import { getCurrentTenantId } from "@/lib/tenant"
import { getAdminDb } from "@/lib/firebaseAdmin"
import prisma from "@/lib/prisma"

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
export async function addProject(formData: FormData): Promise<{ success: boolean, error?: string }> {
    try {
        const adminDb = getAdminDb()
        const name = formData.get("name") as string
        const contractorId = formData.get("contractorId") as string
        const objectId = formData.get("objectId") as string
        const budgetEstimated = formData.get("budgetEstimated") as string || "0"

        if (!name || !contractorId) {
            return { success: false, error: "Wymagane pola to: Nazwa Projektu oraz Kontrahent." }
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
                const newObjRef = adminDb.collection("objects").doc()
                targetObjectId = newObjRef.id

                await newObjRef.set({
                    contractorId: contractorId,
                    name: "Siedziba Główna",
                    createdAt: new Date().toISOString()
                })

                try {
                    await prisma.object.create({
                        data: {
                            id: targetObjectId,
                            contractorId: contractorId,
                            name: "Siedziba Główna",
                            description: "Wygenerowany obiekt",
                        }
                    })
                } catch (objError) {
                    console.error("[OBJECT_PRISMA_SYNC_ERROR] Rollback Firestore...", objError)
                    await newObjRef.delete()
                    throw new Error("Błąd podczas synchronizacji nowego obiektu w bazie (Prisma).")
                }
            }
        }

        const newProjectRef = adminDb.collection("projects").doc()
        const projectId = newProjectRef.id

        await newProjectRef.set({
            tenantId,
            name,
            contractorId,
            objectId: targetObjectId,
            budgetEstimated: Number(budgetEstimated),
            status: "PLANNED",
            lifecycleStatus: "ACTIVE",
            type: "NOWY",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })

        try {
            await prisma.project.create({
                data: {
                    id: projectId,
                    tenantId,
                    name,
                    contractorId,
                    objectId: targetObjectId,
                    type: "NOWY",
                    status: "PLANNED",
                    lifecycleStatus: "ACTIVE",
                    budgetEstimated: Number(budgetEstimated),
                    budgetUsed: 0
                }
            })
        } catch (prismaError) {
            console.error("[PROJECT_PRISMA_SYNC_ERROR] Rollback Firestore...", prismaError)
            await newProjectRef.delete()
            throw new Error("Błąd zapisu w relacyjnej bazie (Prisma). Projekt został wycofany z Firestore (Dual-Sync Drift Protection).")
        }

        try {
            revalidatePath("/projects")
            revalidatePath("/")
        } catch (e) {
            console.warn("[PROJECTS] Revalidation warning (ignored):", e)
        }

        return { success: true }
    } catch (error: any) {
        console.error("[PROJECT_ADD_ERROR]", error)
        return { success: false, error: error.message || "Błąd podczas dodawania projektu." }
    }
}

/**
 * AKTUALIZACJA
 */
export async function updateProject(id: string, data: { name: string, budgetEstimated: string }): Promise<{ success: boolean, error?: string }> {
    try {
        const adminDb = getAdminDb()
        if (!id) throw new Error("ID projektu jest wymagane.")
        
        await adminDb.collection("projects").doc(id).update({
            name: data.name,
            budgetEstimated: Number(data.budgetEstimated),
            updatedAt: new Date().toISOString()
        })

        try {
            revalidatePath("/projects")
            revalidatePath("/")
        } catch (e) {
            console.warn("[PROJECTS] Revalidation warning (ignored):", e)
        }

        return { success: true }
    } catch (error: any) {
        console.error("[PROJECT_UPDATE_ERROR]", error)
        return { success: false, error: error.message || "Błąd podczas aktualizacji projektu." }
    }
}


/**
 * ARCHIWIZACJA
 */
export async function archiveProject(id: string): Promise<{ success: boolean, error?: string }> {
    try {
        const adminDb = getAdminDb()
        if (!id) throw new Error("ID projektu jest wymagane.")

        await adminDb.collection("projects").doc(id).update({
            lifecycleStatus: "ARCHIVED",
            updatedAt: new Date().toISOString()
        })

        try {
            revalidatePath("/projects")
            revalidatePath("/")
        } catch (e) {
            console.warn("[PROJECTS] Revalidation warning (ignored):", e)
        }

        return { success: true }
    } catch (error: any) {
        console.error("[PROJECT_ARCHIVE_ERROR]", error)
        return { success: false, error: error.message || "Błąd podczas archiwizacji projektu." }
    }
}

/**
 * USUWANIE (Dual Sync + Cascade)
 */
/**
 * USUWANIE (Dual Sync + Cascade)
 */
import { redirect } from "next/navigation"

export async function deleteProject(id: string): Promise<{ success: boolean, error?: string }> {
    const adminDb = getAdminDb()
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

        // 3. Usuwamy z Prisma
        const projectInvoices = await prisma.invoice.findMany({ where: { projectId: id }, select: { id: true } })
        const invIds = projectInvoices.map(i => i.id)
        
        await prisma.invoicePayment.deleteMany({ where: { invoiceId: { in: invIds } } })
        await prisma.invoice.deleteMany({ where: { projectId: id } })
        await prisma.transaction.deleteMany({ where: { projectId: id } })
        await prisma.project.delete({ where: { id } })

        try {
            revalidatePath("/projects")
            revalidatePath("/finance")
            revalidatePath("/")
        } catch (e) {
            console.warn("[PROJECTS] Revalidation warning during delete (ignored):", e)
        }

        // redirect() throws an internal Next.js error that is caught by the Next.js router.
        // It must NOT be inside a try/catch that returns a value if we want it to work,
        // but here we are in a Server Action. We'll handle it outside the try block.
    } catch (error: any) {
        console.error("[PROJECT_DELETE_ERROR]", error)
        return { success: false, error: error.message || "Błąd podczas usuwania projektu." }
    }

    // Wywołujemy redirect POZA blokiem try/catch (bo redirect rzuca specjalny wyjątek)
    redirect("/projects")
}

export async function deleteSelectedProjects(ids: string[]) {
    const adminDb = getAdminDb()
    const tenantId = await getCurrentTenantId()

    try {
        // 1. Firestore Bulk Delete (Cascade)
        const collections = ["project_stages", "invoices", "transactions"]
        for (const id of ids) {
            for (const col of collections) {
                const snap = await adminDb.collection(col).where("projectId", "==", id).get()
                const batch = adminDb.batch()
                snap.docs.forEach(doc => batch.delete(doc.ref))
                await batch.commit()
            }
            await adminDb.collection("projects").doc(id).delete()
        }

        // 2. Prisma Bulk Delete (Cascade manual)
        const projectInvoices = await prisma.invoice.findMany({ where: { projectId: { in: ids } }, select: { id: true } })
        const invIds = projectInvoices.map(i => i.id)

        await prisma.invoicePayment.deleteMany({ where: { invoiceId: { in: invIds } } })
        await prisma.invoice.deleteMany({ where: { projectId: { in: ids } } })
        await prisma.transaction.deleteMany({ where: { projectId: { in: ids } } })
        await prisma.project.deleteMany({ where: { id: { in: ids } } })

        revalidatePath("/projects")
        revalidatePath("/finance")
        revalidatePath("/")
        return { success: true }
    } catch (error) {
        console.error("[PROJECTS_BULK_DELETE_ERROR]", error)
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
        adminDb.collection("project_stages").where("tenantId", "==", tenantId).where("projectId", "==", id).get(),
        adminDb.collection("invoices").where("tenantId", "==", tenantId).where("projectId", "==", id).get(),
        adminDb.collection("transactions").where("tenantId", "==", tenantId).where("projectId", "==", id).get()
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