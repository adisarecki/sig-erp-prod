import { getAdminDb } from "@/lib/firebaseAdmin"

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
 * Leakage Detection Engine (Firestore)
 * 
 * Scans the database for financial leaks:
 * 1. Double Payments (Duplicate transactions)
 * 2. Missing Invoices (Bank transfers without linked invoices)
 * 3. VAT Inconsistencies (Gross != Net * (1 + TaxRate))
 */
export async function scanForLeaks(tenantId: string): Promise<LeakageAlert[]> {
    const alerts: LeakageAlert[] = []

    let adminDb: ReturnType<typeof getAdminDb>
    try {
        adminDb = getAdminDb()
    } catch {
        // Firebase Admin not initialized (build phase or missing env vars)
        return alerts
    }

    // 1. Detect Double Payments (Same amount, date, and category within short window)
    const transactionsSnap = await adminDb.collection("transactions")
        .where("tenantId", "==", tenantId)
        .get()

    const transactions = transactionsSnap.docs
        .map(d => ({ id: d.id, ...d.data() as any }))
        .filter(t => t.status === "ACTIVE")
        .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
        .slice(0, 100)

    for (let i = 0; i < transactions.length; i++) {
        for (let j = i + 1; j < transactions.length; j++) {
            const t1 = transactions[i]
            const t2 = transactions[j]

            const sameAmount = Number(t1.amount) === Number(t2.amount)
            const sameDate = t1.transactionDate === t2.transactionDate
            const sameCategory = t1.category === t2.category

            if (sameAmount && sameDate && sameCategory) {
                alerts.push({
                    id: `double-${t1.id}-${t2.id}`,
                    type: "DOUBLE_PAYMENT",
                    title: "Potencjalna podwójna płatność",
                    description: `Prawdopodobny duplikat transakcji na kwotę ${Number(t1.amount).toFixed(2)} PLN (Kategoria: ${t1.category})`,
                    severity: "CRITICAL",
                    entityId: t1.id
                })
            }
        }
    }

    // 2. Detect Missing Invoices (Large Bank Transactions without paired Transaction)
    const unmatchedSnap = await adminDb.collection("bank_transactions_raw")
        .where("tenantId", "==", tenantId)
        .where("status", "==", "UNPAIRED")
        .limit(20)
        .get()

    const unmatchedBankTrans = unmatchedSnap.docs
        .map(d => ({ id: d.id, ...d.data() as any }))
        .filter(bt => Number(bt.rawAmount) < 0)

    for (const bt of unmatchedBankTrans) {
        alerts.push({
            id: `missing-inv-${bt.id}`,
            type: "MISSING_INVOICE",
            title: "Zgubiony koszt (Brak faktury)",
            description: `Wydatek z konta bankowego (${Math.abs(Number(bt.rawAmount)).toFixed(2)} PLN) nie posiada przypisanej faktury ani transakcji w systemie.`,
            severity: "WARNING",
            entityId: bt.id
        })
    }

    // 3. VAT Inconsistency Check
    const invoicesSnap = await adminDb.collection("invoices")
        .where("tenantId", "==", tenantId)
        .where("status", "==", "ACTIVE")
        .limit(20)
        .get()

    const recentInvoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() as any }))

    for (const inv of recentInvoices) {
        const amountNet = Number(inv.amountNet)
        const taxRate = Number(inv.taxRate)
        const amountGross = Number(inv.amountGross)
        const expectedGross = Math.round(amountNet * (1 + taxRate) * 100) / 100

        if (Math.abs(amountGross - expectedGross) > 0.01) {
            alerts.push({
                id: `vat-err-${inv.id}`,
                type: "VAT_MISMATCH",
                title: "Błąd obliczeń VAT",
                description: `Faktura ${inv.externalId || inv.id} ma niespójną kwotę Brutto względem Netto+VAT. Różnica: ${(amountGross - expectedGross).toFixed(2)} PLN`,
                severity: "INFO",
                entityId: inv.id
            })
        }
    }

    return alerts
}

