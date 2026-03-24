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
export async function syncRetentionsFromProject(
    projectId: string, 
    budget: number, 
    shortRate: number, 
    longRate: number,
    estimatedCompletionDate?: Date | null,
    warrantyPeriodYears: number = 0
) {
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

        // Oblicz daty (Logic Update Phase 8)
        let shortExpiryDate = new Date()
        let longExpiryDate = new Date()

        if (estimatedCompletionDate) {
            // RetentionShort_Date = estimatedCompletionDate + 30 days
            shortExpiryDate = new Date(estimatedCompletionDate)
            shortExpiryDate.setDate(shortExpiryDate.getDate() + 30)

            // RetentionLong_Date = estimatedCompletionDate + warrantyPeriodYears
            longExpiryDate = new Date(estimatedCompletionDate)
            longExpiryDate.setFullYear(longExpiryDate.getFullYear() + (warrantyPeriodYears || 0))
        } else {
            // Fallback (jeśli brak daty zakończenia)
            shortExpiryDate.setFullYear(shortExpiryDate.getFullYear() + 1)
            longExpiryDate.setFullYear(longExpiryDate.getFullYear() + 3)
        }

        // 1. Kaucja Krótka
        const shortType = "SHORT_TERM"
        const existingShort = (existing as any[]).find((r: any) => r.type === shortType)
        if (shortAmount > 0) {
            if (existingShort) {
                await adminDb.collection("retentions").doc(existingShort.id).update({
                    amount: shortAmount,
                    expiryDate: shortExpiryDate.toISOString(),
                    updatedAt: new Date().toISOString()
                })
                await (prisma as any).retention.update({
                    where: { id: existingShort.id },
                    data: { 
                        amount: shortAmount,
                        expiryDate: shortExpiryDate
                    }
                })
            } else {
                const fd = new FormData()
                fd.append("amount", shortAmount.toString())
                fd.append("type", shortType)
                fd.append("expiryDate", shortExpiryDate.toISOString())
                fd.append("projectId", projectId)
                fd.append("source", "PROJECT")
                fd.append("description", "Automatyczna kaucja krótkookresowa z projektu")
                await addRetention(fd)
            }
        } else if (existingShort) {
            // Jeśli kwota spadła do 0, możemy usunąć lub zostawić z 0 (zostawiamy dla historii ale updateujemy datę)
            await adminDb.collection("retentions").doc(existingShort.id).update({
                amount: 0,
                expiryDate: shortExpiryDate.toISOString(),
                updatedAt: new Date().toISOString()
            })
            await (prisma as any).retention.update({
                where: { id: existingShort.id },
                data: { amount: 0, expiryDate: shortExpiryDate }
            })
        }

        // 2. Kaucja Długa
        const longType = "LONG_TERM"
        const existingLong = (existing as any[]).find((r: any) => r.type === longType)
        if (longAmount > 0) {
            if (existingLong) {
                await adminDb.collection("retentions").doc(existingLong.id).update({
                    amount: longAmount,
                    expiryDate: longExpiryDate.toISOString(),
                    updatedAt: new Date().toISOString()
                })
                await (prisma as any).retention.update({
                    where: { id: existingLong.id },
                    data: { 
                        amount: longAmount,
                        expiryDate: longExpiryDate
                    }
                })
            } else {
                const fd = new FormData()
                fd.append("amount", longAmount.toString())
                fd.append("type", longType)
                fd.append("expiryDate", longExpiryDate.toISOString())
                fd.append("projectId", projectId)
                fd.append("source", "PROJECT")
                fd.append("description", "Automatyczna kaucja długookresowa z projektu")
                await addRetention(fd)
            }
        } else if (existingLong) {
            await adminDb.collection("retentions").doc(existingLong.id).update({
                amount: 0,
                expiryDate: longExpiryDate.toISOString(),
                updatedAt: new Date().toISOString()
            })
            await (prisma as any).retention.update({
                where: { id: existingLong.id },
                data: { amount: 0, expiryDate: longExpiryDate }
            })
        }
        
        return { success: true }
    } catch (error) {
        console.error("[SYNC_RETENTIONS_ERROR]", error)
        return { success: false }
    }
}
