"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { recordLedgerEntry } from "@/lib/finance/ledger-manager"
import { getAdminDb } from "@/lib/firebaseAdmin"
import { randomUUID } from "crypto"
import Decimal from "decimal.js"
import { ReconciliationEngine } from "@/lib/reconciliation"
import { getCurrentTenantId } from "@/lib/tenant"

/**
 * Reconciles a bank transaction with one or more invoices.
 * Creates Transaction records and immutable InvoicePayment records.
 * PG-First (Vector 110)
 */
export async function reconcileBankTransaction(
    bankTransactionId: string,
    splits: { invoiceId: string, amount: string }[]
) {
    const tenantId = await getCurrentTenantId()
    const adminDb = getAdminDb()

    const result = await prisma.$transaction(async (tx) => {
        const bankTrans = await tx.bankTransactionRaw.findUnique({
            where: { id: bankTransactionId },
            include: { bankAccount: true }
        })

        if (!bankTrans) throw new Error("Nie znaleziono transakcji bankowej.")
        if (bankTrans.status === "PAIRED") throw new Error("Transakcja jest już sparowana.")

        const totalSplitAmount = splits.reduce(
            (acc, s) => acc.plus(new Decimal(s.amount)),
            new Decimal(0)
        )

        if (totalSplitAmount.gt(bankTrans.rawAmount.abs())) {
            throw new Error("Suma rozliczeń przewyższa kwotę przelewu.")
        }

        const processedInvoices: string[] = [];

        for (const split of splits) {
            const amount = new Decimal(split.amount)
            const transactionId = randomUUID();

            // 1. Create Transaction (PG-Master)
            await tx.transaction.create({
                data: {
                    id: transactionId,
                    tenantId,
                    amount: amount.toNumber(),
                    classification: "PROJECT_COST",
                    type: amount.gt(0) ? "PRZYCHÓD" : "KOSZT",
                    transactionDate: bankTrans.bookingDate,
                    category: "ROZLICZENIE_BANKOWE",
                    description: `Rozliczenie: ${bankTrans.description}`,
                    status: "ACTIVE",
                    source: "BANK_IMPORT"
                }
            })

            // 2. Ledger recording (Vector 109)
            await recordLedgerEntry({
                tenantId,
                source: 'BANK_PAYMENT',
                sourceId: transactionId,
                amount: amount,
                type: amount.gt(0) ? 'INCOME' : 'EXPENSE',
                date: bankTrans.bookingDate
            }, tx);

            // 3. Create immutable InvoicePayment link
            await tx.invoicePayment.create({
                data: {
                    invoiceId: split.invoiceId,
                    transactionId: transactionId,
                    amountApplied: amount.toNumber()
                }
            })

            // 4. Update Invoice status
            const invoice = await tx.invoice.findUnique({
                where: { id: split.invoiceId },
                include: { payments: true }
            })

            if (invoice) {
                const totalPaid = invoice.payments.reduce(
                    (acc, p) => acc.plus(new Decimal(p.amountApplied)),
                    new Decimal(0)
                )
                const newStatus = totalPaid.gte(new Decimal(invoice.amountGross)) ? "PAID" : "PARTIALLY_PAID"
                await tx.invoice.update({
                    where: { id: invoice.id },
                    data: { status: newStatus }
                })
                processedInvoices.push(invoice.id);
            }
        }

        // 5. Update Bank Transaction status
        await tx.bankTransactionRaw.update({
            where: { id: bankTransactionId },
            data: { status: "PAIRED" }
        })

        return { processedInvoices };
    })

    // --- OPERATIONAL MIRROR SYNC (FIRESTORE) ---
    const fsBatch = adminDb.batch();
    for (const invId of result.processedInvoices) {
        const inv = await prisma.invoice.findUnique({ where: { id: invId } });
        if (inv) {
            fsBatch.update(adminDb.collection("invoices").doc(inv.id), {
                status: inv.status,
                updatedAt: new Date().toISOString()
            });
        }
    }
    await fsBatch.commit();

    revalidatePath("/finanse/reconciliation")
    revalidatePath("/")
}

/**
 * Reversal mechanism for erroneous reconciliations.
 * PG-First (Vector 110)
 */
export async function reverseReconciliation(invoicePaymentId: string) {
    const tenantId = await getCurrentTenantId()
    const adminDb = getAdminDb()

    const result = await prisma.$transaction(async (tx) => {
        const original = await tx.invoicePayment.findUnique({
            where: { id: invoicePaymentId },
            include: {
                transaction: true,
                invoice: true
            }
        })

        if (!original) throw new Error("Nie znaleziono rekordu płatności.")

        const reversalAmount = new Decimal(original.amountApplied.toString()).negated()
        const reversalTxId = randomUUID();

        // 1. Reversal Transaction
        await tx.transaction.create({
            data: {
                id: reversalTxId,
                tenantId,
                amount: reversalAmount.toNumber(),
                type: "KOREKTA",
                transactionDate: new Date(),
                category: "ROZLICZENIE_KORYGUJĄCE",
                description: `KOREKTA: ${original.transaction.description}`,
                status: "ACTIVE",
                source: "MANUAL",
                reversalOf: original.transactionId
            }
        })

        // 2. Ledger Recording (Negative entry)
        await recordLedgerEntry({
            tenantId,
            source: 'BANK_PAYMENT',
            sourceId: reversalTxId,
            amount: reversalAmount,
            type: reversalAmount.gt(0) ? 'INCOME' : 'EXPENSE',
            date: new Date()
        }, tx);

        // 3. Create immutable reversal InvoicePayment
        await tx.invoicePayment.create({
            data: {
                invoiceId: original.invoiceId,
                transactionId: reversalTxId,
                amountApplied: reversalAmount.toNumber()
            }
        })

        // 4. Recalculate invoice status
        const invoice = await tx.invoice.findUnique({
            where: { id: original.invoiceId },
            include: { payments: true }
        })

        let newStatus = "ACTIVE"
        if (invoice) {
            const totalPaid = invoice.payments.reduce(
                (acc, p) => acc.plus(new Decimal(p.amountApplied)),
                new Decimal(0)
            )
            if (totalPaid.gte(new Decimal(invoice.amountGross))) newStatus = "PAID"
            else if (totalPaid.gt(0)) newStatus = "PARTIALLY_PAID"

            await tx.invoice.update({
                where: { id: invoice.id },
                data: { status: newStatus }
            })
        }
        
        return { invoiceId: original.invoiceId, newStatus };
    })

    // --- MIRROR SYNC ---
    await adminDb.collection("invoices").doc(result.invoiceId).update({
        status: result.newStatus,
        updatedAt: new Date().toISOString()
    });

    revalidatePath("/finanse/reconciliation")
    revalidatePath("/")
}

/**
 * Gets suggested matches for all unpaired bank transactions.
 * Returns only suggestions in the REVIEW tier (0.60–0.95 confidence).
 * Suggestions >= 0.95 are considered auto-confidence and filtered to a separate list.
 */
export async function getSuggestedReconciliations() {
    const tenantId = await getCurrentTenantId()

    const [unpairedBank, unpaidInvoices] = await Promise.all([
        prisma.bankTransactionRaw.findMany({
            where: { tenantId, status: "UNPAIRED" },
            orderBy: { bookingDate: 'desc' }
        }),
        prisma.invoice.findMany({
            where: { tenantId, status: { in: ["ACTIVE", "PARTIALLY_PAID"] } },
            select: {
                id: true,
                externalId: true,
                amountGross: true,
                amountNet: true,
                retainedAmount: true,
                contractor: { select: { name: true } }
            }
        })
    ])

    return unpairedBank.map(bt => {
        const allSuggestions = ReconciliationEngine.suggestMatches(
            { description: bt.description, amount: bt.rawAmount },
            unpaidInvoices
        )

        // REVIEW tier: 0.60 <= confidence < 0.95 (shown in UI for manual approval)
        const reviewTier = allSuggestions
            .filter(s => s.confidence >= 0.6 && s.confidence < 0.95)
            .slice(0, 3)

        return {
            bankTransaction: {
                id: bt.id,
                description: bt.description,
                rawAmount: bt.rawAmount.toString(),
                bookingDate: bt.bookingDate
            },
            suggestions: reviewTier.map(s => ({
                invoiceId: s.invoiceId,
                invoiceNumber: s.invoiceNumber,
                contractorName: s.contractorName,
                amount: s.amount.toString(),
                confidence: s.confidence,
                reason: s.reason
            }))
        }
    })
}

/**
 * Analyzes a batch of newly parsed bank transactions BEFORE import.
 * Detects existing contractors (by NIP, Name, IBAN) and matching invoices.
 */
export async function analyzeImportMatches(transactions: any[]) {
    const tenantId = await getCurrentTenantId()

    // 1. Fetch current context
    const [contractors, openInvoices] = await Promise.all([
        prisma.contractor.findMany({ where: { tenantId } }),
        prisma.invoice.findMany({
            where: { tenantId, status: { in: ["ACTIVE", "PARTIALLY_PAID"] } },
            select: {
                id: true,
                externalId: true,
                amountGross: true,
                amountNet: true,
                retainedAmount: true,
                contractor: { select: { id: true, name: true } }
            }
        })
    ])

    return transactions.map(tx => {
        const amount = new Decimal(tx.amount || 0).abs()
        const isIncome = new Decimal(tx.amount || 0).gt(0)
        
        // --- A. Contractor Match ---
        let matchedContractor = null;
        
        // 1. By NIP
        if (tx.contractor?.nip) {
            matchedContractor = contractors.find(c => c.nip === tx.contractor.nip)
        }
        
        // 2. By IBAN (if available in contractor data)
        if (!matchedContractor && tx.iban) {
            matchedContractor = contractors.find(c => (c.bankAccounts as string[] || []).includes(tx.iban))
        }

        // 3. By Name (Fuzzy)
        if (!matchedContractor && tx.contractor?.name) {
            const tName = tx.contractor.name.toLowerCase().replace(/\s+/g, '')
            matchedContractor = contractors.find(c => {
                const cName = c.name.toLowerCase().replace(/\s+/g, '')
                return tName.includes(cName) || cName.includes(tName)
            })
        }

        // --- B. Invoice Match (Reconciliation) ---
        let matchedInvoice = null;
        const suggestions = ReconciliationEngine.suggestMatches(
            { description: tx.description, amount: new Decimal(tx.amount) },
            openInvoices
        )

        // If high confidence (> 0.90), auto-propose
        if (suggestions.length > 0 && suggestions[0].confidence >= 0.90) {
            matchedInvoice = suggestions[0]
        }

        return {
            id: tx.id,
            contractor: {
                found: !!matchedContractor,
                id: matchedContractor?.id || null,
                name: matchedContractor?.name || null,
                nip: matchedContractor?.nip || null
            },
            reconciliation: {
                found: !!matchedInvoice,
                invoiceId: matchedInvoice?.invoiceId || null,
                invoiceNumber: matchedInvoice?.invoiceNumber || null,
                confidence: matchedInvoice?.confidence || 0
            },
            isNew: !matchedContractor,
            defaultAction: matchedInvoice ? 'IMPORT_AND_PAY' : matchedContractor ? 'IMPORT_ONLY' : 'CREATE_AND_IMPORT'
        }
    })
}

/**
 * Searches for unpaid invoices by invoice number or contractor name.
 */
export async function searchUnpaidInvoices(query: string) {
    const tenantId = await getCurrentTenantId()
    const cleanQuery = query.toLowerCase()
    
    return prisma.invoice.findMany({
        where: {
            tenantId,
            status: { in: ["ACTIVE", "PARTIALLY_PAID"] },
            OR: [
                { externalId: { contains: cleanQuery, mode: 'insensitive' } },
                { contractor: { name: { contains: cleanQuery, mode: 'insensitive' } } }
            ]
        },
        include: { contractor: true },
        take: 10
    })
}
