"use server"

import prisma from "@/lib/prisma"
import { getCurrentTenantId } from "@/lib/tenant"
import { revalidatePath } from "next/cache"
import { ReconciliationEngine } from "@/lib/bank/reconciliation-engine"
import Decimal from "decimal.js"

export async function confirmAutoMatch(bankStagingId: string, invoiceId: string) {
    const tenantId = await getCurrentTenantId()
    try {
        const item = await (prisma as any).bankStaging.findUnique({
            where: { id: bankStagingId, tenantId }
        })
        if (!item) throw new Error("Nie znaleziono wpisu BankStaging")

        // Use the existing logic to calculate retention, update invoice, create ledger
        await ReconciliationEngine.executeAutoMatch(item, invoiceId)

        revalidatePath("/finance/verify-balance")
        revalidatePath("/finance/reconciliation")
        revalidatePath("/finance")
        return { success: true }
    } catch (e: any) {
        console.error("CONFIRM_AUTO_MATCH_ERR:", e)
        return { success: false, error: e.message }
    }
}

export async function manualLinkTransaction(bankStagingId: string, invoiceId: string) {
    // This effectively functions the same as confirmAutoMatch if we are linking to an invoice
    return confirmAutoMatch(bankStagingId, invoiceId)
}

export async function createOnTheFly(bankStagingId: string, projectId: string | null, category: string, classification: string) {
    const tenantId = await getCurrentTenantId()
    try {
        const item = await (prisma as any).bankStaging.findUnique({
            where: { id: bankStagingId, tenantId }
        })
        if (!item) throw new Error("Nie znaleziono wpisu BankStaging")

        await prisma.$transaction(async (tx) => {
            const isIncome = item.amount > 0;
            const type = isIncome ? "INCOME" : "EXPENSE";

            const transaction = await tx.transaction.create({
                data: {
                    tenantId,
                    projectId: projectId || null,
                    amount: Math.abs(item.amount),
                    type,
                    transactionDate: item.date,
                    category,
                    description: `[Manual Create] ${item.counterpartyName}: ${item.title || "Nieznany"}`,
                    source: "BANK_IMPORT",
                    status: "ACTIVE",
                    classification,
                    title: item.title,
                    counterpartyRaw: item.counterpartyName
                }
            })

            // Create ledger entry
            // @ts-ignore
            await tx.ledgerEntry.create({
                data: {
                    tenantId,
                    projectId: projectId || null,
                    source: "BANK_PAYMENT",
                    sourceId: transaction.id,
                    amount: item.amount,
                    type,
                    date: item.date
                }
            })

            // Update bank staging status
            // @ts-ignore
            await tx.bankStaging.update({
                where: { id: item.id },
                data: {
                    status: "PROCESSED",
                    processedAt: new Date()
                }
            })
        })

        revalidatePath("/finance/verify-balance")
        revalidatePath("/finance/reconciliation")
        revalidatePath("/finance")
        return { success: true }
    } catch (e: any) {
        console.error("CREATE_ON_THE_FLY_ERR:", e)
        return { success: false, error: e.message }
    }
}
