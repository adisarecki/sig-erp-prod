"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getAdminDb } from "@/lib/firebaseAdmin"
import { getCurrentTenantId } from "@/lib/tenant"
import type { ParsedBankTransaction } from "@/lib/pko-parser"
import Decimal from "decimal.js"

/**
 * V2: Smart Import with Decisions & Reconciliation
 */
export async function importBankStatementV2(
    decisions: any[], 
    bankAccountId: string
): Promise<{ success: boolean, results?: any, error?: string }> {
    try {
        const adminDb = getAdminDb()
        const tenantId = await getCurrentTenantId()
        const results = { added: 0, skipped: 0, matched: 0, newContractors: 0 }

        for (const data of decisions) {
            const { action, tx } = data
            if (action === 'SKIP') {
                results.skipped++
                continue
            }

            try {
                // 1. Resolve/Create Contractor
                let contractorId = data.contractorId || null

                if (action === 'CREATE_AND_IMPORT' && !contractorId) {
                    const ctrRef = adminDb.collection("contractors").doc()
                    const objRef = adminDb.collection("objects").doc()
                    
                    await ctrRef.set({
                        tenantId,
                        name: tx.contractor.name,
                        nip: tx.contractor.nip || null,
                        address: tx.contractor.address || null,
                        bankAccounts: tx.iban ? [tx.iban] : [],
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

                    const newCtr = await prisma.contractor.create({
                        data: {
                            id: ctrRef.id,
                            tenantId,
                            name: tx.contractor.name,
                            nip: tx.contractor.nip,
                            address: tx.contractor.address,
                            bankAccounts: tx.iban ? [tx.iban] : [],
                            status: "ACTIVE",
                            objects: {
                                create: { id: objRef.id, name: "Siedziba Główna", address: tx.contractor.address || null }
                            }
                        }
                    })
                    contractorId = newCtr.id
                    results.newContractors++
                }

                // 2. IBAN Auto-Learning (If IBAN exists but not in DB)
                if (contractorId && tx.iban) {
                    const contractor = await prisma.contractor.findUnique({ where: { id: contractorId } })
                    if (contractor) {
                        const currentAccounts = contractor.bankAccounts as string[] || []
                        if (!currentAccounts.includes(tx.iban)) {
                            await prisma.contractor.update({
                                where: { id: contractorId },
                                data: { bankAccounts: { push: tx.iban } } as any
                            })
                            await adminDb.collection("contractors").doc(contractorId).update({
                                bankAccounts: [...currentAccounts, tx.iban],
                                updatedAt: new Date().toISOString()
                            })
                        }
                    }
                }

                // 3. Create Transaction record
                const amount = new Decimal(tx.amount)
                const isIncome = amount.gt(0)

                const transaction = await prisma.transaction.create({
                    data: {
                        tenantId,
                        amount: amount.abs(),
                        type: isIncome ? "PRZYCHÓD" : "KOSZT",
                        transactionDate: new Date(tx.date),
                        category: tx.category || "INNE",
                        description: tx.description,
                        status: "ACTIVE",
                        source: "BANK_IMPORT",
                        title: tx.title,
                        counterpartyRaw: tx.contractor.name,
                        matchedContractorId: contractorId,
                        externalId: `SMART-${tx.id}-${Date.now()}`
                    }
                })

                // 4. Reconciliation: Link & Mark PAID
                if (action === 'IMPORT_AND_PAY' && data.invoiceId) {
                    await prisma.invoicePayment.create({
                        data: {
                            invoiceId: data.invoiceId,
                            transactionId: transaction.id,
                            amountApplied: amount.abs()
                        }
                    })

                    const inv = await prisma.invoice.findUnique({
                        where: { id: data.invoiceId },
                        include: { payments: true }
                    })

                    if (inv) {
                        const totalPaid = inv.payments.reduce((acc, p) => acc.plus(p.amountApplied), new Decimal(0))
                        const status = totalPaid.gte(inv.amountGross) ? "PAID" : "PARTIALLY_PAID"
                        
                        // Update SQL
                        await prisma.invoice.update({ where: { id: inv.id }, data: { status } })
                        
                        // Update Firestore (Consistency)
                        await adminDb.collection("invoices").doc(inv.id).update({
                            status,
                            updatedAt: new Date().toISOString()
                        }).catch(() => {}); // Optional fail if not in FS
                    }
                    results.matched++
                }

                results.added++
            } catch (err: any) {
                console.error("[IMPORT_V2_ROW_ERROR]", err.message)
            }
        }

        revalidatePath("/")
        revalidatePath("/finance")
        revalidatePath("/crm")

        return { success: true, results }
    } catch (error: any) {
        console.error("[IMPORT_V2_FATAL]", error)
        return { success: false, error: error.message }
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
