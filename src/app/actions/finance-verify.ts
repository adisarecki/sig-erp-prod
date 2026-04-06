"use server"

import prisma from "@/lib/prisma"
import { getCurrentTenantId } from "@/lib/tenant"
import { PkoBpCsvAdapter } from "@/lib/bank/pko-bp-adapter"
import { ReconciliationEngine } from "@/lib/bank/reconciliation-engine"
import { revalidatePath } from "next/cache"
import Decimal from "decimal.js"

export async function verifyAndImportBankStatement(csvContent: string) {
    const tenantId = await getCurrentTenantId()
    
    try {
        // 1. Parse CSV
        const transactions = PkoBpCsvAdapter.parse(csvContent)
        if (transactions.length === 0) {
            return { success: false, error: "Nie znaleziono transakcji w pliku." }
        }

        // 2. Identify the latest Balance Anchor (last entry in PKO BP ledger)
        const latestTx = transactions[0]; // Assuming descending order or we take the one with latest date
        // PKO BP usually lists newest first. Let's find the one with the latest date/index.
        const anchorBalance = latestTx.balanceAfter;

        // 3. Process Bank Inbox (Vector 104/105 logic)
        // We first load into BankInbox, then process
        for (const tx of transactions) {
            const existing = await (prisma as any).bankStaging.findFirst({
                where: {
                    tenantId,
                    date: tx.date,
                    amount: tx.amount,
                    title: tx.title
                }
            })

            if (!existing) {
                // @ts-ignore
                await prisma.bankStaging.create({
                    data: {
                        tenantId,
                        date: tx.date,
                        amount: tx.amount,
                        rawType: tx.rawType,
                        counterpartyName: tx.counterpartyName,
                        title: tx.title,
                        status: 'PENDING'
                    }
                })
            }
        }

        // Run the engine
        await ReconciliationEngine.processBankStaging(tenantId)

        // 4. Verification Engine (Vector 106)
        const result = await ReconciliationEngine.verifyIntegrity(tenantId, anchorBalance)

        revalidatePath("/")
        revalidatePath("/finance/verify-balance")

        return { 
            success: true, 
            data: {
                ledgerSum: result.ledgerSum.toNumber(),
                physicalBalance: result.physicalBalance.toNumber(),
                delta: result.delta.toNumber(),
                status: result.status
            }
        }
    } catch (error: any) {
        console.error("VERIFY_IMPORT_ERR:", error)
        return { success: false, error: error.message || "Błąd podczas procesowania wyciągu." }
    }
}
