"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getAdminDb } from "@/lib/firebaseAdmin"
import { getCurrentTenantId } from "@/lib/tenant"
import type { ParsedBankTransaction } from "@/lib/pko-parser"
import Decimal from "decimal.js"

/**
 * Imports bank transactions and AUTO-CREATES missing contractors.
 * "Silent Import" strategy: no modals, just efficient data ingestion.
 * Follows Dual-Sync protocol (Firestore + Prisma).
 */
export async function importBankStatement(transactions: ParsedBankTransaction[], bankAccountId: string): Promise<{ success: boolean, results?: any, error?: string }> {
    try {
        const adminDb = getAdminDb()
        const tenantId = await getCurrentTenantId()
        const results = { added: 0, skipped: 0, errors: 0, newContractors: 0 }

        if (!bankAccountId) {
            return { success: false, error: "Brak wybranego konta bankowego. Wybierz konto przed importem." }
        }

        // Verify bank account exists for this tenant
        const bankAccount = await prisma.bankAccount.findFirst({
            where: { id: bankAccountId, tenantId }
        })
        
        if (!bankAccount) {
            return { success: false, error: "Wybrane konto bankowe jest nieprawidłowe lub nie należy do Twojej firmy." }
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

                // --- Dual-Sync Auto-Create if still missing ---
                if (!contractorId) {
                    // a. Create Firestore Record for ID consistency
                    const ctrRef = adminDb.collection("contractors").doc()
                    const objRef = adminDb.collection("objects").doc()
                    
                    await ctrRef.set({
                        tenantId,
                        name: tx.contractor.name,
                        nip: tx.contractor.nip || null,
                        address: tx.contractor.address || null,
                        type: "DOSTAWCA",
                        status: "ACTIVE",
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    })

                    await objRef.set({
                        contractorId: ctrRef.id,
                        name: "Siedziba Główna",
                        address: tx.contractor.address || null,
                        createdAt: new Date().toISOString()
                    })

                    // b. Sync to Prisma with exact doc IDs
                    const newCtr = await prisma.contractor.create({
                        data: {
                            id: ctrRef.id, // ID from Firestore
                            tenantId,
                            name: tx.contractor.name,
                            nip: tx.contractor.nip,
                            address: tx.contractor.address,
                            status: "ACTIVE",
                            objects: {
                                create: {
                                    id: objRef.id,
                                    name: "Siedziba Główna",
                                    address: tx.contractor.address || null
                                }
                            }
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

                // Raw transactions only go to Prisma (matching Reconciliation logic)
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
            } catch (e: any) {
                console.error("[IMPORT_TX_ERROR] Failed to save transaction:", e.message)
                results.errors++
            }
        }

        revalidatePath("/finance/reconciliation")
        revalidatePath("/")
        revalidatePath("/crm")

        // Return plain result object (primitives) to avoid serialization issues
        return {
            success: true,
            results: {
                added: Number(results.added),
                skipped: Number(results.skipped),
                errors: Number(results.errors),
                newContractors: Number(results.newContractors)
            }
        }
    } catch (error: any) {
        console.error("[IMPORT_ACTION_FATAL]", error)
        return { success: false, error: error.message || "Krytyczny błąd podczas procesu importu." }
    }
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
