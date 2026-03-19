export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server"
import { initFirebaseAdmin, getAdminDb } from "@/lib/firebaseAdmin"
import Decimal from "decimal.js"
import { getCurrentTenantId } from "@/lib/tenant"

// Inicjalizacja Firebase Admin natychmiast po imporcie, 
// aby uniknąć błędów 'app does not exist' podczas statycznego zbierania danych.
initFirebaseAdmin();

/**
 * Zmodernizowany Import Wyciągów Bankowych (Firestore NoSQL Edition) 🚀
 */
export async function POST(request: NextRequest) {
    const adminDb = getAdminDb()
    try {
        const tenantId = await getCurrentTenantId()
        const body = await request.json()
        const { transactions } = body

        if (!transactions || !Array.isArray(transactions)) {
            return NextResponse.json({ error: "Brak danych transakcji w formacie tablicy." }, { status: 400 })
        }

        const results = {
            imported: 0,
            skipped: 0,
            matchedInvoices: 0,
            errors: [] as string[]
        }

        for (const t of transactions) {
            try {
                const amount = new Decimal(t.amount)
                const operationDate = new Date(t.date).toISOString()
                const description = t.description

                // --- 1. DETEKTOR DUPLIKATÓW (Firestore) ---
                const duplicateQuery = await adminDb.collection("transactions")
                    .where("tenantId", "==", tenantId)
                    .where("amount", "==", amount.toNumber())
                    .where("transactionDate", "==", operationDate)
                    .where("description", "==", `[Import Bank] ${description}`)
                    .limit(1)
                    .get()

                if (!duplicateQuery.empty) {
                    results.skipped++
                    continue
                }

                // --- 2. PRIORYTET FAKTURY (Dopasowanie do UNPAID w NoSQL) ---
                const matchingInvoiceQuery = await adminDb.collection("invoices")
                    .where("tenantId", "==", tenantId)
                    .where("status", "==", "ACTIVE")
                    .where("amountGross", "==", amount.toNumber())
                    .limit(1)
                    .get()

                if (!matchingInvoiceQuery.empty) {
                    const invDoc = matchingInvoiceQuery.docs[0]
                    const inv = invDoc.data()

                    await adminDb.runTransaction(async (transaction) => {
                        // Rozliczamy fakturę
                        transaction.update(invDoc.ref, {
                            status: "PAID",
                            updatedAt: new Date().toISOString()
                        })

                        // Tworzymy transakcję powiązaną
                        const transRef = adminDb.collection("transactions").doc()
                        transaction.set(transRef, {
                            tenantId,
                            projectId: inv.projectId,
                            amount: amount.toNumber(),
                            type: inv.type === "SPRZEDAŻ" ? "PRZYCHÓD" : "KOSZT",
                            transactionDate: operationDate,
                            category: inv.type === "SPRZEDAŻ" ? "SPRZEDAŻ_TOWARU" : "KOSZT_FIRMOWY",
                            description: `[Import Bank] ${description}`,
                            status: "ACTIVE",
                            source: "BANK_IMPORT",
                            invoiceId: invDoc.id,
                            createdAt: new Date().toISOString()
                        })
                    })
                    results.matchedInvoices++
                    results.imported++
                } else {
                    // Brak faktury - tworzymy nową transakcję wolną
                    await adminDb.collection("transactions").add({
                        tenantId,
                        amount: amount.toNumber(),
                        type: amount.gt(0) ? "PRZYCHÓD" : "KOSZT",
                        transactionDate: operationDate,
                        category: "INNE",
                        description: `[Import Bank] ${description}`,
                        status: "ACTIVE",
                        source: "BANK_IMPORT",
                        createdAt: new Date().toISOString()
                    })
                    results.imported++
                }

            } catch (e: any) {
                results.errors.push(`Błąd przy transakcji ${t.description}: ${e.message}`)
            }
        }

        return NextResponse.json({
            success: true,
            message: "Import zakończony (Firestore)",
            report: results
        })

    } catch (err: any) {
        console.error("BANK_IMPORT_ERROR:", err)
        return NextResponse.json({ error: "Błąd serwera podczas importu." }, { status: 500 })
    }
}
