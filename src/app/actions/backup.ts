"use server"

import prisma from "@/lib/prisma"
import { getAdminDb } from "@/lib/firebaseAdmin"
import { getCurrentTenantId } from "@/lib/tenant"
import { revalidatePath } from "next/cache"
import { fullResetTenantData } from "./admin"

/**
 * EKSPORT DANYCH
 */
export async function exportBackup() {
    const tenantId = await getCurrentTenantId()
    const adminDb = getAdminDb()

    try {
        // 1. Prisma Data
        const [
            contractors,
            objects,
            contacts,
            projects,
            projectStages,
            invoices,
            invoicePayments,
            transactions,
            liabilities,
            legacyDebts,
            legacyDebtInstallments
        ] = await Promise.all([
            prisma.contractor.findMany({ where: { tenantId } }),
            prisma.object.findMany({ where: { contractor: { tenantId } } }),
            prisma.contact.findMany({ where: { contractor: { tenantId } } }),
            prisma.project.findMany({ where: { tenantId } }),
            prisma.projectStage.findMany({ where: { project: { tenantId } } }),
            prisma.invoice.findMany({ where: { tenantId } }),
            prisma.invoicePayment.findMany({ where: { invoice: { tenantId } } }),
            prisma.transaction.findMany({ where: { tenantId } }),
            prisma.liability.findMany({ where: { tenantId } }),
            prisma.legacyDebt.findMany({ where: { tenantId } }),
            prisma.legacyDebtInstallment.findMany({ where: { debt: { tenantId } } })
        ])

        // 2. Firestore Data
        const collections = ["contractors", "projects", "project_stages", "invoices", "transactions", "objects", "debts"]
        const firestoreData: Record<string, any[]> = {}

        for (const col of collections) {
            const snap = await adminDb.collection(col).where("tenantId", "==", tenantId).get()
            firestoreData[col] = snap.docs.map(doc => ({ _id: doc.id, ...doc.data() }))
        }

        return {
            success: true,
            data: {
                backupDate: new Date().toISOString(),
                tenantId,
                prisma: {
                    contractors,
                    objects,
                    contacts,
                    projects,
                    projectStages,
                    invoices,
                    invoicePayments,
                    transactions,
                    liabilities,
                    legacyDebts,
                    legacyDebtInstallments
                },
                firestore: firestoreData
            }
        }
    } catch (error) {
        console.error("[BACKUP_EXPORT_ERROR]", error)
        throw new Error("Błąd podczas generowania kopii zapasowej.")
    }
}

/**
 * IMPORT DANYCH
 */
export async function restoreFromBackup(backupData: any, passwordInput: string) {
    const adminDb = getAdminDb()
    const tenantId = await getCurrentTenantId()
    
    // Zabezpieczenie hasłem
    const SECRET_PASSWORD = process.env.BACKUP_RESTORE_PASSWORD || "cześć"
    if (passwordInput !== SECRET_PASSWORD) {
        throw new Error("Nieprawidłowe hasło autoryzacyjne. Operacja przerwana.")
    }

    if (!backupData || !backupData.prisma || !backupData.firestore) {
        throw new Error("Nieprawidłowy format pliku kopii zapasowej.")
    }

    try {
        // 1. FULL RESET (Wyczyszczenie obecnych danych)
        await fullResetTenantData()

        console.log("[BACKUP] Starting Restore Process...")

        // 2. Firestore Restore (Batches)
        const fsData = backupData.firestore
        for (const col in fsData) {
            const items = fsData[col]
            if (!items.length) continue

            // Firestore Batch has a limit of 500 operations
            const chunks = []
            for (let i = 0; i < items.length; i += 400) {
                chunks.push(items.slice(i, i + 400))
            }

            for (const chunk of chunks) {
                const batch = adminDb.batch()
                chunk.forEach((item: any) => {
                    const { _id, ...data } = item
                    const docRef = adminDb.collection(col).doc(_id)
                    batch.set(docRef, { ...data, tenantId }) // Wymuszamy obecny tenantId dla bezpieczeństwa
                })
                await batch.commit()
            }
        }

        // 3. Prisma Restore (Manual Order due to relations)
        const pData = backupData.prisma
        
        await prisma.$transaction(async (tx) => {
            // Uwaga: Używamy createMany tam gdzie to możliwe, ale z id musimy uważać na typy SQL (String/Decimal)
            // Relacje w SQL wymagają zachowania kolejności: Contractors -> Objects -> Projects -> ...
            
            if (pData.contractors.length) {
                await tx.contractor.createMany({ data: pData.contractors.map((c: any) => ({ ...c, createdAt: new Date(c.createdAt), updatedAt: new Date(c.updatedAt) })) })
            }
            if (pData.objects.length) {
                await tx.object.createMany({ data: pData.objects.map((o: any) => ({ ...o, createdAt: new Date(o.createdAt), updatedAt: new Date(o.updatedAt) })) })
            }
            if (pData.contacts.length) {
                await tx.contact.createMany({ data: pData.contacts.map((c: any) => ({ ...c, createdAt: new Date(c.createdAt), updatedAt: new Date(c.updatedAt) })) })
            }
            if (pData.projects.length) {
                await tx.project.createMany({ data: pData.projects.map((p: any) => ({ ...p, createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt) })) })
            }
            if (pData.projectStages.length) {
                await tx.projectStage.createMany({ data: pData.projectStages.map((s: any) => ({ ...s, createdAt: new Date(s.createdAt), updatedAt: new Date(s.updatedAt) })) })
            }
            if (pData.invoices.length) {
                await tx.invoice.createMany({ data: pData.invoices.map((i: any) => ({ ...i, issueDate: new Date(i.issueDate), dueDate: new Date(i.dueDate), retentionReleaseDate: i.retentionReleaseDate ? new Date(i.retentionReleaseDate) : null, createdAt: new Date(i.createdAt), updatedAt: new Date(i.updatedAt) })) })
            }
            if (pData.transactions.length) {
                await tx.transaction.createMany({ data: pData.transactions.map((t: any) => ({ ...t, transactionDate: new Date(t.transactionDate), createdAt: new Date(t.createdAt), updatedAt: new Date(t.updatedAt) })) })
            }
            if (pData.invoicePayments.length) {
                await tx.invoicePayment.createMany({ data: pData.invoicePayments.map((ip: any) => ({ ...ip, createdAt: new Date(ip.createdAt) })) })
            }
            if (pData.liabilities.length) {
                await tx.liability.createMany({ data: pData.liabilities.map((l: any) => ({ ...l, startDate: new Date(l.startDate), endDate: new Date(l.endDate), createdAt: new Date(l.createdAt), updatedAt: new Date(l.updatedAt) })) })
            }
            if (pData.legacyDebts.length) {
                await tx.legacyDebt.createMany({ data: pData.legacyDebts.map((d: any) => ({ ...d, createdAt: new Date(d.createdAt), updatedAt: new Date(d.updatedAt) })) })
            }
            if (pData.legacyDebtInstallments.length) {
                await tx.legacyDebtInstallment.createMany({ data: pData.legacyDebtInstallments.map((i: any) => ({ ...i, dueDate: new Date(i.dueDate), paidAt: i.paidAt ? new Date(i.paidAt) : null, createdAt: new Date(i.createdAt), updatedAt: new Date(i.updatedAt) })) })
            }
        })

        revalidatePath("/")
        revalidatePath("/crm")
        revalidatePath("/finance")
        revalidatePath("/projects")
        revalidatePath("/settings")

        return { success: true, message: "System został pomyślnie odtworzony z kopii zapasowej." }

    } catch (error) {
        console.error("[BACKUP_RESTORE_ERROR]", error)
        throw new Error("Błąd podczas odtwarzania danych: " + (error as Error).message)
    }
}
