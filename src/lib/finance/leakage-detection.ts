import { PrismaClient } from "@prisma/client"
import Decimal from "decimal.js"

const prisma = new PrismaClient()

export type LeakSeverity = "CRITICAL" | "WARNING" | "INFO"

export interface LeakageAlert {
    id: string
    type: "DOUBLE_PAYMENT" | "MISSING_INVOICE" | "VAT_MISMATCH"
    title: string
    description: string
    severity: LeakSeverity
    entityId?: string
}

/**
 * Leakage Detection Engine
 * 
 * Scans the database for financial leaks:
 * 1. Double Payments (Duplicate transactions)
 * 2. Missing Invoices (Bank transfers without linked invoices)
 * 3. VAT Inconsistencies (Gross != Net * (1 + TaxRate))
 */
export async function scanForLeaks(tenantId: string): Promise<LeakageAlert[]> {
    const alerts: LeakageAlert[] = []

    // 1. Detect Double Payments (Same amount, date, and contractor/category within short window)
    const transactions = await prisma.transaction.findMany({
        where: { tenantId, status: "ACTIVE" },
        orderBy: { transactionDate: "desc" },
        take: 100
    })

    for (let i = 0; i < transactions.length; i++) {
        for (let j = i + 1; j < transactions.length; j++) {
            const t1 = transactions[i]
            const t2 = transactions[j]

            const sameAmount = t1.amount.equals(t2.amount)
            const sameDate = t1.transactionDate.getTime() === t2.transactionDate.getTime()
            const sameCategory = t1.category === t2.category

            if (sameAmount && sameDate && sameCategory) {
                alerts.push({
                    id: `double-${t1.id}-${t2.id}`,
                    type: "DOUBLE_PAYMENT",
                    title: "Potencjalna podwójna płatność",
                    description: `Prawdopodobny duplikat transakcji na kwotę ${t1.amount.toFixed(2)} PLN (Kategoria: ${t1.category})`,
                    severity: "CRITICAL",
                    entityId: t1.id
                })
            }
        }
    }

    // 2. Detect Missing Invoices (Large Bank Transactions without paired Transaction or Invoice link)
    const unmatchedBankTrans = await prisma.bankTransactionRaw.findMany({
        where: {
            tenantId,
            status: "UNPAIRED",
            rawAmount: { lt: 0 } // Only outgoing leaks
        },
        take: 20
    })

    for (const bt of unmatchedBankTrans) {
        alerts.push({
            id: `missing-inv-${bt.id}`,
            type: "MISSING_INVOICE",
            title: "Zgubiony koszt (Brak faktury)",
            description: `Wydatek z konta bankowego (${Math.abs(bt.rawAmount.toNumber()).toFixed(2)} PLN) nie posiada przypisanej faktury ani transakcji w systemie.`,
            severity: "WARNING",
            entityId: bt.id
        })
    }

    // 3. VAT Inconsistency Check
    const recentInvoices = await prisma.invoice.findMany({
        where: { tenantId, status: "ACTIVE" },
        take: 20
    })

    for (const inv of recentInvoices) {
        const expectedGross = inv.amountNet.mul(inv.taxRate.add(1)).toDecimalPlaces(2)
        if (!inv.amountGross.equals(expectedGross)) {
            alerts.push({
                id: `vat-err-${inv.id}`,
                type: "VAT_MISMATCH",
                title: "Błąd obliczeń VAT",
                description: `Faktura ${inv.externalId || inv.id} ma niespójną kwotę Brutto względem Netto+VAT. Różnica: ${inv.amountGross.minus(expectedGross).toFixed(2)} PLN`,
                severity: "INFO",
                entityId: inv.id
            })
        }
    }

    return alerts
}
