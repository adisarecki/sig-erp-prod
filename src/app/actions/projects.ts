"use server"

import { PrismaClient } from "@prisma/client"
import { revalidatePath } from "next/cache"

const prisma = new PrismaClient()

async function getCurrentTenantId() {
    const tenant = await prisma.tenant.findFirst()
    if (!tenant) throw new Error("Brak ustawionego środowiska (Dzierżawy). Uruchom seed!")
    return tenant.id
}

export async function addProject(formData: FormData) {
    const name = formData.get("name") as string
    const contractorId = formData.get("contractorId") as string
    const objectId = formData.get("objectId") as string
    const budgetEstimated = formData.get("budgetEstimated") as string
    const description = formData.get("description") as string

    if (!name || !contractorId || !budgetEstimated) {
        throw new Error("Wymagane pola to: Nazwa Projektu, Kontrahent oraz Budżet Szacowany.")
    }

    const tenantId = await getCurrentTenantId()

    // Gdy podano ID Obiektu i chcemy podpiąć. (Dla MVP upraszczamy, można ominąć wymóg obiektu, ale typ w Prisma może go wymagać tak by default? Zobaczymy.)
    // W Prisma model: objectId String (nie jest optional). Jednak zrobimy to jako podpięcie pierwszego lepszego obiektu przypisanego do Kontrahenta, lub jeśli żaden nie istnieje, stworzymy fikcyjny "Główny Obiekt".

    let targetObjectId = objectId

    if (!targetObjectId) {
        // Sprawdzmy czy kontrahent ma obiekty
        const existingObject = await prisma.object.findFirst({
            where: { contractorId }
        })

        if (existingObject) {
            targetObjectId = existingObject.id
        } else {
            // Stworzymy podstawowy obiekt z racji blokady FK
            const newObj = await prisma.object.create({
                data: {
                    contractorId: contractorId,
                    name: "Siedziba Główna",
                }
            })
            targetObjectId = newObj.id
        }
    }

    await prisma.project.create({
        data: {
            tenantId,
            name,
            contractorId,
            objectId: targetObjectId,
            budgetEstimated: budgetEstimated,
            budgetUsed: "0",
            status: "PLANNED",
            type: "NOWY", // Wymagany np. "INSTALACJA"
        }
    })

    // Odśwież Dashboard i listę projektów
    revalidatePath("/projects")
    revalidatePath("/")

    return { success: true }
}
export async function archiveProject(id: string) {
    if (!id) throw new Error("ID projektu jest wymagane.")

    await prisma.project.update({
        where: { id },
        data: {
            lifecycleStatus: "ARCHIVED"
        }
    })

    revalidatePath("/projects")
    revalidatePath("/")

    return { success: true }
}
