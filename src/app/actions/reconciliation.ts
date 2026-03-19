"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import Decimal from "decimal.js"
import { ReconciliationEngine } from "@/lib/reconciliation"
import { getCurrentTenantId } from "@/lib/tenant"


/**
 * Reconciles a bank transaction with one or more invoices.
 * Creates Transaction records and immutable InvoicePayment records.
 * APPEND-ONLY: Records are never updated or deleted.
 */
export async function reconcileBankTransaction(
    bankTransactionId: string,
    splits: { invoiceId: string, amount: string }[]
) {
    const tenantId = await getCurrentTenantId()

    await prisma.$transaction(async (tx) => {
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

        // For each split, create a Transaction and an immutable InvoicePayment entry
        for (const split of splits) {
            const amount = new Decimal(split.amount)

            // 1. Create Ledger Transaction (Append-Only)
            const transaction = await tx.transaction.create({
                data: {
                    tenantId,
                    amount: amount,
                    type: amount.gt(0) ? "PRZYCHÓD" : "KOSZT",
                    transactionDate: bankTrans.bookingDate,
                    category: "ROZLICZENIE_BANKOWE",
                    description: `Rozliczenie: ${bankTrans.description}`,
                    status: "ACTIVE",
                    source: "BANK_IMPORT"
                }
            })

            // 2. Create immutable InvoicePayment link (N:M join)
            // No updatedAt field – record is permanent
            await tx.invoicePayment.create({
                data: {
                    invoiceId: split.invoiceId,
                    transactionId: transaction.id,
                    amountApplied: amount
                }
            })

            // 3. Recalculate and update Invoice status based on all payments
            const invoice = await tx.invoice.findUnique({
                where: { id: split.invoiceId },
                include: { payments: true }
            })

            if (invoice) {
                const totalPaid = invoice.payments.reduce(
                    (acc, p) => acc.plus(p.amountApplied),
                    new Decimal(0)
                ).plus(amount)

                const newStatus = totalPaid.gte(invoice.amountGross) ? "PAID" : "PARTIALLY_PAID"

                await tx.invoice.update({
                    where: { id: invoice.id },
                    data: { status: newStatus }
                })
            }
        }

        // 4. Update Bank Transaction status to PAIRED
        await tx.bankTransactionRaw.update({
            where: { id: bankTransactionId },
            data: { status: "PAIRED" }
        })
    })

    revalidatePath("/finance/reconciliation")
    revalidatePath("/")
}

/**
 * Reversal mechanism for erroneous reconciliations.
 * Creates a new correcting Transaction + InvoicePayment.
 * NEVER deletes or modifies existing records.
 */
export async function reverseReconciliation(invoicePaymentId: string) {
    const tenantId = await getCurrentTenantId()

    await prisma.$transaction(async (tx) => {
        const original = await tx.invoicePayment.findUnique({
            where: { id: invoicePaymentId },
            include: {
                transaction: true,
                invoice: true
            }
        })

        if (!original) throw new Error("Nie znaleziono rekordu płatności.")

        // Create correcting (reversal) transaction with negative amount
        const reversalAmount = new Decimal(original.amountApplied.toString()).negated()
        const reversalTx = await tx.transaction.create({
            data: {
                tenantId,
                amount: reversalAmount,
                type: "KOREKTA",
                transactionDate: new Date(),
                category: "ROZLICZENIE_KORYGUJĄCE",
                description: `KOREKTA: ${original.transaction.description}`,
                status: "ACTIVE",
                source: "MANUAL",
                reversalOf: original.transactionId
            }
        })

        // Create immutable reversal InvoicePayment
        await tx.invoicePayment.create({
            data: {
                invoiceId: original.invoiceId,
                transactionId: reversalTx.id,
                amountApplied: reversalAmount
            }
        })

        // Recalculate invoice status
        const invoice = await tx.invoice.findUnique({
            where: { id: original.invoiceId },
            include: { payments: true }
        })

        if (invoice) {
            const totalPaid = invoice.payments.reduce(
                (acc, p) => acc.plus(p.amountApplied),
                new Decimal(0)
            ).plus(reversalAmount)

            let newStatus = "ACTIVE"
            if (totalPaid.gte(invoice.amountGross)) newStatus = "PAID"
            else if (totalPaid.gt(0)) newStatus = "PARTIALLY_PAID"

            await tx.invoice.update({
                where: { id: invoice.id },
                data: { status: newStatus }
            })
        }
    })

    revalidatePath("/finance/reconciliation")
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
            include: { contractor: true }
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
 * Searches for unpaid invoices by contractor name or number.
 */
export async function searchUnpaidInvoices(query: string) {
    const tenantId = await getCurrentTenantId()
    const invoices = await prisma.invoice.findMany({
        where: {
            tenantId,
            status: { in: ["ACTIVE", "PARTIALLY_PAID"] },
            OR: [
                { externalId: { contains: query, mode: 'insensitive' } },
                { contractor: { name: { contains: query, mode: 'insensitive' } } }
            ]
        },
        include: { contractor: true },
        take: 10
    })

    return invoices.map(inv => ({
        id: inv.id,
        externalId: inv.externalId,
        amountGross: inv.amountGross.toString(),
        amountNet: inv.amountNet.toString(),
        taxRate: inv.taxRate.toString(),
        contractor: {
            name: inv.contractor.name
        }
    }))
}
