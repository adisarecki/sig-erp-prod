export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import Decimal from "decimal.js";
import { getCurrentTenantId } from "@/lib/tenant";
import { MT940Parser } from "@/lib/mt940-parser";

/**
 * BANK RECONCILIATION ENGINE (Phase 11)
 * Supports: JSON (Manual) and MT940 (Automated)
 */
export async function POST(request: NextRequest) {
    try {
        const adminDb = getAdminDb();
        const tenantId = await getCurrentTenantId();
        const contentType = request.headers.get("content-type") || "";

        let incomingTransactions: any[] = [];

        // 1. Parser Logic: MT940 or JSON
        if (contentType.includes("text/plain") || contentType.includes("application/octet-stream")) {
            const rawContent = await request.text();
            incomingTransactions = MT940Parser.parse(rawContent).map(t => ({
                amount: t.amount.toNumber(),
                date: t.date.toISOString(),
                description: t.description,
                bankReference: t.bankReference,
                type: t.type,
                reference: t.reference
            }));
        } else {
            const body = await request.json();
            incomingTransactions = body.transactions || [];
        }

        if (!incomingTransactions.length) {
            return NextResponse.json({ error: "Brak danych transakcji." }, { status: 400 });
        }

        const results = {
            imported: 0,
            skipped: 0,
            matchedFull: 0,
            matchedPartial: 0,
            managementCosts: 0,
            errors: [] as string[],
        };

        const managementKeywords = [/Żabka/i, /Stokrotka/i, /Biedronka/i, /Prowizja/i, /ZUS/i, /Paliwo/i, /Orlen/i, /Shell/i, /Circle K/i, /Stacja/i, /Moya/i, /BP/i];
        const invoiceNumberRegex = /(FV|FS|FAKTURA|KOREKTA)[\s\/]?\d+/i;

        for (const t of incomingTransactions) {
            try {
                const amount = new Decimal(Math.abs(t.amount));
                const operationDate = new Date(t.date).toISOString();
                const description = t.description || "";
                const isIncome = t.type === 'INCOME';
                
                // Deduplication: Hash of Ref + Date + Amount
                const dedupeKey = `${t.reference || 'REF'}-${operationDate}-${amount.toFixed(2)}`;

                const duplicateQuery = await adminDb
                    .collection("transactions")
                    .where("tenantId", "==", tenantId)
                    .where("externalId", "==", dedupeKey)
                    .limit(1)
                    .get();

                if (!duplicateQuery.empty) {
                    results.skipped++;
                    continue;
                }

                const isManagementCost = !isIncome && managementKeywords.some(kw => kw.test(description));

                // 2. Automated Expense Routing (Non-Project)
                let matchedInvoiceId: string | null = null;
                let projectId: string | null = null;
                let category = isIncome ? "SPRZEDAŻ_TOWARU" : "KOSZT_FIRMOWY";
                let classification = "PROJECT_COST";

                if (isManagementCost) {
                    category = "KOSZTY_ZARZADU";
                    classification = "GENERAL_COST";
                    projectId = null;
                } else {
                    // 3. Reconciliation & Matching Algorithm
                    const match = description.match(invoiceNumberRegex);
                    const matchedRef = match ? match[0].toUpperCase() : null;

                    let matchingInvoiceQuery = null;
                    if (matchedRef) {
                        matchingInvoiceQuery = await adminDb
                            .collection("invoices")
                            .where("tenantId", "==", tenantId)
                            .where("externalId", "==", matchedRef)
                            .limit(1)
                            .get();
                    }

                    if (!matchingInvoiceQuery || matchingInvoiceQuery.empty) {
                        matchingInvoiceQuery = await adminDb
                            .collection("invoices")
                            .where("tenantId", "==", tenantId)
                            .where("status", "==", "ACTIVE")
                            .where("amountGross", "==", amount.toNumber())
                            .limit(1)
                            .get();
                    }

                    if (!matchingInvoiceQuery.empty) {
                        const invDoc = matchingInvoiceQuery.docs[0];
                        const invValue = invDoc.data() as any;
                        matchedInvoiceId = invDoc.id;
                        projectId = invValue.projectId;

                        const totalAmount = new Decimal(invValue.amountGross);

                        await adminDb.runTransaction(async (tx) => {
                            if (amount.gte(totalAmount)) {
                                tx.update(invDoc.ref, {
                                    status: "PAID",
                                    updatedAt: new Date().toISOString(),
                                });
                                results.matchedFull++;
                            } else {
                                tx.update(invDoc.ref, {
                                    status: "PARTIALLY_PAID",
                                    updatedAt: new Date().toISOString(),
                                });
                                
                                const balance = totalAmount.minus(amount);
                                const notifRef = adminDb.collection("notifications").doc();
                                tx.set(notifRef, {
                                    tenantId,
                                    type: "WARNING",
                                    title: "Red Light Alert: Niedopłata",
                                    message: `Wykryto niedopłatę dla faktury ${invValue.externalId || invDoc.id}. Brak: ${balance.toFixed(2)} PLN.`,
                                    priority: "HIGH",
                                    isRead: false,
                                    createdAt: new Date().toISOString(),
                                });
                                results.matchedPartial++;
                            }

                            const transRef = adminDb.collection("transactions").doc();
                            tx.set(transRef, {
                                tenantId,
                                projectId,
                                amount: amount.toNumber(),
                                type: isIncome ? "PRZYCHÓD" : "KOSZT",
                                transactionDate: operationDate,
                                category,
                                description: `[Import Bank] ${description}`,
                                status: "ACTIVE",
                                source: "BANK_IMPORT",
                                invoiceId: matchedInvoiceId,
                                externalId: dedupeKey,
                                bankTransactionId: t.bankReference || null,
                                classification,
                                createdAt: new Date().toISOString(),
                            });
                        });
                        results.imported++;
                        continue; // Transaction completed inside block
                    }
                }

                // If no matching invoice or management cost handled without transaction above
                await adminDb.collection("transactions").add({
                    tenantId,
                    projectId,
                    amount: amount.toNumber(),
                    type: isIncome ? "PRZYCHÓD" : "KOSZT",
                    transactionDate: operationDate,
                    category,
                    description: `[Import Bank] ${description}`,
                    status: "ACTIVE",
                    source: "BANK_IMPORT",
                    invoiceId: matchedInvoiceId,
                    externalId: dedupeKey,
                    bankTransactionId: t.bankReference || null,
                    classification,
                    createdAt: new Date().toISOString(),
                });

                if (isManagementCost) results.managementCosts++;
                results.imported++;

            } catch (e: any) {
                results.errors.push(`Błąd przy transakcji ${t.description || t.reference}: ${e.message}`);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Zaimportowano: ${results.imported}, Pełne: ${results.matchedFull}, Częściowe: ${results.matchedPartial}, Koszty Zarządu: ${results.managementCosts}`,
            report: results,
        });
    } catch (err: any) {
        console.error("BANK_IMPORT_ERROR:", err);
        return NextResponse.json({ error: "Błąd serwera: " + err.message }, { status: 500 });
    }
}