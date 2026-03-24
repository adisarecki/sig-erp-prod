"use server"

import { revalidatePath } from "next/cache"
import { getCurrentTenantId } from "@/lib/tenant"
import { getAdminDb } from "@/lib/firebaseAdmin"
import prisma from "@/lib/prisma"
import Decimal from "decimal.js"

export async function getRetentions() {
    try {
        const tenantId = await getCurrentTenantId()
        const retentions = await (prisma as any).retention.findMany({
            where: { tenantId },
            include: {
                project: true,
                contractor: true
            },
            orderBy: { expiryDate: 'asc' }
        })
        return retentions
    } catch (error) {
        console.error("[GET_RETENTIONS_ERROR]", error)
        return []
    }
}

export async function addRetention(formData: FormData) {
    try {
        const tenantId = await getCurrentTenantId()
        const adminDb = getAdminDb()

        const amount = formData.get("amount") as string
        const type = formData.get("type") as string // SHORT_TERM / LONG_TERM
        const expiryDateStr = formData.get("expiryDate") as string
        const description = formData.get("description") as string
        const projectId = formData.get("projectId") as string || null
        const contractorId = formData.get("contractorId") as string || null
        const source = (formData.get("source") as string) || "MANUAL"

        if (!amount || !expiryDateStr || !type) {
            throw new Error("Kwota, typ oraz data wygaśnięcia są wymagane.")
        }

        const expiryDate = new Date(expiryDateStr)
        const numericAmount = new Decimal(amount).toNumber()

        const retentionRef = adminDb.collection("retentions").doc()
        const retentionId = retentionRef.id

        const data = {
            tenantId,
            projectId,
            contractorId,
            amount: numericAmount,
            type,
            expiryDate: expiryDate.toISOString(),
            source,
            description,
            status: "ACTIVE",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }

        await retentionRef.set(data)

        try {
            await (prisma as any).retention.create({
                data: {
                    id: retentionId,
                    tenantId,
                    projectId,
                    contractorId,
                    amount: numericAmount,
                    type,
                    expiryDate,
                    source,
                    description,
                    status: "ACTIVE"
                }
            })
        } catch (prismaError) {
            await retentionRef.delete()
            throw prismaError
        }

        revalidatePath("/")
        revalidatePath("/finance")
        return { success: true }
    } catch (error: any) {
        console.error("[ADD_RETENTION_ERROR]", error)
        return { success: false, error: error.message }
    }
}

export async function updateRetentionStatus(id: string, status: string) {
    try {
        const tenantId = await getCurrentTenantId()
        const adminDb = getAdminDb()

        await adminDb.collection("retentions").doc(id).update({
            status,
            updatedAt: new Date().toISOString()
        })

        await (prisma as any).retention.update({
            where: { id, tenantId },
            data: { status }
        })

        revalidatePath("/")
        revalidatePath("/finance")
        return { success: true }
    } catch (error: any) {
        console.error("[UPDATE_RETENTION_STATUS_ERROR]", error)
        return { success: false, error: error.message }
    }
}

/**
 * Automatyczna synchronizacja kaucji z projektu
 * Wywoływana przy tworzeniu/edycji projektu.
 */
export async function syncRetentionsFromProject(projectId: string, budget: number, shortRate: number, longRate: number) {
    try {
        const tenantId = await getCurrentTenantId()
        const adminDb = getAdminDb()
        
        // Pobierz aktualne kaucje dla tego projektu (source: PROJECT)
        const existing = await (prisma as any).retention.findMany({
            where: { projectId, source: "PROJECT", tenantId }
        })

        // Oblicz kwoty
        const shortAmount = new Decimal(budget).mul(shortRate).toNumber()
        const longAmount = new Decimal(budget).mul(longRate).toNumber()

        // 1. Kaucja Krótka
        const shortType = "SHORT_TERM"
        const existingShort = (existing as any[]).find((r: any) => r.type === shortType)
        if (shortAmount > 0) {
            const expiryDate = new Date()
            expiryDate.setFullYear(expiryDate.getFullYear() + 1) // Default 1 year for short term
            
            if (existingShort) {
                await adminDb.collection("retentions").doc(existingShort.id).update({
                    amount: shortAmount,
                    updatedAt: new Date().toISOString()
                })
                await (prisma as any).retention.update({
                    where: { id: existingShort.id },
                    data: { amount: shortAmount }
                })
            } else {
                const fd = new FormData()
                fd.append("amount", shortAmount.toString())
                fd.append("type", shortType)
                fd.append("expiryDate", expiryDate.toISOString())
                fd.append("projectId", projectId)
                fd.append("source", "PROJECT")
                fd.append("description", "Automatyczna kaucja krótkookresowa z projektu")
                await addRetention(fd)
            }
        }

        // 2. Kaucja Długa
        const longType = "LONG_TERM"
        const existingLong = (existing as any[]).find((r: any) => r.type === longType)
        if (longAmount > 0) {
            const expiryDate = new Date()
            expiryDate.setFullYear(expiryDate.getFullYear() + 3) // Default 3 years for long term
            
            if (existingLong) {
                await adminDb.collection("retentions").doc(existingLong.id).update({
                    amount: longAmount,
                    updatedAt: new Date().toISOString()
                })
                await (prisma as any).retention.update({
                    where: { id: existingLong.id },
                    data: { amount: longAmount }
                })
            } else {
                const fd = new FormData()
                fd.append("amount", longAmount.toString())
                fd.append("type", longType)
                fd.append("expiryDate", expiryDate.toISOString())
                fd.append("projectId", projectId)
                fd.append("source", "PROJECT")
                fd.append("description", "Automatyczna kaucja długookresowa z projektu")
                await addRetention(fd)
            }
        }
        
        return { success: true }
    } catch (error) {
        console.error("[SYNC_RETENTIONS_ERROR]", error)
        return { success: false }
    }
}
