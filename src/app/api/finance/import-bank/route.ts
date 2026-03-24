export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import Decimal from "decimal.js";
import { getCurrentTenantId } from "@/lib/tenant";
import { MT940Parser } from "@/lib/mt940-parser";
import { CSVBankParser } from "@/lib/csv-bank-parser";

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

        // 1. Parser Logic: CSV, MT940 or JSON
        if (contentType.includes("text/csv") || contentType.includes("application/vnd.ms-excel")) {
            const rawContent = await request.text();
            incomingTransactions = CSVBankParser.parse(rawContent).map(t => ({
                amount: t.amount,
                date: t.transactionDate,
                title: t.title,
                counterparty: t.counterpartyRaw,
                description: t.description,
                typeDescription: t.typeDescription,
                reference: t.reference,
                type: t.type
            }));
        } else if (contentType.includes("text/plain") || contentType.includes("application/octet-stream")) {
            const rawContent = await request.text();
            
            // Check if it's actually a CSV (PKO BP CSV starts with "Data operacji")
            if (rawContent.includes("Data operacji") || rawContent.includes("Kwota") || rawContent.includes(";")) {
                incomingTransactions = CSVBankParser.parse(rawContent).map(t => ({
                    amount: t.amount,
                    date: t.transactionDate,
                    title: t.title,
                    counterparty: t.counterpartyRaw,
                    description: t.description,
                    typeDescription: t.typeDescription,
                    reference: t.reference,
                    type: t.type
                }));
            } else {
                incomingTransactions = MT940Parser.parse(rawContent).map(t => ({
                    amount: t.amount.toNumber(),
                    date: t.date.toISOString(),
                    description: t.description,
                    title: t.title,
                    counterparty: t.counterparty,
                    bankReference: t.bankReference,
                    type: t.type,
                    reference: t.reference
                }));
            }
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
                const title = t.title || "Transakcja Bankowa";
                const counterpartyRaw = t.counterparty || "Nieznany";
                const isIncome = t.type === 'INCOME';
                
                // 1. Entity Resolution (Fuzzy match counterparty to DB)
                let matchedContractorId: string | null = null;
                if (counterpartyRaw && counterpartyRaw !== "Nieznany") {
                    const contractor = await adminDb.collection("contractors")
                        .where("tenantId", "==", tenantId)
                        .orderBy("name")
                        .get();
                    
                    // Simple fuzzy match: name exists in counterpartyRaw or vice versa
                    const match = contractor.docs.find(doc => {
                        const name = doc.data().name.toLowerCase();
                        const raw = counterpartyRaw.toLowerCase();
                        return raw.includes(name) || name.includes(raw);
                    });
                    
                    if (match) matchedContractorId = match.id;
                }

                // 2. Auto-Tagging Middleware
                let tags: string[] = [];
                if (!isIncome && (title.match(/PALIWO|ORLEN|BP|SHELL|STACJA/i) || description.match(/PALIWO|ORLEN|BP|SHELL|STACJA/i))) {
                    tags.push("KOSZTY OGÓLNE FIRMY", "PALIWO");
                }
                if (title.match(/USŁUGI|PODWYKONAWCA|MONTAŻ|PRACE/i)) {
                    tags.push("WYMAGA PRZYPISANIA DO PROJEKTU");
                }

                const tagsStr = tags.length > 0 ? tags.join(", ") : null;

                // Deduplication: Hash of Ref + Date + Amount + Type
                const dedupeKey = `${t.reference || 'REF'}-${operationDate}-${amount.toFixed(2)}-${t.typeDescription || 'NA'}`;

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

                const isManagementCost = !isIncome && (
                    tags.includes("KOSZTY OGÓLNE FIRMY") || 
                    managementKeywords.some(kw => kw.test(description) || kw.test(title) || kw.test(counterpartyRaw)) ||
                    ["ZABKA", "ORLEN", "CIRCLE K", "STOKROTKA", "BIEDRONKA", "SHELL", "LIDL", "BP", "MOYA", "ARKADIA", "BULECKA"].includes(counterpartyRaw.toUpperCase())
                );

                const isTaxOrZus = !isIncome && (
                    counterpartyRaw.match(/ZUS|PODATKI|URZAD SKARBOWY/i) || 
                    title.match(/ZUS|PODATKI|VAT|PIT|CIT/i) ||
                    (t.typeDescription && t.typeDescription.match(/ZUS|PODATEK/i))
                );

                // 3. Automated Expense Routing (Non-Project)
                let matchedInvoiceId: string | null = null;
                let projectId: string | null = null;
                let category = isIncome ? "SPRZEDAŻ_TOWARU" : "KOSZT_FIRMOWY";
                let classification = "PROJECT_COST";

                if (isTaxOrZus) {
                    category = "ZUS_PODATKI";
                    classification = "GENERAL_COST";
                    projectId = null;
                } else if (isManagementCost) {
                    category = "KOSZTY_ZARZADU";
                    classification = "GENERAL_COST";
                    projectId = null;
                } else {
                    // 4. Reconciliation & Matching Algorithm
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
                            const transData = {
                                tenantId,
                                projectId,
                                amount: amount.toNumber(),
                                type: isIncome ? "PRZYCHÓD" : "KOSZT",
                                transactionDate: operationDate,
                                category,
                                description: `[Import Bank] ${description}`,
                                title,
                                counterpartyRaw,
                                matchedContractorId,
                                tags: tagsStr,
                                status: "ACTIVE",
                                source: "BANK_IMPORT",
                                invoiceId: matchedInvoiceId,
                                externalId: dedupeKey,
                                bankTransactionId: t.bankReference || null,
                                classification,
                                createdAt: new Date().toISOString(),
                            };
                            tx.set(transRef, transData);
                        });
                        results.imported++;
                        continue; 
                    }
                }

                // Standard Record (Fallback)
                const docRef = await adminDb.collection("transactions").add({
                    tenantId,
                    projectId,
                    amount: amount.toNumber(),
                    type: isIncome ? "PRZYCHÓD" : "KOSZT",
                    transactionDate: operationDate,
                    category,
                    description: `[Import Bank] ${description}`,
                    title,
                    counterpartyRaw,
                    matchedContractorId,
                    tags: tagsStr,
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