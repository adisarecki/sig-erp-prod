"use server"

import { revalidatePath } from "next/cache"
import { getCurrentTenantId } from "@/lib/tenant"
import { adminDb } from "@/lib/firebase/admin"

export async function addTransaction(formData: FormData) {
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

    await adminDb.collection("transactions").add({
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

    revalidatePath("/")
    revalidatePath("/projects")
    revalidatePath("/finance")

    return { success: true }
}
