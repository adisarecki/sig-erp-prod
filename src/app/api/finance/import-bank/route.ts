export const dynamic = "force-dynamic"; // 🔹 zapobiega build-time execution

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import Decimal from "decimal.js";
import { getCurrentTenantId } from "@/lib/tenant";

export async function POST(request: NextRequest) {
    try {
        // 🔹 inicjalizacja Firebase Admin tylko przed użyciem DB
        const adminDb = getAdminDb();

        const tenantId = await getCurrentTenantId();
        const body = await request.json();
        const { transactions } = body;

        if (!transactions || !Array.isArray(transactions)) {
            return NextResponse.json(
                { error: "Brak danych transakcji w formacie tablicy." },
                { status: 400 }
            );
        }

        const results = {
            imported: 0,
            skipped: 0,
            matchedInvoices: 0,
            errors: [] as string[],
        };

        for (const t of transactions) {
            try {
                const amount = new Decimal(t.amount);
                const operationDate = new Date(t.date).toISOString();
                const description = t.description;

                // --- DUPLIKAT ---
                const duplicateQuery = await adminDb
                    .collection("transactions")
                    .where("tenantId", "==", tenantId)
                    .where("amount", "==", amount.toNumber())
                    .where("transactionDate", "==", operationDate)
                    .where("description", "==", `[Import Bank] ${description}`)
                    .limit(1)
                    .get();

                if (!duplicateQuery.empty) {
                    results.skipped++;
                    continue;
                }

                // --- MATCH FAKTURY ---
                const matchingInvoiceQuery = await adminDb
                    .collection("invoices")
                    .where("tenantId", "==", tenantId)
                    .where("status", "==", "ACTIVE")
                    .where("amountGross", "==", amount.toNumber())
                    .limit(1)
                    .get();

                if (!matchingInvoiceQuery.empty) {
                    const invDoc = matchingInvoiceQuery.docs[0];
                    const inv = invDoc.data();

                    await adminDb.runTransaction(async (transaction) => {
                        transaction.update(invDoc.ref, {
                            status: "PAID",
                            updatedAt: new Date().toISOString(),
                        });

                        const transRef = adminDb.collection("transactions").doc();
                        transaction.set(transRef, {
                            tenantId,
                            projectId: inv.projectId,
                            amount: amount.toNumber(),
                            type: inv.type === "SPRZEDAŻ" ? "PRZYCHÓD" : "KOSZT",
                            transactionDate: operationDate,
                            category:
                                inv.type === "SPRZEDAŻ" ? "SPRZEDAŻ_TOWARU" : "KOSZT_FIRMOWY",
                            description: `[Import Bank] ${description}`,
                            status: "ACTIVE",
                            source: "BANK_IMPORT",
                            invoiceId: invDoc.id,
                            createdAt: new Date().toISOString(),
                        });
                    });

                    results.matchedInvoices++;
                    results.imported++;
                } else {
                    await adminDb.collection("transactions").add({
                        tenantId,
                        amount: amount.toNumber(),
                        type: amount.gt(0) ? "PRZYCHÓD" : "KOSZT",
                        transactionDate: operationDate,
                        category: "INNE",
                        description: `[Import Bank] ${description}`,
                        status: "ACTIVE",
                        source: "BANK_IMPORT",
                        createdAt: new Date().toISOString(),
                    });

                    results.imported++;
                }
            } catch (e: any) {
                results.errors.push(
                    `Błąd przy transakcji ${t.description}: ${e.message}`
                );
            }
        }

        return NextResponse.json({
            success: true,
            message: "Import zakończony (Firestore)",
            report: results,
        });
    } catch (err: any) {
        console.error("BANK_IMPORT_ERROR:", err);
        return NextResponse.json(
            { error: "Błąd serwera podczas importu." },
            { status: 500 }
        );
    }
}