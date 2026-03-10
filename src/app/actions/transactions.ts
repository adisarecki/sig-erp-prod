"use server"

import { PrismaClient } from "@prisma/client"
import { revalidatePath } from "next/cache"

const prisma = new PrismaClient()

async function getCurrentTenantId() {
    const tenant = await prisma.tenant.findFirst()
    if (!tenant) throw new Error("Brak ustawionego środowiska (Dzierżawy).")
    return tenant.id
}

export async function addTransaction(formData: FormData) {
    const amountStr = formData.get("amount") as string
    const dateStr = formData.get("date") as string
    const category = formData.get("category") as string
    const projectId = formData.get("projectId") as string
    const description = formData.get("description") as string
    const type = formData.get("type") as string || "KOSZT" // Domyślnie KOSZT

    if (!amountStr || !dateStr || !category) {
        throw new Error("Pola Kwota, Data i Kategoria są wymagane.")
    }

    const tenantId = await getCurrentTenantId()
    const amount = parseFloat(amountStr)
    const transactionDate = new Date(dateStr)

    await prisma.transaction.create({
        data: {
            tenantId,
            projectId: projectId || null,
            amount: amount,
            type,
            transactionDate,
            category,
            description: description || null,
        }
    })

    revalidatePath("/")
    revalidatePath("/projects")
    revalidatePath("/finance")

    return { success: true }
}
