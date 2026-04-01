"use server"

import { revalidatePath } from "next/cache"
import { getCurrentTenantId } from "@/lib/tenant"
import { getAdminDb } from "@/lib/firebaseAdmin"
import prisma from "@/lib/prisma"
import { assertAuthorityWrite } from "@/lib/authority/guards"
import { randomUUID } from "crypto"
import Decimal from "decimal.js"
import { syncRetentionsFromProject } from "./retentions"
import { createNotification } from "./notifications"
import { syncInvoiceToFirestore } from "@/lib/finance/sync-utils"
import { getProjectFinancials } from "@/lib/finance/ledger-service"

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
        const budgetEstimatedRaw = formData.get("budgetEstimated") as string || "0"
        const budgetEstimated = Number(budgetEstimatedRaw)
        const retShortRaw = formData.get("retentionShortTermRate") as string || "0"
        const retLongRaw = formData.get("retentionLongTermRate") as string || "0"
        const estCompletionRaw = formData.get("estimatedCompletionDate") as string
        const warrantyRaw = formData.get("warrantyPeriodYears") as string || "0"
        
        const retShort = Number(retShortRaw) / 100 // convert % to decimal
        const retLong = Number(retLongRaw) / 100
        const warrantyPeriodYears = parseInt(warrantyRaw)
        const estimatedCompletionDate = estCompletionRaw ? new Date(estCompletionRaw) : null

        if (!name || !contractorId) {
            return { success: false, error: "Wymagane pola to: Nazwa Projektu oraz Kontrahent." }
        }

        const tenantId = await getCurrentTenantId()
        let targetObjectId = objectId

        if (!targetObjectId || targetObjectId === "") {
            const objectsSnap = await adminDb.collection("objects")
                .where("contractorId", "==", contractorId)
                .limit(1)
                .get()

            if (!objectsSnap.empty) {
                targetObjectId = objectsSnap.docs[0].id
            } else {
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
                            contractor: { connect: { id: contractorId } },
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

        // 1. Financial Master Write (POSTGRES - Vector 109)
        await assertAuthorityWrite('PROJECT', 'CREATE', 'POSTGRES');

        const projectId = randomUUID();

        await (prisma as any).project.create({
            data: {
                id: projectId,
                tenant: { connect: { id: tenantId } },
                name,
                contractor: { connect: { id: contractorId } },
                object: { connect: { id: targetObjectId } },
                type: "NOWY",
                status: "PLANNED",
                lifecycleStatus: "ACTIVE",
                budgetEstimated: budgetEstimated,
                budgetUsed: 0,
                retentionShortTermRate: retShort,
                retentionLongTermRate: retLong,
                estimatedCompletionDate: estimatedCompletionDate,
                warrantyPeriodYears: warrantyPeriodYears,
            }
        })

        // 2. Operational Mirror Sync (FIRESTORE)
        await adminDb.collection("projects").doc(projectId).set({
            tenantId,
            name,
            contractorId,
            objectId: targetObjectId,
            budgetEstimated: budgetEstimated,
            retentionShortTermRate: retShort,
            retentionLongTermRate: retLong,
            estimatedCompletionDate: estimatedCompletionDate ? estimatedCompletionDate.toISOString() : null,
            warrantyPeriodYears: warrantyPeriodYears,
            status: "PLANNED",
            lifecycleStatus: "ACTIVE",
            type: "NOWY",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })

        // 3. Post-Process Side Effects (Sync Retentions)
        if (budgetEstimated > 0 && (retShort > 0 || retLong > 0)) {
            await syncRetentionsFromProject(
                projectId, 
                budgetEstimated, 
                retShort, 
                retLong, 
                estimatedCompletionDate, 
                warrantyPeriodYears
            )
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
 * REKALKULACJA BUDŻETU PROJEKTU (DNA Vector 109 / Ledger-First)
 * Sumuje wszystkie powiązane koszty z PostgreSQL LedgerEntry i aktualizuje budgetUsed.
 */
export async function recalculateProjectBudget(projectId: string) {
    if (!projectId) return;

    try {
        const tenantId = await getCurrentTenantId()
        
        // 1. Get Financials from Ledger SSoT (Vector 109)
        const financials = await getProjectFinancials(tenantId, projectId);
        const totalUsed = financials.expense; // budgetUsed is typically the sum of all expenses linked to project

        // 2. Update Project (Authoritative Write to POSTGRES)
        await assertAuthorityWrite('PROJECT', 'RECALC_BUDGET', 'POSTGRES', projectId);
        
        await (prisma as any).project.update({
            where: { id: projectId },
            data: { 
                budgetUsed: totalUsed.toNumber(),
                updatedAt: new Date()
            }
        })

        // 3. Firestore Mirror Update (Secondary Read-Model Cache)
        const adminDb = getAdminDb()
        await adminDb.collection("projects").doc(projectId).update({
            budgetUsed: totalUsed.toNumber(),
            updatedAt: new Date().toISOString()
        })

        console.log(`[BUDGET_RECALC_LEDGER] Project: ${projectId} | Total Used (from Ledger): ${totalUsed.toNumber()} PLN`)
        
        revalidatePath("/projects")
        revalidatePath("/finance")
        revalidatePath("/")
        
    } catch (error) {
        console.error("[BUDGET_RECALC_ERROR]", error)
    }
}

/**
 * SZYBKIE DODAWANIE PROJEKTU (Lightweight)
 */
export async function createProject(data: { name: string, contractorId: string }) {
    const adminDb = getAdminDb()
    const tenantId = await getCurrentTenantId()

    try {
        // 1. Znajdź lub stwórz domyślny obiekt dla kontrahenta
        let objectId = ""
        const objectsSnap = await adminDb.collection("objects")
            .where("contractorId", "==", data.contractorId)
            .limit(1)
            .get()

        if (!objectsSnap.empty) {
            objectId = objectsSnap.docs[0].id
        } else {
            const newObjRef = adminDb.collection("objects").doc()
            objectId = newObjRef.id
            await newObjRef.set({
                contractorId: data.contractorId,
                name: "Siedziba Główna",
                createdAt: new Date().toISOString()
            })
            await prisma.object.create({
                data: {
                    id: objectId,
                    contractor: { connect: { id: data.contractorId } },
                    name: "Siedziba Główna"
                }
            })
        }

        const projectRef = adminDb.collection("projects").doc()
        const projectId = projectRef.id

        await projectRef.set({
            tenantId,
            name: data.name,
            contractorId: data.contractorId,
            objectId,
            budgetEstimated: 0,
            retentionShortTermRate: 0,
            retentionLongTermRate: 0,
            status: "PLANNED",
            lifecycleStatus: "ACTIVE",
            type: "NOWY",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })

        await (prisma as any).project.create({
            data: {
                id: projectId,
                tenant: { connect: { id: tenantId } },
                name: data.name,
                contractor: { connect: { id: data.contractorId } },
                object: { connect: { id: objectId } },
                type: "NOWY",
                status: "PLANNED",
                lifecycleStatus: "ACTIVE",
                budgetEstimated: 0,
                budgetUsed: 0
            }
        })

        revalidatePath("/projects")
        revalidatePath("/")

        return { success: true, id: projectId }
    } catch (error) {
        console.error("[PROJECT_QUICK_CREATE_ERROR]", error)
        throw new Error("Nie udało się szybko dodać projektu.")
    }
}

/**
 * AKTUALIZACJA
 */
export async function updateProject(
    id: string, 
    data: { 
        name: string, 
        budgetEstimated: string, 
        retentionShortTermRate?: string, 
        retentionLongTermRate?: string,
        estimatedCompletionDate?: string,
        warrantyPeriodYears?: string,
        mode?: 'FUTURE' | 'RETROACTIVE'
    }
): Promise<{ success: boolean, error?: string }> {
    try {
        const adminDb = getAdminDb()
        if (!id) throw new Error("ID projektu jest wymagane.")
        
        try {
            const retShortRaw = data.retentionShortTermRate || "0"
            const retLongRaw = data.retentionLongTermRate || "0"
            const estCompletionRaw = data.estimatedCompletionDate
            const warrantyRaw = data.warrantyPeriodYears || "0"

            const retShort = Number(retShortRaw) / 100
            const retLong = Number(retLongRaw) / 100
            const budget = Number(data.budgetEstimated)
            const warrantyPeriodYears = parseInt(warrantyRaw)
            const estimatedCompletionDate = estCompletionRaw ? new Date(estCompletionRaw) : null

            // 1. Master Write (POSTGRES)
            await assertAuthorityWrite('PROJECT', 'UPDATE', 'POSTGRES', id);

            await (prisma as any).project.update({
                where: { id },
                data: {
                    name: data.name,
                    budgetEstimated: budget,
                    retentionShortTermRate: retShort,
                    retentionLongTermRate: retLong,
                    estimatedCompletionDate: estimatedCompletionDate,
                    warrantyPeriodYears: warrantyPeriodYears,
                }
            })

            // 2. Mirror Sync (FIRESTORE)
            await adminDb.collection("projects").doc(id).set({
                name: data.name,
                budgetEstimated: budget,
                retentionShortTermRate: retShort,
                retentionLongTermRate: retLong,
                estimatedCompletionDate: estimatedCompletionDate ? estimatedCompletionDate.toISOString() : null,
                warrantyPeriodYears: warrantyPeriodYears,
                updatedAt: new Date().toISOString()
            }, { merge: true })

            if (budget > 0 && (retShort > 0 || retLong > 0)) {
                await syncRetentionsFromProject(
                    id, 
                    budget, 
                    retShort, 
                    retLong,
                    estimatedCompletionDate,
                    warrantyPeriodYears
                )
            }

            // VECTOR 102.2: Retroactive Recalculation Path
            if (data.mode === 'RETROACTIVE') {
                await recalculateProjectInvoicesRetention(id, retShort, retLong)
            }

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
 * VECTOR 102.2: RETENTION FORK (ROZWIDLENIE KAUCJI)
 * Recalculates all invoices for the project with new rates.
 */
async function recalculateProjectInvoicesRetention(projectId: string, shortRate: number, longRate: number) {
    const tenantId = await getCurrentTenantId();
    const adminDb = getAdminDb();
    
    console.log(`[RETROACTIVE_RECALC] Recalculating invoices for project ${projectId} with rates: S:${shortRate}, L:${longRate}`);

    // 1. Get all revenue invoices for the project
    const invoices = await prisma.invoice.findMany({
        where: { 
            projectId, 
            tenantId,
            type: { in: ['REVENUE', 'INCOME', 'SPRZEDAŻ'] } 
        }
    });

    for (const inv of invoices) {
        const amountNet = Number(inv.amountNet);
        const totalRate = shortRate + longRate;
        const newRetAmount = new Decimal(amountNet).mul(totalRate).toNumber();

        // 2. Update Invoice in Prisma
        await (prisma as any).invoice.update({
            where: { id: inv.id },
            data: { retainedAmount: newRetAmount }
        });

        // 3. Sync Header to Firestore (includes the updated retainedAmount)
        await syncInvoiceToFirestore({
            ...inv,
            amountNet: inv.amountNet.toNumber(),
            amountGross: inv.amountGross.toNumber(),
            taxRate: inv.taxRate.toNumber(),
            retainedAmount: newRetAmount,
            // @ts-ignore
            retentionReleaseDate: inv.retentionReleaseDate,
            issueDate: inv.issueDate.toISOString(),
            dueDate: inv.dueDate.toISOString(),
            createdAt: inv.createdAt.toISOString()
        } as any);

        // 4. Update linked Retention records (source: INVOICE)
        // These are the actual items in the "Skarbiec Kaucji" (Retention Vault)
        const retentions = await (prisma as any).retention.findMany({
            where: { invoiceId: inv.id, tenantId }
        });

        for (const ret of retentions) {
            await (prisma as any).retention.update({
                where: { id: ret.id },
                data: { amount: newRetAmount }
            });
            await adminDb.collection("retentions").doc(ret.id).update({
                amount: newRetAmount,
                updatedAt: new Date().toISOString()
            });
        }
    }
}

/**
 * ZAKOŃCZ INWESTYCJĘ (Phase 9 Protocol)
 */
export async function closeProject(id: string, receiptDate: string): Promise<{ success: boolean, error?: string }> {
    try {
        const adminDb = getAdminDb()
        const tenantId = await getCurrentTenantId()
        
        // 1. Pobierz dane projektu do obliczeń
        const project = await (prisma as any).project.findUnique({
            where: { id, tenantId },
            include: { invoices: true }
        })

        if (!project) throw new Error("Projekt nie istnieje.")

        const date = new Date(receiptDate)
        
        // 2. Oblicz pozostały budżet do zafakturowania
        const totalInvoicedNet = project.invoices
            .filter((inv: any) => inv.type === 'SPRZEDAŻ')
            .reduce((sum: number, inv: any) => sum + Number(inv.amountNet), 0)
        
        const remainingNet = Number(project.budgetEstimated) - totalInvoicedNet

        // 3. Update statusu (Project Lock)
        await adminDb.collection("projects").doc(id).update({
            status: "CLOSED",
            lifecycleStatus: "CLOSED",
            estimatedCompletionDate: date.toISOString(),
            updatedAt: new Date().toISOString()
        })

        await (prisma as any).project.update({
            where: { id },
            data: {
                status: "CLOSED",
                lifecycleStatus: "CLOSED",
                estimatedCompletionDate: date
            }
        })

        // 4. Stwórz zadanie/powiadomienie o fakturze końcowej (High Priority)
        if (remainingNet > 0) {
            await createNotification({
                type: 'WARNING',
                title: `Wystaw fakturę końcową: ${project.name}`,
                message: `Projekt został zamknięty (Odbiór: ${receiptDate}). Do zafakturowania pozostało: ${remainingNet.toLocaleString()} zł netto.`,
                priority: 'HIGH',
                link: `/projects/${id}`
            })
        } else {
            await createNotification({
                type: 'SUCCESS',
                title: `Projekt zamknięty: ${project.name}`,
                message: `Inwestycja została pomyślnie rozliczona i zamknięta.`,
                priority: 'LOW'
            })
        }

        // 5. Synchronizacja kaucji (Data Odmrożenia przelicza się na podstawie nowej daty zakończenia)
        // Wymuszamy status ACTIVE przy zamknięciu projektu
        await syncRetentionsFromProject(
            id,
            Number(project.budgetEstimated),
            Number(project.retentionShortTermRate),
            Number(project.retentionLongTermRate),
            date,
            project.warrantyPeriodYears,
            "ACTIVE"
        )

        revalidatePath("/projects")
        revalidatePath("/")
        
        return { success: true }
    } catch (error: any) {
        console.error("[PROJECT_CLOSE_ERROR]", error)
        return { success: false, error: error.message || "Błąd podczas zamykania projektu." }
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
 * POBIERZ ZAMKNIĘTE PROJEKTY DO FAJKTUROWANIA (Phase 9 Widget)
 */
export async function getClosedProjectsForInvoicing() {
    try {
        const tenantId = await getCurrentTenantId()
        const projects = await (prisma as any).project.findMany({
            where: { 
                tenantId,
                status: "CLOSED"
            },
            include: {
                invoices: true,
                contractor: { select: { name: true } }
            }
        })

        return projects.filter((p: any) => {
            const invoiced = p.invoices
                .filter((inv: any) => inv.type === 'SPRZEDAŻ')
                .reduce((sum: number, inv: any) => sum + Number(inv.amountNet), 0)
            return Number(p.budgetEstimated) > invoiced
        }).map((p: any) => {
            const invoiced = p.invoices
                .filter((inv: any) => inv.type === 'SPRZEDAŻ')
                .reduce((sum: number, inv: any) => sum + Number(inv.amountNet), 0)
            return {
                id: p.id,
                name: p.name,
                contractorName: p.contractor.name,
                remainingNet: Number(p.budgetEstimated) - invoiced
            }
        })
    } catch (error) {
        console.error("[GET_CLOSED_PROJECTS_ERROR]", error)
        return []
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