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
 * Automatyczna synchronizacja kaucji z projektu (METADATA ONLY)
 * Vector 117: Ta funkcja tworzy rekordy Retention o statusie ESTIMATED, 
 * które służą wyłącznie do celów informacyjnych w Cockpicie.
 * NIE generuje wpisów RETENTION_LOCK w centralnym Ledgerze.
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

        // Oblicz daty
        let shortExpiryDate = new Date()
        let longExpiryDate = new Date()

        if (estimatedCompletionDate) {
            shortExpiryDate = new Date(estimatedCompletionDate)
            shortExpiryDate.setDate(shortExpiryDate.getDate() + 30)

            longExpiryDate = new Date(estimatedCompletionDate)
            longExpiryDate.setFullYear(longExpiryDate.getFullYear() + (warrantyPeriodYears || 0))
        } else {
            shortExpiryDate.setFullYear(shortExpiryDate.getFullYear() + 1)
            longExpiryDate.setFullYear(longExpiryDate.getFullYear() + 3)
        }

        // Vector 117: Status zawsze ESTIMATED dla wpisów projektowych (niefinansowych)
        const retentionStatus = forceStatus || "ESTIMATED"

        // 1. Kaucja Krótka
        const shortType = "SHORT_TERM"
        const existingShort = (existing as any[]).find((r: any) => r.type === shortType)
        if (shortAmount > 0) {
            if (existingShort) {
                const updateData: any = {
                    amount: shortAmount,
                    expiryDate: shortExpiryDate.toISOString(),
                    status: retentionStatus,
                    updatedAt: new Date().toISOString()
                }

                await adminDb.collection("retentions").doc(existingShort.id).update(updateData)
                await (prisma as any).retention.update({
                    where: { id: existingShort.id },
                    data: {
                        amount: shortAmount,
                        expiryDate: shortExpiryDate,
                        status: retentionStatus
                    }
                })
            } else {
                const retentionRef = adminDb.collection("retentions").doc()
                const data = {
                    tenantId,
                    projectId,
                    amount: shortAmount,
                    type: shortType,
                    expiryDate: shortExpiryDate.toISOString(),
                    source: "PROJECT",
                    description: "[ESTIMATED] Kaucja projektowa (prognoza)",
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
                        description: "[ESTIMATED] Kaucja projektowa (prognoza)",
                        status: retentionStatus
                    }
                })
            }
        }

        // 2. Kaucja Długa
        const longType = "LONG_TERM"
        const existingLong = (existing as any[]).find((r: any) => r.type === longType)
        if (longAmount > 0) {
            if (existingLong) {
                const updateData: any = {
                    amount: longAmount,
                    expiryDate: longExpiryDate.toISOString(),
                    status: retentionStatus,
                    updatedAt: new Date().toISOString()
                }

                await adminDb.collection("retentions").doc(existingLong.id).update(updateData)
                await (prisma as any).retention.update({
                    where: { id: existingLong.id },
                    data: {
                        amount: longAmount,
                        expiryDate: longExpiryDate,
                        status: retentionStatus
                    }
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
                    description: "[ESTIMATED] Kaucja projektowa (prognoza)",
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
                        description: "[ESTIMATED] Kaucja projektowa (prognoza)",
                        status: retentionStatus
                    }
                })
            }
        }
        
        return { success: true }
    } catch (error) {
        console.error("[SYNC_RETENTIONS_ERROR]", error)
        return { success: false }
    }
}
