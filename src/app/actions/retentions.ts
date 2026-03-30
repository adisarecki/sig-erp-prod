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
                contractor: true,
                invoice: true
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
        const invoiceId = formData.get("invoiceId") as string || null
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
            invoiceId,
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
                    tenant: { connect: { id: tenantId } },
                    project: projectId ? { connect: { id: projectId } } : undefined,
                    contractor: contractorId ? { connect: { id: contractorId } } : undefined,
                    invoice: invoiceId ? { connect: { id: invoiceId } } : undefined,
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
    warrantyPeriodYears: number = 0,
    forceStatus?: string
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

        const retentionStatus = forceStatus || "DRAFT"

        // 1. Kaucja Krótka
        const shortType = "SHORT_TERM"
        const existingShort = (existing as any[]).find((r: any) => r.type === shortType)
        if (shortAmount > 0) {
            if (existingShort) {
                const updateData: any = {
                    amount: shortAmount,
                    expiryDate: shortExpiryDate.toISOString(),
                    updatedAt: new Date().toISOString()
                }
                if (forceStatus) updateData.status = forceStatus

                await adminDb.collection("retentions").doc(existingShort.id).update(updateData)
                
                const prismaUpdate: any = {
                    amount: shortAmount,
                    expiryDate: shortExpiryDate
                }
                if (forceStatus) prismaUpdate.status = forceStatus

                await (prisma as any).retention.update({
                    where: { id: existingShort.id },
                    data: prismaUpdate
                })
            } else {
                // Manually create to ensure correct status
                const retentionRef = adminDb.collection("retentions").doc()
                const data = {
                    tenantId,
                    projectId,
                    amount: shortAmount,
                    type: shortType,
                    expiryDate: shortExpiryDate.toISOString(),
                    source: "PROJECT",
                    description: "Automatyczna kaucja krótkookresowa z projektu",
                    status: retentionStatus,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
                await retentionRef.set(data)
                await (prisma as any).retention.create({
                    data: {
                        id: retentionRef.id,
                        tenant: { connect: { id: tenantId } },
                        project: { connect: { id: projectId } },
                        amount: shortAmount,
                        type: shortType,
                        expiryDate: shortExpiryDate,
                        source: "PROJECT",
                        description: "Automatyczna kaucja krótkookresowa z projektu",
                        status: retentionStatus
                    }
                })
            }
        } else if (existingShort) {
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
                const updateData: any = {
                    amount: longAmount,
                    expiryDate: longExpiryDate.toISOString(),
                    updatedAt: new Date().toISOString()
                }
                if (forceStatus) updateData.status = forceStatus

                await adminDb.collection("retentions").doc(existingLong.id).update(updateData)
                
                const prismaUpdate: any = {
                    amount: longAmount,
                    expiryDate: longExpiryDate
                }
                if (forceStatus) prismaUpdate.status = forceStatus

                await (prisma as any).retention.update({
                    where: { id: existingLong.id },
                    data: prismaUpdate
                })
            } else {
                const retentionRef = adminDb.collection("retentions").doc()
                const data = {
                    tenantId,
                    projectId,
                    amount: longAmount,
                    type: longType,
                    expiryDate: longExpiryDate.toISOString(),
                    source: "PROJECT",
                    description: "Automatyczna kaucja długookresowa z projektu",
                    status: retentionStatus,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
                await retentionRef.set(data)
                await (prisma as any).retention.create({
                    data: {
                        id: retentionRef.id,
                        tenant: { connect: { id: tenantId } },
                        project: { connect: { id: projectId } },
                        amount: longAmount,
                        type: longType,
                        expiryDate: longExpiryDate,
                        source: "PROJECT",
                        description: "Automatyczna kaucja długookresowa z projektu",
                        status: retentionStatus
                    }
                })
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
