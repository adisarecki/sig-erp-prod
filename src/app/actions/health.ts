"use server"

import prisma from "@/lib/prisma"
import { getAdminDb } from "@/lib/firebaseAdmin"
import { getCurrentTenantId } from "@/lib/tenant"

export async function getSyncStatus() {
    try {
        const tenantId = await getCurrentTenantId()
        const adminDb = getAdminDb()

        // 1. Counts from Firestore
        const fsProjects = await adminDb.collection("projects").where("tenantId", "==", tenantId).count().get()
        const fsTransactions = await adminDb.collection("transactions").where("tenantId", "==", tenantId).count().get()
        const fsInvoices = await adminDb.collection("invoices").where("tenantId", "==", tenantId).count().get()

        // 2. Counts from Prisma
        const pProjects = await prisma.project.count({ where: { tenantId } })
        const pTransactions = await prisma.transaction.count({ where: { tenantId } })
        const pInvoices = await prisma.invoice.count({ where: { tenantId } })

        const details = {
            projects: { firestore: fsProjects.data().count, prisma: pProjects },
            transactions: { firestore: fsTransactions.data().count, prisma: pTransactions },
            invoices: { firestore: fsInvoices.data().count, prisma: pInvoices }
        }

        const isSynced = 
            details.projects.firestore === details.projects.prisma &&
            details.transactions.firestore === details.transactions.prisma &&
            details.invoices.firestore === details.invoices.prisma

        return {
            success: true,
            isSynced,
            details,
            timestamp: new Date().toISOString()
        }
    } catch (error: any) {
        console.error("[GET_SYNC_STATUS_ERROR]", error)
        // Return a structured error response that the UI can handle instead of a blank 500
        return {
            success: false,
            isSynced: false,
            error: error.message || "Błąd podczas sprawdzania spójności danych.",
            details: {
                projects: { firestore: 0, prisma: 0 },
                transactions: { firestore: 0, prisma: 0 },
                invoices: { firestore: 0, prisma: 0 }
            }
        }
    }
}
