"use server"

import { PrismaClient } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { Decimal } from "decimal.js"

const prisma = new PrismaClient()

export async function addProjectStage(projectId: string, name: string, budget: number) {
    try {
        await prisma.projectStage.create({
            data: {
                projectId,
                name,
                budgetEstimated: new Decimal(budget),
                status: "PENDING"
            }
        })
        revalidatePath(`/projects/${projectId}`)
        return { success: true }
    } catch (error) {
        console.error("Error adding project stage:", error)
        return { success: false, error: "Błąd podczas dodawania etapu." }
    }
}

export async function updateProjectStage(id: string, name: string, budget: number) {
    try {
        const stage = await prisma.projectStage.update({
            where: { id },
            data: {
                name,
                budgetEstimated: new Decimal(budget)
            }
        })
        revalidatePath(`/projects/${stage.projectId}`)
        return { success: true }
    } catch (error) {
        console.error("Error updating project stage:", error)
        return { success: false, error: "Błąd podczas aktualizacji etapu." }
    }
}

export async function deleteProjectStage(id: string, projectId: string) {
    try {
        await prisma.projectStage.delete({
            where: { id }
        })
        revalidatePath(`/projects/${projectId}`)
        return { success: true }
    } catch (error) {
        console.error("Error deleting project stage:", error)
        return { success: false, error: "Błąd podczas usuwania etapu." }
    }
}

export async function updateStageStatus(id: string, projectId: string, status: string) {
    try {
        await prisma.projectStage.update({
            where: { id },
            data: { status }
        })
        revalidatePath(`/projects/${projectId}`)
        return { success: true }
    } catch (error) {
        console.error("Error updating stage status:", error)
        return { success: false, error: "Błąd podczas aktualizacji statusu etapu." }
    }
}
