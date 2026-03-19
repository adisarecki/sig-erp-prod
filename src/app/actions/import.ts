"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getCurrentTenantId } from "@/lib/tenant"
import type { ParsedBankTransaction } from "@/lib/pko-parser"
import Decimal from "decimal.js"

/**
 * Imports bank transactions and AUTO-CREATES missing contractors.
 * "Silent Import" strategy: no modals, just efficient data ingestion.
 */
export async function importBankStatement(transactions: ParsedBankTransaction[]) {
    const tenantId = await getCurrentTenantId()
    const results = { added: 0, skipped: 0, errors: 0, newContractors: 0 }

    // Get a default bank account for now (MVP simplification)
    const bankAccount = await prisma.bankAccount.findFirst({
        where: { tenantId }
    })
    
    if (!bankAccount) {
        throw new Error("Brak zdefiniowanego konta bankowego. Dodaj konto w Ustawieniach.")
    }

    for (const tx of transactions) {
        try {
            // 1. Resolve Contractor (Auto-Create if missing)
            let contractorId: string | null = null

            // Find by NIP first (strongest match)
            if (tx.contractor.nip) {
                const found = await prisma.contractor.findFirst({
                    where: { tenantId, nip: tx.contractor.nip }
                })
                if (found) contractorId = found.id
            }

            // Find by exact Name match if NIP didn't work or was missing
            if (!contractorId) {
                const found = await prisma.contractor.findFirst({
                    where: { tenantId, name: { equals: tx.contractor.name, mode: 'insensitive' } }
                })
                if (found) contractorId = found.id
            }

            // Auto-Create if still missing
            if (!contractorId) {
                const newCtr = await prisma.contractor.create({
                    data: {
                        tenantId,
                        name: tx.contractor.name,
                        nip: tx.contractor.nip,
                        address: tx.contractor.address,
                        status: "ACTIVE"
                    }
                })
                contractorId = newCtr.id
                results.newContractors++
            }

            // 2. Create BankTransactionRaw
            // Prevent duplicates by checking if transaction with same date/amount/desc exists
            const existing = await prisma.bankTransactionRaw.findFirst({
                where: {
                    tenantId,
                    bankAccountId: bankAccount.id,
                    bookingDate: tx.date,
                    rawAmount: new Decimal(tx.amount),
                    description: { equals: tx.description, mode: 'insensitive' }
                }
            })

            if (existing) {
                results.skipped++
                continue
            }

            await prisma.bankTransactionRaw.create({
                data: {
                    tenantId,
                    bankAccountId: bankAccount.id,
                    bookingDate: tx.date,
                    rawAmount: new Decimal(tx.amount),
                    description: tx.description,
                    senderName: tx.contractor.name,
                    status: "UNPAIRED"
                }
            })

            results.added++
        } catch (e) {
            console.error("Błąd importu pojedynczej transakcji:", e)
            results.errors++
        }
    }

    revalidatePath("/finance/reconciliation")
    revalidatePath("/")
    revalidatePath("/crm")

    return results
}

export async function importContractors(contractorsToImport: { name: string, nip: string | null, address: string | null }[]) {
    const tenantId = await getCurrentTenantId()
    const results = { added: 0, skipped: 0, errors: 0 }

    for (const c of contractorsToImport) {
        try {
            if (c.nip) {
                const existing = await prisma.contractor.findFirst({
                    where: { tenantId, nip: c.nip }
                })
                if (existing) {
                    results.skipped++
                    continue;
                }
            }

            const existingName = await prisma.contractor.findFirst({
                where: { tenantId, name: c.name }
            })
            
            if (existingName) {
                results.skipped++
                continue;
            }

            await prisma.contractor.create({
                data: {
                    tenantId,
                    name: c.name,
                    nip: c.nip,
                    address: c.address,
                    status: "ACTIVE"
                }
            })
            results.added++
        } catch (e) {
            console.error("Błąd zapisu kontrahenta z importu:", e)
            results.errors++
        }
    }

    revalidatePath("/")
    revalidatePath("/crm")
    revalidatePath("/projects")
    revalidatePath("/finance")

    return results
}
