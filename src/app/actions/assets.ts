"use server"

import { revalidatePath } from "next/cache"
import Decimal from "decimal.js"
import { getCurrentTenantId } from "@/lib/tenant"
import { getAdminDb } from "@/lib/firebaseAdmin"
import prisma from "@/lib/prisma"
import { subDays } from "date-fns"
// @ts-ignore - Prisma environment lag: Asset model exists in schema.prisma and was generated.
const db = prisma as any;
import { checkAssetConsistency } from "@/lib/sync/consistency-engine"
import { recordLedgerEntry } from "@/lib/finance/ledger-manager"
import { assertAuthorityWrite, assertFinancialMasterWrite } from "@/lib/authority/guards"

export type CreateAssetInput = {
    name: string
    category: 'ELEKTRONARZEDZIA' | 'BIURO' | 'INNE'
    serialNumber?: string
    notes?: string
    assignedUserId?: string
    assignedProjectId?: string
    sourceInvoiceId?: string
    supplierId?: string
}

export async function createAssetFromKsef(invoiceId: string, input: CreateAssetInput) {
    try {
        const tenantId = await getCurrentTenantId()

        const asset = await (prisma.asset as any).create({
            data: {
                tenantId,
                ...input,
                sourceInvoiceId: invoiceId,
                status: 'AVAILABLE' as any
            }
        })

        revalidatePath("/fleet-and-tools")
        return { success: true, id: asset.id }
    } catch (error: any) {
        console.error("[CREATE_ASSET_FROM_KSEF_ERROR]", error)
        return { success: false, error: error.message }
    }
}

export async function addManualAsset(input: CreateAssetInput) {
    try {
        const tenantId = await getCurrentTenantId()

        const asset = await (prisma.asset as any).create({
            data: {
                tenantId,
                ...input,
                status: 'AVAILABLE' as any
            }
        })

        revalidatePath("/fleet-and-tools")
        return { success: true, id: asset.id }
    } catch (error: any) {
        console.error("[ADD_MANUAL_ASSET_ERROR]", error)
        return { success: false, error: error.message }
    }
}

export async function getAssetSummary() {
    try {
        const tenantId = await getCurrentTenantId()
        const thirtyDaysAgo = subDays(new Date(), 30)

        const assets = await (prisma.asset as any).findMany({
            where: { tenantId },
            include: {
                invoices: {
                    where: { issueDate: { gte: thirtyDaysAgo } },
                    orderBy: { issueDate: 'desc' },
                },
                transactions: {
                    where: { transactionDate: { gte: thirtyDaysAgo } },
                    orderBy: { transactionDate: 'desc' },
                }
            }
        })

        const summary = assets.map((a: any) => {
            const operationalCost30d = a.invoices.reduce((sum: number, inv: any) => sum + Number(inv.amountGross), 0)
            const cashOutflow30d = a.transactions.reduce((sum: number, tx: any) => sum + Number(tx.amount), 0)

            const lastInvoiceDate = a.invoices[0]?.issueDate || null
            const lastTxDate = a.transactions[0]?.transactionDate || null
            const lastCostDate = (lastInvoiceDate && lastTxDate)
                ? (lastInvoiceDate > lastTxDate ? lastInvoiceDate : lastTxDate)
                : (lastInvoiceDate || lastTxDate)

            return {
                ...a,
                operationalCost30d,
                cashOutflow30d: Math.abs(cashOutflow30d),
                lastCostDate
            }
        })

        return { success: true, summary }
    } catch (error: any) {
        console.error("[GET_ASSET_SUMMARY_ERROR]", error)
        return { success: false, error: error.message }
    }
}

export async function updateAssetStatus(id: string, status: string) {
    try {
        const tenantId = await getCurrentTenantId()

        await (prisma.asset as any).update({
            where: { id, tenantId },
            data: { status: status as any }
        })

        revalidatePath("/fleet-and-tools")
        return { success: true }
    } catch (error: any) {
        console.error("[UPDATE_ASSET_STATUS_ERROR]", error)
        return { success: false, error: error.message }
    }
}
