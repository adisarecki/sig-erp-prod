"use server"

import prisma from "@/lib/prisma"
import { getAdminDb } from "@/lib/firebaseAdmin"
import { getCurrentTenantId } from "@/lib/tenant"

export async function getSyncStatus() {
    try {
        const tenantId = await getCurrentTenantId()
        const adminDb = getAdminDb()

        // 1. Fetch ALL IDs from Firestore (using .select("id") to minimize payload)
        const fsProjectsSnap = await adminDb.collection("projects").where("tenantId", "==", tenantId).select().get()
        const fsTransactionsSnap = await adminDb.collection("transactions").where("tenantId", "==", tenantId).select().get()
        const fsInvoicesSnap = await adminDb.collection("invoices").where("tenantId", "==", tenantId).select().get()

        const fsProjectIds = fsProjectsSnap.docs.map((doc: any) => doc.id)
        const fsTransactionIds = fsTransactionsSnap.docs.map((doc: any) => doc.id)
        const fsInvoiceIds = fsInvoicesSnap.docs.map((doc: any) => doc.id)

        // 2. Fetch ALL IDs from Prisma
        const pProjects = await prisma.project.findMany({ where: { tenantId }, select: { id: true } })
        const pTransactions = await prisma.transaction.findMany({ where: { tenantId }, select: { id: true } })
        const pInvoices = await prisma.invoice.findMany({ where: { tenantId }, select: { id: true } })

        const pProjectIds = pProjects.map((p: any) => p.id)
        const pTransactionIds = pTransactions.map((p: any) => p.id)
        const pInvoiceIds = pInvoices.map((p: any) => p.id)

        const details = {
            projects: { firestore: fsProjectIds.length, prisma: pProjectIds.length },
            transactions: { firestore: fsTransactionIds.length, prisma: pTransactionIds.length },
            invoices: { firestore: fsInvoiceIds.length, prisma: pInvoiceIds.length }
        }

        // 3. Identify Drifting Items
        const driftingItems: any[] = []

        const findDrift = (fsIds: string[], pIds: string[], type: string) => {
            const onlyFs = fsIds.filter(id => !pIds.includes(id))
            const onlyPg = pIds.filter(id => !fsIds.includes(id))

            onlyFs.forEach(id => driftingItems.push({ id, type, location: 'only_firestore', label: type.slice(0, -1) }))
            onlyPg.forEach(id => driftingItems.push({ id, type, location: 'only_postgres', label: type.slice(0, -1) }))
        }

        findDrift(fsInvoiceIds, pInvoiceIds, 'invoices')
        findDrift(fsProjectIds, pProjectIds, 'projects')
        findDrift(fsTransactionIds, pTransactionIds, 'transactions')

        const isSynced = driftingItems.length === 0

        return {
            success: true,
            isSynced,
            details,
            driftingItems,
            timestamp: new Date().toISOString()
        }
    } catch (error: any) {
        console.error("[GET_SYNC_STATUS_ERROR]", error)
        return {
            success: false,
            isSynced: false,
            error: error.message || "Błąd podczas sprawdzania spójności danych.",
            details: {
                projects: { firestore: 0, prisma: 0 },
                transactions: { firestore: 0, prisma: 0 },
                invoices: { firestore: 0, prisma: 0 }
            },
            driftingItems: []
        }
    }
}

