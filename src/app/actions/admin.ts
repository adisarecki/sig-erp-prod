"use server"

import { PrismaClient } from "@prisma/client"
import { revalidatePath } from "next/cache"

const prisma = new PrismaClient()

async function getCurrentTenantId() {
    const tenant = await prisma.tenant.findFirst()
    if (!tenant) throw new Error("Brak ustawionego środowiska (Dzierżawy).")
    return tenant.id
}

/**
 * Czyści wszystkie dane operacyjne (Transakcje, Faktury, Projekty, Obiekty, Kontrahenci)
 * dla aktualnego tenantId. Nie usuwa Użytkowników ani samej Dzierżawy.
 */
export async function resetOperationalData() {
    const tenantId = await getCurrentTenantId()

    // Usuwanie w kolejności zależnej od kluczy obcych (zaczynamy od najbardziej zależnych)

    // 1. Płatności i Transakcje (Transakcje są powiązane z płatnościami faktur)
    // Cascade w Prisma obsłuży Payment przy usunięciu Transaction, ale zrobimy to jawnie dla pewności.
    await prisma.payment.deleteMany({
        where: { invoice: { tenantId } }
    })
    await prisma.transaction.deleteMany({ where: { tenantId } })

    // 2. Faktury
    await prisma.invoice.deleteMany({ where: { tenantId } })

    // 3. Etapy Projektów (ProjectStage)
    await prisma.projectStage.deleteMany({
        where: { project: { tenantId } }
    })

    // 4. Projekty
    await prisma.project.deleteMany({ where: { tenantId } })

    // 5. Obiekty i Kontrahenci
    await prisma.object.deleteMany({
        where: { contractor: { tenantId } }
    })
    await prisma.contractor.deleteMany({ where: { tenantId } })

    // 6. Bankowość (Opcjonalnie, ale dla Hard Resetu wyczyścimy też to co operacyjne)
    await prisma.bankTransactionRaw.deleteMany({ where: { tenantId } })
    await prisma.bankAccount.deleteMany({ where: { tenantId } })

    revalidatePath("/")
    revalidatePath("/projects")
    revalidatePath("/crm")
    revalidatePath("/finance")
    revalidatePath("/settings")

    return { success: true }
}
