"use server"

import { revalidatePath } from "next/cache"
import Decimal from "decimal.js"
import { validateNonZero } from "@/lib/ledger"
import { getCurrentTenantId } from "@/lib/tenant"
import { getAdminDb } from "@/lib/firebaseAdmin"
import prisma from "@/lib/prisma"
import { recalculateProjectBudget } from "./projects"
import { syncRetentionsFromProject } from "./retentions"
import { syncInvoiceToFirestore } from "../../lib/finance/sync-utils"
import { recordInvoiceToLedger, recordLedgerEntry } from "@/lib/finance/ledger-manager"
import { assertFinancialMasterWrite } from "@/lib/authority/guards"
import { randomUUID } from "crypto"


export async function deleteInvoice(id: string): Promise<{ success: boolean, error?: string }> {
    try {
        const adminDb = getAdminDb()
        const tenantId = await getCurrentTenantId()

        // 1. Znajdź powiązane transakcje (source: INVOICE)
        const payments = await prisma.invoicePayment.findMany({
            where: { invoiceId: id },
            include: { transaction: true }
        })

        const transactionIdsToDelete = payments
            .filter(p => p.transaction.source === "INVOICE")
            .map(p => p.transaction.id)

        // 2. Firestore Deletion (Batch/Transaction)
        await adminDb.runTransaction(async (transaction) => {
            // Usuń fakturę
            transaction.delete(adminDb.collection("invoices").doc(id))
            
            // Usuń powiązane transakcje w Firestore
            for (const txId of transactionIdsToDelete) {
                transaction.delete(adminDb.collection("transactions").doc(txId))
            }
        })

        // 3. Prisma Deletion (Cascading cleanup)
        // Uwaga: InvoicePayment ma onDelete: Cascade dla Transaction w schema? 
        // Sprawdźmy schema: 
        // InvoicePayment -> Transaction (onDelete: Cascade)
        // InvoicePayment -> Invoice (brak onDelete specified, domyślnie Restrict?)
        
        // Bezpieczne usuwanie kolejno:
        await prisma.$transaction(async (tx: any) => {
            // 0. Cleanup Central Ledger (Vector 109 Truth)
            await tx.ledgerEntry.deleteMany({
                where: {
                    tenantId,
                    sourceId: id
                }
            })

            // 1. Usuń powiązania i transakcje
            await tx.invoicePayment.deleteMany({ where: { invoiceId: id } })
            
            if (transactionIdsToDelete.length > 0) {
                await tx.transaction.deleteMany({
                    where: { id: { in: transactionIdsToDelete } }
                })
            }

            // 2. Usuń samą fakturę
            await tx.invoice.delete({ where: { id } })
        })

        revalidatePath("/finance")
        revalidatePath("/projects")
        revalidatePath("/")

        return { success: true }
    } catch (error: unknown) {
        console.error("[INVOICE_DELETE_ERROR]", error)
        return { success: false, error: error instanceof Error ? error.message : "Błąd podczas usuwania dokumentu." }
    }
}
export async function markInvoiceAsPaid(id: string, paymentDateOverride?: string, paymentMethod: string = "BANK_TRANSFER"): Promise<{ success: boolean, error?: string }> {
    try {
        const adminDb = getAdminDb();
        const tenantId = await getCurrentTenantId();
        
        // 1. Financial Master Write (POSTGRES - Vector 109)
        await assertFinancialMasterWrite('MARK_PAID', id);

        const paymentDate = paymentDateOverride ? new Date(paymentDateOverride) : new Date()

        const result = await prisma.$transaction(async (tx: any) => {
            // A. Pobierz fakturę wewnątrz transakcji
            const invoice = await tx.invoice.findFirst({
                where: { id, tenantId },
                include: { contractor: true }
            })

            if (!invoice) throw new Error("Nie znaleziono dokumentu.")
            if (invoice.status === "PAID") return { alreadyPaid: true, invoice }

            const amountGross = Number(invoice.amountGross)
            const isIncome = invoice.type === "REVENUE" || invoice.type === "INCOME" || invoice.type === "SPRZEDAŻ"

            // B. Update Invoice status
            const updatedInvoice = await tx.invoice.update({
                where: { id },
                data: { 
                    status: "PAID", 
                    paymentStatus: "PAID",
                    paymentMethod,
                    reconciliationStatus: paymentMethod === 'BANK_TRANSFER' ? 'MATCHED' : 'PENDING'
                },
                include: { contractor: true }
            })

            // C. Record in Central Ledger (PROPER ORDER)
            await recordLedgerEntry({
                tenantId,
                projectId: updatedInvoice.projectId || undefined,
                source: paymentMethod === 'BANK_TRANSFER' ? 'BANK_PAYMENT' : 'SHADOW_COST',
                sourceId: id,
                amount: new Decimal(updatedInvoice.amountGross).mul(isIncome ? 1 : -1),
                type: isIncome ? 'INCOME' : 'EXPENSE',
                date: paymentDate
            }, tx); // Pass transaction client if possible (recordLedgerEntry should support it)

            // D. Create Transaction record in Prisma
            const classification = updatedInvoice.projectId ? "PROJECT_COST" : "GENERAL_COST"
            const prismaTrans = await tx.transaction.create({
                data: {
                    tenant: { connect: { id: tenantId } },
                    project: updatedInvoice.projectId ? { connect: { id: updatedInvoice.projectId } } : undefined,
                    classification,
                    amount: amountGross,
                    type: isIncome ? "INCOME" : "EXPENSE",
                    transactionDate: paymentDate,
                    category: isIncome ? "SPRZEDAŻ" : "ZAKUP",
                    description: `Płatność (SSoT): ${updatedInvoice.invoiceNumber || updatedInvoice.ksefId || 'Bez numeru'}`,
                    status: "ACTIVE",
                    source: "INVOICE"
                }
            })

            // E. Link Payment
            await tx.invoicePayment.create({
                data: {
                    invoiceId: id,
                    transactionId: prismaTrans.id,
                    amountApplied: amountGross
                }
            })

            return { alreadyPaid: false, invoice: updatedInvoice, transaction: prismaTrans }
        })

        if (result.alreadyPaid) return { success: true }

        // 2. Operational Mirror Sync (FIRESTORE)
        const isIncome = result.invoice.type === "REVENUE" || result.invoice.type === "INCOME" || result.invoice.type === "SPRZEDAŻ"
        const fsType = result.invoice.type === 'REVENUE' ? 'SPRZEDAŻ' : 'EXPENSE'
        
        await adminDb.runTransaction(async (transaction) => {
            const invoiceRef = adminDb.collection("invoices").doc(id)
            const snap = await transaction.get(invoiceRef)

            if (!snap.exists) {
                transaction.set(invoiceRef, {
                    tenantId,
                    contractorId: result.invoice.contractorId,
                    projectId: result.invoice.projectId || '',
                    type: fsType,
                    amountNet: Number(result.invoice.amountNet),
                    amountGross: Number(result.invoice.amountGross),
                    taxRate: Number(result.invoice.taxRate),
                    issueDate: result.invoice.issueDate.toISOString(),
                    dueDate: result.invoice.dueDate.toISOString(),
                    status: "PAID",
                    externalId: result.invoice.invoiceNumber || result.invoice.ksefId,
                    createdAt: result.invoice.createdAt.toISOString(),
                    updatedAt: paymentDate.toISOString(),
                    ksefId: result.invoice.ksefId
                })
            } else {
                transaction.update(invoiceRef, {
                    status: "PAID",
                    updatedAt: paymentDate.toISOString()
                })
            }

            const transRef = adminDb.collection("transactions").doc(result.transaction.id)
            transaction.set(transRef, {
                tenantId,
                projectId: result.invoice.projectId || null,
                classification: result.transaction.classification,
                amount: Number(result.invoice.amountGross),
                type: isIncome ? "INCOME" : "EXPENSE",
                transactionDate: paymentDate.toISOString(),
                category: isIncome ? "SPRZEDAŻ" : "ZAKUP",
                description: result.transaction.description,
                status: "ACTIVE",
                source: "INVOICE",
                invoiceId: id,
                createdAt: paymentDate.toISOString(),
                updatedAt: paymentDate.toISOString()
            })
        })

        revalidatePath("/finance")
        revalidatePath("/projects")
        revalidatePath("/")

        return { success: true }
    } catch (error: unknown) {
        console.error("[INVOICE_MARK_PAID_ERROR]", error)
        return { success: false, error: error instanceof Error ? error.message : "Błąd podczas oznaczania jako zapłacone." }
    }
}

export async function markInvoiceAsUnpaid(id: string): Promise<{ success: boolean, error?: string }> {
    try {
        const adminDb = getAdminDb();
        const tenantId = await getCurrentTenantId();
        
        await assertFinancialMasterWrite('MARK_UNPAID', id);

        await prisma.$transaction(async (tx: any) => {
            const invoice = await tx.invoice.findFirst({
                where: { id, tenantId },
                include: { payments: { include: { transaction: true } } }
            })

            if (!invoice) throw new Error("Nie znaleziono dokumentu.")
            
            // Revert Invoice status
            await tx.invoice.update({
                where: { id },
                data: { 
                    status: "ACTIVE", 
                    paymentStatus: "UNPAID",
                    reconciliationStatus: "PENDING"
                }
            })

            // Find manual transactions (source: INVOICE)
            const payments = invoice.payments || []
            const manualPayments = payments.filter((p: any) => p.transaction && p.transaction.source === "INVOICE")
            const transactionIds = manualPayments.map((p: any) => p.transactionId)

            if (transactionIds.length > 0) {
                // Delete InvoicePayment links
                await tx.invoicePayment.deleteMany({
                    where: { transactionId: { in: transactionIds } }
                })
                // Delete Transactions
                await tx.transaction.deleteMany({
                    where: { id: { in: transactionIds } }
                })
            }

            // Delete Ledger Entries (BANK_PAYMENT or SHADOW_COST)
            await tx.ledgerEntry.deleteMany({
                where: {
                    tenantId,
                    sourceId: id,
                    source: { in: ['BANK_PAYMENT', 'SHADOW_COST'] }
                }
            })
        })

        // Operational Mirror Sync (FIRESTORE)
        await adminDb.collection("invoices").doc(id).update({
            status: "ACTIVE",
            updatedAt: new Date().toISOString()
        })

        revalidatePath("/finance")
        revalidatePath("/")

        return { success: true }
    } catch (error: unknown) {
        console.error("[INVOICE_MARK_UNPAID_ERROR]", error)
        return { success: false, error: error instanceof Error ? error.message : "Błąd podczas oznaczania jako nieopłacone." }
    }
}

export async function getAutoMatchData(nip: string) {
    try {
        const tenantId = await getCurrentTenantId()
        const cleanNip = nip.replace(/\D/g, "")
        if (!cleanNip || cleanNip.length < 10) return null

        const contractor = await prisma.contractor.findFirst({
            where: { tenantId, nip: cleanNip }
        })

        if (!contractor) return null

        // Znajdź ostatnią fakturę dla tego kontrahenta
        const lastInvoice = await prisma.invoice.findFirst({
            where: { tenantId, contractorId: contractor.id },
            orderBy: { issueDate: "desc" },
            include: {
                payments: {
                    include: {
                        transaction: true
                    },
                    take: 1
                }
            }
        })

        return {
            contractorId: contractor.id,
            contractorName: contractor.name,
            lastProjectId: lastInvoice?.projectId || "GENERAL",
            lastCategory: lastInvoice?.payments[0]?.transaction?.category || "KOSZT_FIRMOWY"
        }
    } catch (error: unknown) {
        console.error("[GET_AUTO_MATCH_ERROR]", error)
        return null
    }
}

export async function addIncomeInvoice(formData: FormData) {
    try {
        const adminDb = getAdminDb()
        const amountNetStr = formData.get("amountNet") as string
        const taxRateStr = formData.get("taxRate") as string
        const amountGrossStr = formData.get("amountGross") as string
        const dateStr = formData.get("date") as string
        const dueDateStr = formData.get("dueDate") as string
        const paymentMethod = (formData.get("paymentMethod") as string) || "BANK_TRANSFER"

        const category = formData.get("category") as string
        const projectIdRaw = formData.get("projectId") as string || ""
        const projectId = (projectIdRaw === "none" || projectIdRaw === "NONE" || projectIdRaw === "GENERAL" || projectIdRaw === "INTERNAL") ? "" : projectIdRaw
        const contractorId = formData.get("contractorId") as string
        const description = formData.get("description") as string
        const bankAccountNumber = (formData.get("bankAccountNumber") as string || "").replace(/\s/g, "")

        // New Contractor Fields
        const isNewContractor = formData.get("isNewContractor") === "true"
        const newContractorName = formData.get("newContractorName") as string
        let newContractorNip = (formData.get("newContractorNip") as string || "").replace(/\s/g, "")
        let newContractorAddress = formData.get("newContractorAddress") as string || ""

        // Heuristic: If address looks like a NIP and nip is empty, swap them
        if (!newContractorNip && /^\d{10}$/.test(newContractorAddress.trim())) {
            newContractorNip = newContractorAddress.trim()
            newContractorAddress = ""
        }

        if (!amountNetStr || !dateStr || !dueDateStr) {
            throw new Error("Pola Kwota i Daty są bezwzględnie wymagane.")
        }

        if (!contractorId && !isNewContractor) {
            throw new Error("Musisz wybrać istniejącego kontrahenta lub dodać nowego.")
        }

        if (isNewContractor && !newContractorName) {
            throw new Error("Nazwa nowego kontrahenta jest wymagana.")
        }

        if (!validateNonZero(amountNetStr)) {
            throw new Error("Kwota netto faktury nie może wynosić zero.")
        }

        const tenantId = await getCurrentTenantId()
        const amountNet = new Decimal(amountNetStr).abs()
        const taxRate = new Decimal(taxRateStr)
        const amountGross = new Decimal(amountGrossStr).abs()

        const issueDate = new Date(dateStr)
        const dueDate = new Date(dueDateStr)

        const isPaidImmediately = (formData.get("isPaidImmediately") === "true") || (dateStr === dueDateStr)

        // retention
        const retainedAmountStr = formData.get("retainedAmount") as string
        const retentionReleaseDateStr = formData.get("retentionReleaseDate") as string
        const retainedAmount = retainedAmountStr ? new Decimal(retainedAmountStr).abs() : null
        const retentionReleaseDate = retentionReleaseDateStr ? new Date(retentionReleaseDateStr) : null

        // --- TARCZA ANTY-DUBEL (Anti-Double Shield) Vector 098.3 ---
        // Tier 1: Check ksefId (if provided)
        const ksefId = formData.get("ksefId") as string;
        if (ksefId) {
            const ksefDuplicate = await prisma.invoice.findUnique({ where: { ksefId } });
            if (ksefDuplicate) throw new Error(`TARCZA ANTY-DUBEL (Tier 1): Faktura o KSeF ID ${ksefId} już istnieje!`);
        }

        // Tier 2: Composite Key Check [contractorId, invoiceNumber]
        if (description && contractorId) {
            const compositeDuplicate = await prisma.invoice.findFirst({
                where: { 
                    contractorId,
                    invoiceNumber: description
                }
            });

            if (compositeDuplicate) {
                throw new Error(`TARCZA ANTY-DUBEL (Tier 2): Faktura nr ${description} dla tego kontrahenta już istnieje!`)
            }
        }


        // 1. Financial Master Write (POSTGRES - Vector 109)
        await assertFinancialMasterWrite('CREATE_INCOME_INVOICE', description || 'MANUAL');

        const result = await prisma.$transaction(async (tx: any) => {
            let finalContractorId = contractorId;
            let finalProjectId = projectId;

            // --- A. KONTRAHENT (Quick Add) ---
            if (isNewContractor && newContractorName) {
                // Intelligent Upsert (Check by NIP)
                if (newContractorNip) {
                    const existing = await tx.contractor.findFirst({ where: { tenantId, nip: newContractorNip } });
                    if (existing) {
                        finalContractorId = existing.id;
                    }
                }

                if (!finalContractorId || finalContractorId === 'new') {
                    finalContractorId = randomUUID();
                    await tx.contractor.create({
                        data: {
                            id: finalContractorId,
                            tenant: { connect: { id: tenantId } },
                            name: newContractorName,
                            nip: newContractorNip || null,
                            address: newContractorAddress || null,
                            type: "INWESTOR",
                            status: "ACTIVE",
                            objects: {
                                create: {
                                    name: "Siedziba Główna",
                                    address: newContractorAddress || null
                                }
                            }
                        }
                    });
                }
            }

            // --- B. PROJEKT (Quick Add) ---
            const isNewProject = formData.get("isNewProject") === "true";
            const newProjectName = formData.get("newProjectName") as string;

            if (isNewProject && newProjectName) {
                finalProjectId = randomUUID();
                // Find or create default object for contractor to link project
                const contractorObj = await tx.object.findFirst({ where: { contractorId: finalContractorId } });
                
                await tx.project.create({
                    data: {
                        id: finalProjectId,
                        tenant: { connect: { id: tenantId } },
                        name: newProjectName,
                        contractor: { connect: { id: finalContractorId } },
                        object: { connect: { id: contractorObj?.id } }, // Fallback handled by Prisma if possible or we'd need to create one
                        type: "INWESTYCJA",
                        status: "PLANNED",
                        budgetEstimated: 0
                    }
                });
            }

            // --- C. FAKTURA ---
            const invoiceId = randomUUID();
            const invoice = await tx.invoice.create({
                data: {
                    id: invoiceId,
                    tenant: { connect: { id: tenantId } },
                    contractor: { connect: { id: finalContractorId } },
                    project: finalProjectId ? { connect: { id: finalProjectId } } : undefined,
                    type: "SPRZEDAŻ",
                    amountNet: amountNet.toNumber(),
                    amountGross: amountGross.toNumber(),
                    taxRate: taxRate.toNumber(),
                    issueDate,
                    dueDate,
                    status: isPaidImmediately ? "PAID" : "ACTIVE",
                    paymentMethod,
                    reconciliationStatus: (isPaidImmediately && paymentMethod === 'BANK_TRANSFER') ? 'MATCHED' : 'PENDING',
                    externalId: description,
                    retainedAmount: retainedAmount ? retainedAmount.toNumber() : null,
                    retentionReleaseDate
                }
            });

            // --- D. LEDGER ENTRIES (Truth) ---
            await recordInvoiceToLedger({
                tenantId,
                projectId: finalProjectId || undefined,
                invoiceId: invoiceId,
                amountNet: amountNet,
                vatAmount: amountGross.minus(amountNet),
                retainedAmount: retainedAmount ? retainedAmount : undefined,
                type: 'INCOME',
                date: issueDate
            }, tx);

            // --- E. IMMEDIATE PAYMENT (If applicable) ---
            let transactionId: string | undefined;
            if (isPaidImmediately) {
                transactionId = randomUUID();
                const classificationValue = (projectIdRaw === "INTERNAL") ? "INTERNAL_REVENUE" : (finalProjectId ? "PROJECT_REVENUE" : "GENERAL_REVENUE");
                
                const prismaTrans = await tx.transaction.create({
                    data: {
                        id: transactionId,
                        tenant: { connect: { id: tenantId } },
                        project: finalProjectId ? { connect: { id: finalProjectId } } : undefined,
                        classification: classificationValue,
                        amount: amountGross.toNumber(),
                        type: "PRZYCHÓD",
                        transactionDate: issueDate,
                        category: category || "SPRZEDAŻ_TOWARU",
                        description: `Wpływ z Faktury: ${description || 'Brak wpisanego numeru'}`,
                        status: "ACTIVE",
                        source: "INVOICE"
                    }
                });

                await tx.invoicePayment.create({
                    data: {
                        invoiceId: invoiceId,
                        transactionId: transactionId,
                        amountApplied: amountGross.toNumber()
                    }
                });

                await recordLedgerEntry({
                    tenantId,
                    projectId: finalProjectId || undefined,
                    source: paymentMethod === 'BANK_TRANSFER' ? 'BANK_PAYMENT' : 'SHADOW_COST',
                    sourceId: invoiceId,
                    amount: amountGross,
                    type: 'INCOME',
                    date: issueDate
                }, tx);
            }

            return { invoice, finalContractorId, finalProjectId, transactionId };
        });

        // 2. Operational Mirror Sync (FIRESTORE)
        const fsBatch = adminDb.batch();
        
        // Sync Contractor (if new)
        if (isNewContractor) {
            const cSnap = await prisma.contractor.findUnique({ where: { id: result.finalContractorId }, include: { objects: true } });
            if (cSnap) {
                fsBatch.set(adminDb.collection("contractors").doc(cSnap.id), {
                    tenantId, name: cSnap.name, nip: cSnap.nip, address: cSnap.address, 
                    type: cSnap.type, status: cSnap.status, createdAt: new Date().toISOString()
                });
                if (cSnap.objects[0]) {
                    fsBatch.set(adminDb.collection("objects").doc(cSnap.objects[0].id), {
                        contractorId: cSnap.id, name: cSnap.objects[0].name, address: cSnap.objects[0].address
                    });
                }
            }
        }

        // Sync Project (if new)
        if (formData.get("isNewProject") === "true" && result.finalProjectId) {
            const pSnap = await prisma.project.findUnique({ where: { id: result.finalProjectId } });
            if (pSnap) {
                fsBatch.set(adminDb.collection("projects").doc(pSnap.id), {
                    tenantId, name: pSnap.name, contractorId: result.finalContractorId, status: pSnap.status,
                    budgetEstimated: 0, createdAt: new Date().toISOString()
                });
            }
        }

        // Sync Invoice
        fsBatch.set(adminDb.collection("invoices").doc(result.invoice.id), {
            tenantId,
            contractorId: result.finalContractorId,
            projectId: result.finalProjectId || '',
            type: "SPRZEDAŻ",
            amountNet: Number(result.invoice.amountNet),
            amountGross: Number(result.invoice.amountGross),
            taxRate: Number(result.invoice.taxRate),
            issueDate: result.invoice.issueDate.toISOString(),
            dueDate: result.invoice.dueDate.toISOString(),
            status: result.invoice.status,
            paymentMethod: (result.invoice as any).paymentMethod,
            reconciliationStatus: (result.invoice as any).reconciliationStatus,
            externalId: description,
            retainedAmount: result.invoice.retainedAmount ? Number(result.invoice.retainedAmount) : null,
            retentionReleaseDate: result.invoice.retentionReleaseDate ? result.invoice.retentionReleaseDate.toISOString() : null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        // Sync Transaction
        if (result.transactionId) {
            const tSnap = await prisma.transaction.findUnique({ where: { id: result.transactionId } });
            if (tSnap) {
                fsBatch.set(adminDb.collection("transactions").doc(tSnap.id), {
                    tenantId, projectId: result.finalProjectId || null,
                    classification: tSnap.classification, amount: Number(tSnap.amount),
                    type: "PRZYCHÓD", transactionDate: tSnap.transactionDate.toISOString(),
                    category: tSnap.category, description: tSnap.description,
                    status: "ACTIVE", source: "INVOICE", invoiceId: result.invoice.id,
                    createdAt: new Date().toISOString()
                });
            }
        }

        await fsBatch.commit();

        revalidatePath("/")
        revalidatePath("/projects")
        revalidatePath("/finance")

        return { success: true }
    } catch (error: unknown) {
        console.error("[ADD_INCOME_INVOICE_ERROR]", error)
        return { success: false, error: error instanceof Error ? error.message : "Wystąpił błąd przy dodawaniu przychodu." }
    }
}

export async function addCostInvoice(formData: FormData) {
    try {
        const adminDb = getAdminDb()
        const amountNetStr = formData.get("amountNet") as string
        const taxRateStr = formData.get("taxRate") as string
        const amountGrossStr = formData.get("amountGross") as string
        const dateStr = formData.get("date") as string
        const dueDateStr = formData.get("dueDate") as string
        const paymentMethod = (formData.get("paymentMethod") as string) || "BANK_TRANSFER"

        const category = formData.get("category") as string
        const projectId = formData.get("projectId") as string
        const contractorId = formData.get("contractorId") as string
        const description = formData.get("description") as string
        const bankAccountNumber = (formData.get("bankAccountNumber") as string || "").replace(/\s/g, "")

        // New Contractor Fields
        const isNewContractor = formData.get("isNewContractor") === "true"
        const newContractorName = formData.get("newContractorName") as string
        let newContractorNip = (formData.get("newContractorNip") as string || "").replace(/\s/g, "")
        let newContractorAddress = formData.get("newContractorAddress") as string || ""

        if (!amountNetStr || !dateStr || !dueDateStr) {
            throw new Error("Pola Kwota i Daty są bezwzględnie wymagane.")
        }

        if (!contractorId && !isNewContractor) {
            throw new Error("Musisz wybrać istniejącego kontrahenta lub dodać nowego.")
        }

        if (!validateNonZero(amountNetStr)) {
            throw new Error("Kwota netto kosztu nie może wynosić zero.")
        }

        const tenantId = await getCurrentTenantId()
        const amountNet = new Decimal(amountNetStr).abs()
        const taxRate = new Decimal(taxRateStr)
        const amountGross = new Decimal(amountGrossStr).abs()
        const issueDate = new Date(dateStr)
        const dueDate = new Date(dueDateStr)
        const isPaidImmediately = (formData.get("isPaidImmediately") === "true") || (dateStr === dueDateStr)
        
        const retainedAmountStr = formData.get("retainedAmount") as string
        const retentionReleaseDateStr = formData.get("retentionReleaseDate") as string
        const retainedAmount = retainedAmountStr ? new Decimal(retainedAmountStr).abs() : null
        const retentionReleaseDate = retentionReleaseDateStr ? new Date(retentionReleaseDateStr) : null

        // --- TARCZA ANTY-DUBEL (Vector 098.3) ---
        const ksefId = formData.get("ksefId") as string;
        if (ksefId) {
            const ksefDuplicate = await prisma.invoice.findUnique({ where: { ksefId } });
            if (ksefDuplicate) throw new Error(`TARCZA ANTY-DUBEL: Faktura o KSeF ID ${ksefId} już istnieje!`);
        }

        // 1. Financial Master Write (POSTGRES - Vector 109)
        await assertFinancialMasterWrite('CREATE_COST_INVOICE', description || 'MANUAL');

        const result = await prisma.$transaction(async (tx: any) => {
            let finalContractorId = contractorId;
            let finalProjectId = (projectId === "none" || projectId === "NONE" || projectId === "GENERAL" || projectId === "INTERNAL" || !projectId) ? "" : projectId;

            // --- A. KONTRAHENT (Quick Add) ---
            if (isNewContractor && newContractorName) {
                if (newContractorNip) {
                    const existing = await tx.contractor.findFirst({ where: { tenantId, nip: newContractorNip } });
                    if (existing) {
                        finalContractorId = existing.id;
                    }
                }

                if (!finalContractorId || finalContractorId === 'new') {
                    finalContractorId = randomUUID();
                    await tx.contractor.create({
                        data: {
                            id: finalContractorId,
                            tenant: { connect: { id: tenantId } },
                            name: newContractorName,
                            nip: newContractorNip || null,
                            address: newContractorAddress || null,
                            type: "DOSTAWCA",
                            status: "ACTIVE",
                            objects: {
                                create: {
                                    name: "Siedziba Główna",
                                    address: newContractorAddress || null
                                }
                            }
                        }
                    });
                }
            }

            // --- B. PROJEKT (Quick Add) ---
            const isNewProject = formData.get("isNewProject") === "true";
            const newProjectName = formData.get("newProjectName") as string;
            if (isNewProject && newProjectName) {
                finalProjectId = randomUUID();
                const contractorObj = await tx.object.findFirst({ where: { contractorId: finalContractorId } });
                await tx.project.create({
                    data: {
                        id: finalProjectId,
                        tenant: { connect: { id: tenantId } },
                        name: newProjectName,
                        contractor: { connect: { id: finalContractorId } },
                        object: { connect: { id: contractorObj?.id } },
                        type: "WYKONAWSTWO",
                        status: "PLANNED",
                        budgetEstimated: 0
                    }
                });
            }

            // --- C. FAKTURA ---
            const invoiceId = randomUUID();
            const invoice = await tx.invoice.create({
                data: {
                    id: invoiceId,
                    tenant: { connect: { id: tenantId } },
                    contractor: { connect: { id: finalContractorId } },
                    project: finalProjectId ? { connect: { id: finalProjectId } } : undefined,
                    type: "EXPENSE",
                    amountNet: amountNet.toNumber(),
                    amountGross: amountGross.toNumber(),
                    taxRate: taxRate.toNumber(),
                    issueDate,
                    dueDate,
                    status: isPaidImmediately ? "PAID" : "ACTIVE",
                    paymentMethod,
                    reconciliationStatus: (isPaidImmediately && paymentMethod === 'BANK_TRANSFER') ? 'MATCHED' : 'PENDING',
                    externalId: description,
                    retainedAmount: retainedAmount ? retainedAmount.toNumber() : null,
                    retentionReleaseDate
                }
            });

            // --- D. LEDGER ENTRIES ---
            await recordInvoiceToLedger({
                tenantId,
                projectId: finalProjectId || undefined,
                invoiceId: invoiceId,
                amountNet: amountNet,
                vatAmount: amountGross.minus(amountNet),
                retainedAmount: retainedAmount ? retainedAmount : undefined,
                type: 'EXPENSE',
                date: issueDate
            }, tx);

            // --- E. PAYMENT ---
            let transactionId: string | undefined;
            if (isPaidImmediately) {
                transactionId = randomUUID();
                const classificationValue = (projectId === "INTERNAL") ? "INTERNAL_COST" : (finalProjectId ? "PROJECT_COST" : "GENERAL_COST");
                
                await tx.transaction.create({
                    data: {
                        id: transactionId,
                        tenant: { connect: { id: tenantId } },
                        project: finalProjectId ? { connect: { id: finalProjectId } } : undefined,
                        classification: classificationValue,
                        amount: amountGross.toNumber(),
                        type: "KOSZT",
                        transactionDate: issueDate,
                        category: category || "KOSZT_FIRMOWY",
                        description: `Zakup (Faktura): ${description || 'Bez numeru'}`,
                        status: "ACTIVE",
                        source: "INVOICE"
                    }
                });

                await tx.invoicePayment.create({
                    data: {
                        invoiceId: invoiceId,
                        transactionId: transactionId,
                        amountApplied: amountGross.toNumber()
                    }
                });

                await recordLedgerEntry({
                    tenantId,
                    projectId: finalProjectId || undefined,
                    source: paymentMethod === 'BANK_TRANSFER' ? 'BANK_PAYMENT' : 'SHADOW_COST',
                    sourceId: invoiceId,
                    amount: amountGross,
                    type: 'EXPENSE',
                    date: issueDate
                }, tx);
            }

            return { invoice, finalContractorId, finalProjectId, transactionId };
        });

        // 2. Operational Mirror Sync (FIRESTORE)
        const fsBatch = adminDb.batch();
        if (isNewContractor) {
            const cSnap = await prisma.contractor.findUnique({ where: { id: result.finalContractorId }, include: { objects: true } });
            if (cSnap) {
                fsBatch.set(adminDb.collection("contractors").doc(cSnap.id), {
                    tenantId, name: cSnap.name, nip: cSnap.nip, address: cSnap.address, 
                    type: "DOSTAWCA", status: cSnap.status, createdAt: new Date().toISOString()
                });
                if (cSnap.objects[0]) {
                    fsBatch.set(adminDb.collection("objects").doc(cSnap.objects[0].id), {
                        contractorId: cSnap.id, name: cSnap.objects[0].name, address: cSnap.objects[0].address
                    });
                }
            }
        }

        if (formData.get("isNewProject") === "true" && result.finalProjectId) {
            const pSnap = await prisma.project.findUnique({ where: { id: result.finalProjectId } });
            if (pSnap) {
                fsBatch.set(adminDb.collection("projects").doc(pSnap.id), {
                    tenantId, name: pSnap.name, contractorId: result.finalContractorId, status: pSnap.status,
                    budgetEstimated: 0, createdAt: new Date().toISOString()
                });
            }
        }

        fsBatch.set(adminDb.collection("invoices").doc(result.invoice.id), {
            tenantId,
            contractorId: result.finalContractorId,
            projectId: result.finalProjectId || '',
            type: "EXPENSE",
            amountNet: Number(result.invoice.amountNet),
            amountGross: Number(result.invoice.amountGross),
            taxRate: Number(result.invoice.taxRate),
            issueDate: result.invoice.issueDate.toISOString(),
            dueDate: result.invoice.dueDate.toISOString(),
            status: result.invoice.status,
            paymentMethod: (result.invoice as any).paymentMethod,
            reconciliationStatus: (result.invoice as any).reconciliationStatus,
            externalId: description,
            retainedAmount: result.invoice.retainedAmount ? Number(result.invoice.retainedAmount) : null,
            retentionReleaseDate: result.invoice.retentionReleaseDate ? result.invoice.retentionReleaseDate.toISOString() : null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        if (result.transactionId) {
            const tSnap = await prisma.transaction.findUnique({ where: { id: result.transactionId } });
            if (tSnap) {
                fsBatch.set(adminDb.collection("transactions").doc(tSnap.id), {
                    tenantId, projectId: result.finalProjectId || null,
                    classification: tSnap.classification, amount: Number(tSnap.amount),
                    type: "KOSZT", transactionDate: tSnap.transactionDate.toISOString(),
                    category: tSnap.category, description: tSnap.description,
                    status: "ACTIVE", source: "INVOICE", invoiceId: result.invoice.id,
                    createdAt: new Date().toISOString()
                });
            }
        }

        await fsBatch.commit();

        revalidatePath("/")
        revalidatePath("/projects")
        revalidatePath("/finance")

        return { success: true }
    } catch (error: unknown) {
        console.error("[ADD_COST_INVOICE_ERROR]", error)
        return { success: false, error: error instanceof Error ? error.message : "Wystąpił błąd przy dodawaniu kosztu." }
    }
}

/**
 * PRZYPISANIE FAKTURY DO PROJEKTU (DNA Vector 096)
 */
export async function assignInvoiceToProject(invoiceId: string, projectId: string) {
    if (!invoiceId || !projectId) throw new Error("ID faktury oraz ID projektu są wymagane.")

    try {
        const tenantId = await getCurrentTenantId()
        const adminDb = getAdminDb()

        // 1. Prisma Update
        await prisma.invoice.update({
            where: { id: invoiceId, tenantId },
            data: { projectId }
        })

        // 2. Firestore Sync (Mirror)
        await adminDb.collection("invoices").doc(invoiceId).update({
            projectId,
            updatedAt: new Date().toISOString()
        })

        // 3. Rekalkulacja Budżetu Projektu
        await recalculateProjectBudget(projectId)

        return { success: true }
    } catch (error: any) {
        console.error("[ASSIGN_INVOICE_ERROR]", error)
        return { success: false, error: error.message || "Nie udało się przypisać faktury do projektu." }
    }
}
