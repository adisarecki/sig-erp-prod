"use server"

import { revalidatePath } from "next/cache"
import { getCurrentTenantId } from "@/lib/tenant"
import { getAdminDb } from "@/lib/firebaseAdmin"
import prisma from "@/lib/prisma"

export async function deleteTransaction(id: string): Promise<{ success: boolean, error?: string }> {
    try {
        const adminDb = getAdminDb()
        
        // 1. Usuwanie z Firestore
        await adminDb.collection("transactions").doc(id).delete()

        // 2. Usuwanie z Prisma
        await prisma.transaction.delete({ where: { id } })

        try {
            revalidatePath("/finance")
            revalidatePath("/projects")
            revalidatePath("/")
        } catch (e) {
            console.warn("[TRANSACTIONS] Revalidation warning (ignored):", e)
        }
        
        return { success: true }
    } catch (error: any) {
        console.error("[TRANSACTION_DELETE_ERROR]", error)
        return { success: false, error: error.message || "Błąd podczas usuwania transakcji." }
    }
}

export async function addTransaction(formData: FormData): Promise<{ success: boolean, error?: string }> {
    try {
        const adminDb = getAdminDb()
        const amountStr = formData.get("amount") as string
        const dateStr = formData.get("date") as string
        const category = formData.get("category") as string
        const rawProjectId = formData.get("projectId") as string
        const description = formData.get("description") as string
        const type = formData.get("type") as string || "KOSZT"
        const source = formData.get("source") as string || "MANUAL"

        if (!amountStr || !dateStr || !category) {
            return { success: false, error: "Pola Kwota, Data i Kategoria są wymagane." }
        }

        const tenantId = await getCurrentTenantId()
        const amount = Number(amountStr)
        const transactionDate = new Date(dateStr)
        
        const projectId = (!rawProjectId || rawProjectId === "none" || rawProjectId === "NONE") ? null : rawProjectId;
        const classification = projectId ? "PROJECT_COST" : "GENERAL_COST";

        // 1. Firestore Save
        const docRef = await adminDb.collection("transactions").add({
            tenantId,
            projectId,
            classification,
            amount,
            type,
            transactionDate: transactionDate.toISOString(),
            category,
            status: "ACTIVE",
            source,
            description: description || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })

        // 2. Prisma Sync
        await prisma.transaction.create({
            data: {
                id: docRef.id,
                tenantId,
                projectId,
                classification,
                amount: amount,
                type,
                transactionDate,
                category,
                status: "ACTIVE",
                source,
                description: description || null
            }
        })

        try {
            revalidatePath("/")
            revalidatePath("/projects")
            revalidatePath("/finance")
        } catch (e) {
            console.warn("[TRANSACTIONS] Revalidation warning (ignored):", e)
        }

        return { success: true }
    } catch (error: any) {
        console.error("[TRANSACTION_ADD_ERROR]", error)
        return { success: false, error: error.message || "Błąd podczas dodawania transakcji." }
    }
}
export async function assignTransactionToProject(transactionId: string, projectId: string) {
    if (!transactionId || !projectId || projectId === "none" || projectId === "NONE") {
        throw new Error("ID transakcji oraz ID projektu są wymagane.")
    }

    try {
        const adminDb = getAdminDb()
        const tenantId = await getCurrentTenantId()

        // 1. Firestore Update
        await adminDb.collection("transactions").doc(transactionId).update({
            projectId,
            classification: "PROJECT_COST",
            updatedAt: new Date().toISOString()
        })

        // 2. Prisma Sync
        await prisma.transaction.update({
            where: { id: transactionId },
            data: {
                projectId,
                classification: "PROJECT_COST"
            }
        })

        revalidatePath("/finance")
        revalidatePath("/projects")
        revalidatePath("/")

        return { success: true }
    } catch (error: any) {
        console.error("[ASSIGN_TRANSACTION_ERROR]", error)
        return { success: false, error: error.message || "Nie udało się przypisać transakcji do projektu." }
    }
}
