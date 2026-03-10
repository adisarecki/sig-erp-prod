"use server"

import { PrismaClient } from "@prisma/client"
import { revalidatePath } from "next/cache"

const prisma = new PrismaClient()

// Funkcja pomocnicza aby zdobyć ID dzierżawy dla środowiska MVP (bez autoryzacji sesji)
async function getCurrentTenantId() {
    const tenant = await prisma.tenant.findFirst()
    if (!tenant) throw new Error("Brak ustawionego środowiska (Dzierżawy). Uruchom seed!")
    return tenant.id
}

export async function addContractor(formData: FormData) {
    const name = formData.get("name") as string
    const nip = formData.get("nip") as string
    const address = formData.get("address") as string
    const status = formData.get("status") as string

    if (!name) {
        throw new Error("Nazwa firmy jest wymagana.")
    }

    const tenantId = await getCurrentTenantId()

    await prisma.contractor.create({
        data: {
            tenantId,
            name,
            nip: nip || null,
            address: address || null,
            status: status || "ACTIVE",
        }
    })

    // Odśwież widok CRM
    revalidatePath("/crm")
    return { success: true }
}
