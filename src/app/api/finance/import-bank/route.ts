export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import Decimal from "decimal.js";
import { getCurrentTenantId } from "@/lib/tenant";
import prisma from "@/lib/prisma";
import iconv from "iconv-lite";
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
        
        // Use iconv to decode for detection and parsing to keep encoding consistent
        const contentForDetection = iconv.decode(buffer, "win1250");

        let rawTransactions: RawTransaction[] = [];

        if (contentType.includes("text/csv") || contentType.includes("application/vnd.ms-excel") || contentForDetection.includes("Data operacji") || contentForDetection.includes(";") || contentForDetection.includes(",")) {
            rawTransactions = parseCSV(buffer);
        } else {
            console.warn("[IMPORT_WARNING] Fallback to MT940 detected. CSV is preferred.");
            rawTransactions = parseMT940(buffer);
        }

        if (!rawTransactions.length) {
            return NextResponse.json({ 
                error: "Nie wykryto transakcji. Upewnij się, że przesyłasz prawidłowy plik CSV z PKO BP." 
            }, { status: 400 });
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
                let matchingContractorDoc: any = null;
                let matchType: 'IBAN' | 'NAME' | null = null;

                // STEP 1: Match by Bank Account (Strict IBAN/NRB)
                if (t.accountNumber) {
                    const contractor = await adminDb.collection("contractors")
                        .where("tenantId", "==", tenantId)
                        .where("bankAccounts", "array-contains", t.accountNumber)
                        .limit(1)
                        .get();
                    
                    if (!contractor.empty) {
                        matchingContractorDoc = contractor.docs[0];
                        matchedContractorId = matchingContractorDoc.id;
                        matchType = 'IBAN';
                    }
                }

                // STEP 2: Fallback to Vendor Name (Fuzzy)
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
                        matchingContractorDoc = match;
                        matchedContractorId = match.id;
                        matchType = 'NAME';
                    }
                }

                // --- SELF-LEARNING (Bi-directional Enrichment) ---
                // IF match found by Vendor (Step 2) AND IBAN is present AND DB bankAccounts is empty or doesn't have it
                if (matchType === 'NAME' && matchedContractorId && matchingContractorDoc && t.accountNumber) {
                    const currentAccounts = matchingContractorDoc.data().bankAccounts || [];
                    if (!currentAccounts.includes(t.accountNumber)) {
                        // Złota Reguła: Learn the account number from the first transfer
                        console.log(`[SELF-LEARNING] Learning IBAN ${t.accountNumber} for contractor ${matchingContractorDoc.data().name}`);
                        
                        // 1. Update Firestore
                        await matchingContractorDoc.ref.update({
                            bankAccounts: [...currentAccounts, t.accountNumber],
                            updatedAt: new Date().toISOString()
                        });

                        // 2. Update Prisma (Dual-Sync)
                        await prisma.contractor.update({
                            where: { id: matchingContractorDoc.id },
                            data: { bankAccounts: { push: t.accountNumber } } as any
                        }).catch(err => console.error("[ENRICHMENT_ERROR_PRISMA]", err));
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
                const finalTx: any = {
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
                    nip: t.nip || null,
                    iban: t.iban || t.accountNumber || null,
                    address: t.address || null,
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
            transactions: finalImportBatch.map(tx => ({
                data: tx.transactionDate,
                kwota: tx.amount,
                typ: tx.type,
                kontrahent_clean: tx.counterpartyRaw,
                nip: tx.nip,
                iban: tx.iban,
                adres_clean: tx.address,
                tytul: tx.title
            }))
        });

    } catch (err: any) {
        console.error("PIPELINE_CRITICAL_ERROR:", err);
        return NextResponse.json({ 
            success: false, 
            error: "Błąd krytyczny potoku importu: " + (err.message || "Unknown error") 
        }, { status: 500 });
    }
}