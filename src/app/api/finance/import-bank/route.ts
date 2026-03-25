export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import Decimal from "decimal.js";
import { getCurrentTenantId } from "@/lib/tenant";
import prisma from "@/lib/prisma";
import { parseCSV, parseMT940 } from "@/lib/bank/parsers";
import { normalizeTransaction } from "@/lib/bank/normalizer";
import { mapToERP, ERPTransaction } from "@/lib/bank/mapper";
import { RawTransaction } from "@/lib/bank/types";

/**
 * BANK IMPORT PIPELINE (Phase 13: 3-Layer Architecture)
 * Layer 1: Extract & Parse (win1250 support)
 * Layer 2: Normalize (Amounts/Dates)
 * Layer 3: Map & Save (Batch Logic)
 */
export async function POST(request: NextRequest) {
    try {
        const adminDb = getAdminDb();
        const tenantId = await getCurrentTenantId();
        const contentType = request.headers.get("content-type") || "";

        // -- LAYER 1: EXTRACT & PARSE --
        const arrayBuffer = await request.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const rawContent = buffer.toString("utf-8"); // For quick detection

        let rawTransactions: RawTransaction[] = [];

        if (contentType.includes("text/csv") || contentType.includes("application/vnd.ms-excel") || rawContent.includes("Data operacji") || rawContent.includes(";")) {
            rawTransactions = parseCSV(buffer);
        } else {
            rawTransactions = parseMT940(buffer);
        }

        if (!rawTransactions.length) {
            return NextResponse.json({ error: "Brak danych transakcji lub nieznany format." }, { status: 400 });
        }

        // -- LAYER 2: NORMALIZE --
        const normalizedTx = rawTransactions.map(t => normalizeTransaction(t));

        // -- LAYER 3: MAP & ENRICH --
        const erpTransactions = normalizedTx.map(t => mapToERP(t));

        const results = {
            processed: 0,
            imported: 0,
            skipped: 0,
            matchedFull: 0,
            matchedPartial: 0,
            managementCosts: 0,
            errors: [] as string[],
        };

        const invoiceNumberRegex = /(FV|FS|FAKTURA|KOREKTA)[\s\/]?\d+/i;

        // Enrichment & Reconciliation (Requires DB access, so we loop)
        const finalImportBatch: any[] = [];

        for (const t of erpTransactions) {
            try {
                results.processed++;
                const amount = new Decimal(t.amount);
                const operationDate = t.date.toISOString();
                const isIncome = t.type === 'INCOME';
                
                // 1. Entity Resolution (Cascading: Account -> Name)
                let matchedContractorId: string | null = null;
                
                // STEP 1: Match by Bank Account (IBAN/NRB)
                if (t.accountNumber) {
                    const contractor = await adminDb.collection("contractors")
                        .where("tenantId", "==", tenantId)
                        .where("bankAccounts", "array-contains", t.accountNumber)
                        .limit(1)
                        .get();
                    
                    if (!contractor.empty) {
                        matchedContractorId = contractor.docs[0].id;
                    }
                }

                // STEP 2: Fallback to Name (Fuzzy)
                if (!matchedContractorId && t.counterparty && t.counterparty !== "Nieznany") {
                    const contractorsQuery = await adminDb.collection("contractors")
                        .where("tenantId", "==", tenantId)
                        .get();
                    
                    const normalizeName = (s: string) => s.toLowerCase()
                        .replace(/\s+/g, '')
                        .replace(/(sp\.?zo\.?o\.?|s\.?a\.?|sp\.?k\.?|spółkazograniczonąodpowiedzialnością)/g, '');
                    
                    const tNameNormal = normalizeName(t.counterparty);

                    const match = contractorsQuery.docs.find(doc => {
                        const cNameNormal = normalizeName(doc.data().name);
                        return tNameNormal.includes(cNameNormal) || cNameNormal.includes(tNameNormal);
                    });
                    
                    if (match) {
                        matchedContractorId = match.id;

                        // --- SCENARIO 1: ENRICHMENT (Learning) ---
                        if (t.accountNumber) {
                            const currentAccounts = match.data().bankAccounts || [];
                            if (!currentAccounts.includes(t.accountNumber)) {
                                // 1. Update Firestore
                                await match.ref.update({
                                    bankAccounts: [...currentAccounts, t.accountNumber]
                                });

                                // 2. Update Prisma (Dual-Sync)
                                await prisma.contractor.update({
                                    where: { id: match.id },
                                    data: { bankAccounts: { push: t.accountNumber } } as any
                                }).catch(err => console.error("[ENRICHMENT_ERROR_PRISMA]", err));
                                
                                console.log(`[ENRICHMENT] Learned new account ${t.accountNumber} for contractor ${match.data().name}`);
                            }
                        }
                    }
                }

                // 2. Deduplication
                const dedupeKey = `${t.reference}-${operationDate}-${amount.toFixed(2)}`;
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

                // 3. Reconciliation & Project Matching
                let matchedInvoiceId: string | null = null;
                let projectId: string | null = t.projectId;
                let classification = t.classification;
                let category = t.category;

                if (!t.isTaxOrZus && !t.isManagementCost) {
                    const match = t.description.match(invoiceNumberRegex);
                    const matchedRef = match ? match[0].toUpperCase() : null;

                    let matchingInvoiceQuery = null;
                    if (matchedRef) {
                        matchingInvoiceQuery = await adminDb.collection("invoices")
                            .where("tenantId", "==", tenantId)
                            .where("externalId", "==", matchedRef)
                            .limit(1).get();
                    }

                    if (!matchingInvoiceQuery || matchingInvoiceQuery.empty) {
                        matchingInvoiceQuery = await adminDb.collection("invoices")
                            .where("tenantId", "==", tenantId)
                            .where("status", "==", "ACTIVE")
                            .where("amountGross", "==", amount.toNumber())
                            .limit(1).get();
                    }

                    if (!matchingInvoiceQuery.empty) {
                        const invDoc = matchingInvoiceQuery.docs[0];
                        const invValue = invDoc.data() as any;
                        matchedInvoiceId = invDoc.id;
                        projectId = invValue.projectId;
                        classification = "PROJECT_COST";

                        const totalAmount = new Decimal(invValue.amountGross);

                        // Update Invoice in Batch Transaction later or here?
                        // For consistency, we'll update Firestore doc here
                        if (amount.gte(totalAmount)) {
                            await invDoc.ref.update({ status: "PAID", updatedAt: new Date().toISOString() });
                            results.matchedFull++;
                        } else {
                            await invDoc.ref.update({ status: "PARTIALLY_PAID", updatedAt: new Date().toISOString() });
                            results.matchedPartial++;
                        }
                    }
                }

                // Collect for Final Batch
                const finalTx = {
                    tenantId,
                    projectId,
                    amount: amount.toNumber(),
                    type: isIncome ? "PRZYCHÓD" : "KOSZT",
                    transactionDate: operationDate,
                    category,
                    description: `[Pipeline Import] ${t.description}`,
                    title: t.title,
                    counterpartyRaw: t.counterparty,
                    matchedContractorId,
                    tags: t.tags.length > 0 ? t.tags.join(", ") : null,
                    status: "ACTIVE",
                    source: "BANK_IMPORT",
                    invoiceId: matchedInvoiceId,
                    externalId: dedupeKey,
                    classification,
                    createdAt: new Date().toISOString(),
                };

                finalImportBatch.push(finalTx);
                if (t.isManagementCost) results.managementCosts++;
                results.imported++;

            } catch (e: any) {
                results.errors.push(`Błąd przy transakcji ${t.title}: ${e.message}`);
            }
        }

        // -- FINAL LAYER: BATCH SAVE --
        if (finalImportBatch.length > 0) {
            // Firestore Batch
            const batch = adminDb.batch();
            for (const txData of finalImportBatch) {
                const docRef = adminDb.collection("transactions").doc();
                batch.set(docRef, txData);
            }
            await batch.commit();

            // Prisma createMany (Sync check)
            await prisma.transaction.createMany({
                data: finalImportBatch.map(tx => ({
                    tenantId: tx.tenantId,
                    projectId: tx.projectId,
                    amount: new Decimal(tx.amount),
                    type: tx.type === "PRZYCHÓD" ? "INCOME" : "EXPENSE",
                    transactionDate: new Date(tx.transactionDate),
                    category: tx.category,
                    description: tx.description,
                    counterpartyRaw: tx.counterpartyRaw,
                    status: "ACTIVE",
                    source: "BANK_IMPORT",
                    externalId: tx.externalId,
                    classification: tx.classification,
                    title: tx.title,
                    tags: tx.tags
                })),
                skipDuplicates: true
            });
        }

        return NextResponse.json({
            success: true,
            message: `Pipeline ukończony. Zaimportowano: ${results.imported}, Pominięto: ${results.skipped}`,
            report: results,
        });

    } catch (err: any) {
        console.error("PIPELINE_CRITICAL_ERROR:", err);
        return NextResponse.json({ 
            success: false, 
            error: "Błąd krytyczny potoku importu: " + (err.message || "Unknown error") 
        }, { status: 500 });
    }
}