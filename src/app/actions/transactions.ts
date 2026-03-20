"use server"

import { revalidatePath } from "next/cache"
import { getCurrentTenantId } from "@/lib/tenant"
import { getAdminDb } from "@/lib/firebaseAdmin"
import prisma from "@/lib/prisma"

export async function deleteTransaction(id: string) {
    const adminDb = getAdminDb()
    const tenantId = await getCurrentTenantId()

    try {
        // 1. Usuwanie z Firestore
        await adminDb.collection("transactions").doc(id).delete()

        // 2. Usuwanie z Prisma
        await prisma.transaction.delete({ where: { id } })

        revalidatePath("/finance")
        revalidatePath("/projects")
        revalidatePath("/")
        
        return { success: true }
    } catch (error) {
        console.error("[TRANSACTION_DELETE_ERROR]", error)
        throw error
    }
}

export async function addTransaction(formData: FormData) {
    const adminDb = getAdminDb()
    const amountStr = formData.get("amount") as string
    const dateStr = formData.get("date") as string
    const category = formData.get("category") as string
    const rawProjectId = formData.get("projectId") as string
    const description = formData.get("description") as string
    const type = formData.get("type") as string || "KOSZT"
    const source = formData.get("source") as string || "MANUAL"

    if (!amountStr || !dateStr || !category) {
        throw new Error("Pola Kwota, Data i Kategoria są wymagane.")
    }

    const tenantId = await getCurrentTenantId()
    const amount = Number(amountStr)
    const transactionDate = new Date(dateStr)
    
    const projectId = (!rawProjectId || rawProjectId === "NONE") ? null : rawProjectId;

    // 1. Firestore Save
    const docRef = await adminDb.collection("transactions").add({
        tenantId,
        projectId,
        amount,
        type,
        transactionDate: transactionDate.toISOString(),
        category,
        status: "ACTIVE",
        source,
        description: description || null,
        createdAt: new Date().toISOString()
    })

    // 2. Prisma Sync
    await prisma.transaction.create({
        data: {
            id: docRef.id,
            tenantId,
            projectId,
            amount: amount,
            type,
            transactionDate,
            category,
            status: "ACTIVE",
            source,
            description: description || null
        }
    })

    revalidatePath("/")
    revalidatePath("/projects")
    revalidatePath("/finance")

    return { success: true }
}
