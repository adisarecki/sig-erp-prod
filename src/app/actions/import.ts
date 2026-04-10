"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getAdminDb } from "@/lib/firebaseAdmin"
import { getCurrentTenantId } from "@/lib/tenant"
import type { ParsedBankTransaction } from "@/lib/pko-parser"
import Decimal from "decimal.js"
import { randomUUID } from "crypto"
import { recordLedgerEntry } from "@/lib/finanse/ledger-manager"
import { ContractorResolutionService } from "@/lib/finanse/contractorResolutionService"


/**
 * V2: Smart Import with Decisions & Reconciliation
 */
export async function importBankStatementV2(
    decisions: any[], 
    _bankAccountId?: string // Prefixed with _ to silence lint or handled optionally
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
                // 1. Financial Master Write (POSTGRES - Vector 110)
                const dbResult = await prisma.$transaction(async (txPrisma: any) => {
                    let contractorId = data.contractorId || null

                    // A. Resolve/Create Contractor
                    if (action === 'CREATE_AND_IMPORT' && !contractorId) {
                        const newId = randomUUID();
                        const newCtr = await txPrisma.contractor.create({
                            data: {
                                id: newId,
                                tenantId,
                                name: tx.contractor.name,
                                nip: tx.contractor.nip || null,
                                address: tx.contractor.address || null,
                                bankAccounts: tx.iban ? [tx.iban] : [],
                                status: "ACTIVE",
                                objects: {
                                    create: { name: "Siedziba Główna", address: tx.contractor.address || null }
                                }
                            }
                        })
                        contractorId = newCtr.id
                    }

                    // B. IBAN Auto-Learning (Vector 116: Advanced Intelligence)
                    if (contractorId && tx.iban) {
                        await ContractorResolutionService.linkIbanToContractor(
                            tenantId, 
                            contractorId, 
                            tx.iban, 
                            "BANK_MATCH", 
                            txPrisma
                        );
                    }

                    // C. Create Transaction record
                    const amount = new Decimal(tx.amount)
                    const isIncome = amount.gt(0)
                    const transactionId = randomUUID();

                    const transaction = await txPrisma.transaction.create({
                        data: {
                            id: transactionId,
                            tenantId,
                            amount: amount.abs().toNumber(),
                            type: isIncome ? "PRZYCHÓD" : "KOSZT",
                            transactionDate: new Date(tx.date),
                            category: tx.category || "INNE",
                            description: tx.description,
                            status: "ACTIVE",
                            source: "BANK_IMPORT",
                            title: tx.title,
                            counterpartyRaw: tx.contractor.name,
                            matchedContractorId: contractorId,
                            externalId: `SMART-${tx.id}`
                        }
                    })

                    // D. recordLedgerEntry (Vector 109)
                    await recordLedgerEntry({
                        tenantId,
                        source: 'BANK_PAYMENT',
                        sourceId: transactionId,
                        amount: amount,
                        type: isIncome ? 'INCOME' : 'EXPENSE',
                        date: new Date(tx.date)
                    }, txPrisma);

                    // E. Reconciliation: Link & Mark PAID
                    if (action === 'IMPORT_AND_PAY' && data.invoiceId) {
                        await txPrisma.invoicePayment.create({
                            data: {
                                invoiceId: data.invoiceId,
                                transactionId: transactionId,
                                amountApplied: amount.abs().toNumber()
                            }
                        })

                        const inv = await txPrisma.invoice.findUnique({
                            where: { id: data.invoiceId },
                            include: { payments: true }
                        })

                        if (inv) {
                            const totalPaid = inv.payments.reduce((acc: Decimal, p: any) => acc.plus(new Decimal(p.amountApplied)), new Decimal(0))
                            const status = totalPaid.gte(new Decimal(inv.amountGross)) ? "PAID" : "PARTIALLY_PAID"
                            await txPrisma.invoice.update({ where: { id: inv.id }, data: { status } })
                        }
                    }

                    return { transactionId, contractorId, isNewContractor: (action === 'CREATE_AND_IMPORT' && !data.contractorId) };
                });

                // 2. Operational Mirror Sync (FIRESTORE)
                const fsBatch = adminDb.batch();
                
                if (dbResult.isNewContractor) {
                    const cSnap = await prisma.contractor.findUnique({ where: { id: dbResult.contractorId }, include: { objects: true } });
                    if (cSnap) {
                        fsBatch.set(adminDb.collection("contractors").doc(cSnap.id), {
                            tenantId, name: cSnap.name, nip: cSnap.nip, address: cSnap.address, 
                            bankAccounts: cSnap.bankAccounts, type: "DOSTAWCA", status: cSnap.status,
                            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
                        });
                        if (cSnap.objects[0]) {
                            fsBatch.set(adminDb.collection("objects").doc(cSnap.objects[0].id), {
                                contractorId: cSnap.id, name: cSnap.objects[0].name, address: cSnap.objects[0].address
                            });
                        }
                    }
                    results.newContractors++
                } else if (tx.iban) {
                    // Update IBAN in FS if learned
                    const contractor = await prisma.contractor.findUnique({ where: { id: dbResult.contractorId } })
                    if (contractor) {
                        fsBatch.update(adminDb.collection("contractors").doc(dbResult.contractorId), {
                            bankAccounts: contractor.bankAccounts,
                            updatedAt: new Date().toISOString()
                        });
                    }
                }

                // Sync Transaction to FS
                const tSnap = await prisma.transaction.findUnique({ where: { id: dbResult.transactionId } });
                if (tSnap) {
                    fsBatch.set(adminDb.collection("transactions").doc(tSnap.id), {
                        tenantId, amount: Number(tSnap.amount), type: tSnap.type, 
                        transactionDate: tSnap.transactionDate.toISOString(), category: tSnap.category,
                        description: tSnap.description, status: tSnap.status, source: tSnap.source,
                        title: tSnap.title, counterpartyRaw: tSnap.counterpartyRaw,
                        matchedContractorId: tSnap.matchedContractorId, externalId: tSnap.externalId,
                        createdAt: new Date().toISOString()
                    });
                }

                // Sync Invoice Status if matched
                if (action === 'IMPORT_AND_PAY' && data.invoiceId) {
                    const inv = await prisma.invoice.findUnique({ where: { id: data.invoiceId } });
                    if (inv) {
                        fsBatch.update(adminDb.collection("invoices").doc(inv.id), {
                            status: inv.status,
                            updatedAt: new Date().toISOString()
                        });
                    }
                    results.matched++
                }

                await fsBatch.commit();
                results.added++
            } catch (err: any) {
                console.error("[IMPORT_V2_ROW_ERROR]", err.message)
            }
        }

        revalidatePath("/")
        revalidatePath("/finanse")
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
    revalidatePath("/finanse")

    return results
}
