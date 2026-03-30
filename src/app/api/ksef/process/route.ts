import { NextRequest, NextResponse } from 'next/server';
import { KSeFService } from '@/lib/ksef/ksefService';
import { KsefSessionManager } from '@/lib/ksef/ksefSessionManager';
import prisma from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import Decimal from "decimal.js";
import { syncInvoiceToFirestore, syncContractorToFirestore } from "@/lib/finance/sync-utils";
import { recalculateProjectBudget } from "@/app/actions/projects";

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Deep XML Sync can be slow for many records

/**
 * POST /api/ksef/process
 * Deep Sync: Download XML, parse details, and enrich Invoices/Contractors.
 * This also heals the Dual-Sync Drift by re-syncing records to Firestore.
 */
export async function POST(request: NextRequest) {
    try {
        const tenantId = await getCurrentTenantId();
        const ksefSvc = new KSeFService();
        const sessionMgr = new KsefSessionManager();

        // 1. Znajdź faktury wymagające dociągnięcia XML
        const pendingInvoices = await prisma.invoice.findMany({
            where: {
                tenantId,
                ksefId: { not: null },
                status: "XML_MISSING"
            },
            include: { contractor: true }
        });

        if (pendingInvoices.length === 0) {
            return NextResponse.json({
                success: true,
                message: "Brak faktur oczekujących na pobranie XML.",
                processedCount: 0
            });
        }

        console.log(`[DEEP_SYNC] Found ${pendingInvoices.length} invoices to process for tenant: ${tenantId}`);

        // 2. Autoryzacja sesji KSeF
        const accessToken = await sessionMgr.ensureAccessToken(tenantId);
        let processedCount = 0;
        let errorCount = 0;

        for (const invoice of pendingInvoices) {
            try {
                if (!invoice.ksefId) continue;

                console.log(`[DEEP_SYNC] Fetching XML for ${invoice.invoiceNumber || invoice.ksefId}...`);
                
                // KSeF API Download & Parse
                const parsed = await ksefSvc.fetchAndParse(invoice.ksefId, { accessToken });

                // 3. Atomowa aktualizacja Prisma (Invoice + KsefInvoice + Contractor)
                await prisma.$transaction(async (tx) => {
                    // Wyznaczenie kontrahenta na podstawie typu (Vector 094)
                    const isExpense = invoice.type === 'EXPENSE' || invoice.type === 'ZAKUP';
                    const targetNip = isExpense ? parsed.sellerNip : parsed.buyerNip;
                    const targetName = isExpense ? parsed.sellerName : parsed.buyerName;

                    // a) Główne dane faktury - Rygorystyczny UPDATE oparty na ksefId (Vector 098.2)
                    const updatedInvoice = await tx.invoice.update({
                        where: { ksefId: invoice.ksefId! }, // KLUCZOWE: Powiązanie kontekstu KSeF
                        data: {
                            amountNet: parsed.netAmount,
                            amountGross: parsed.grossAmount,
                            taxRate: parsed.netAmount.isZero() ? new Decimal(0) : parsed.vatAmount.div(parsed.netAmount).toDecimalPlaces(4),
                            invoiceNumber: parsed.invoiceNumber,
                            ksefType: parsed.ksefType,
                            status: "ACTIVE", // Przestawiamy z XML_MISSING na Aktywną
                            updatedAt: new Date()
                        },
                        include: { contractor: true }
                    });

                    // b) Pełna kopia XML w KsefInvoice (Tabela pomocnicza)
                    await tx.ksefInvoice.upsert({
                        where: { ksefNumber: invoice.ksefId! },
                        create: {
                            tenantId,
                            ksefNumber: invoice.ksefId!,
                            invoiceNumber: parsed.invoiceNumber,
                            issueDate: parsed.issueDate,
                            counterpartyNip: String(targetNip),
                            counterpartyName: String(targetName),
                            netAmount: parsed.netAmount,
                            vatAmount: parsed.vatAmount,
                            grossAmount: parsed.grossAmount,
                            rawXml: parsed.rawXml,
                            status: "IMPORTED"
                        },
                        update: {
                            rawXml: parsed.rawXml,
                            updatedAt: new Date()
                        }
                    });

                    // c) Wzbogacenie Kontrahenta (Healing Vector 095)
                    // Jeżeli kontrahent był "Nieznany", aktualizujemy go danymi z XML
                    if (updatedInvoice.contractor.nip === targetNip && 
                        (!updatedInvoice.contractor.name || updatedInvoice.contractor.name === 'Nieznany Kontrahent')) {
                        await tx.contractor.update({
                            where: { id: updatedInvoice.contractor.id },
                            data: { name: targetName }
                        });
                    }

                    // 4. [HEALING] Dual-Sync: Wymuszenie zapisu do Firestore
                    // To naprawia "Drift" - jeśli faktury nie było w FS, set() z merge:true ją stworzy.
                    await syncInvoiceToFirestore({
                        ...updatedInvoice,
                        amountNet: updatedInvoice.amountNet.toNumber(),
                        amountGross: updatedInvoice.amountGross.toNumber(),
                        taxRate: updatedInvoice.taxRate.toNumber(),
                        issueDate: updatedInvoice.issueDate.toISOString(),
                        dueDate: updatedInvoice.dueDate.toISOString(),
                        createdAt: updatedInvoice.createdAt.toISOString()
                    });

                    await syncContractorToFirestore(updatedInvoice.contractor);

                    // 5. Rekalkulacja Budżetu (jeśli przypisana do projektu)
                    if (updatedInvoice.projectId) {
                        try {
                            await recalculateProjectBudget(updatedInvoice.projectId);
                        } catch (recalcError) {
                            console.warn(`[DEEP_SYNC_RECALC_WARN] Failed to recalc budget for ${updatedInvoice.projectId}`);
                        }
                    }
                });

                processedCount++;
                console.log(`[DEEP_SYNC_OK] Successfully processed invoice: ${invoice.invoiceNumber}`);

            } catch (invoiceError: any) {
                errorCount++;
                console.error(`[DEEP_SYNC_ERROR] Failed for invoice ${invoice.id}:`, invoiceError.message);
                // Kontynuujemy pętlę dla pozostałych faktur
            }
        }

        return NextResponse.json({
            success: true,
            processedCount,
            errorCount,
            message: `Proces zakończony. Przetworzono ${processedCount} faktur. Błędy: ${errorCount}. SQL i Firestore są teraz zsynchronizowane (6/6).`
        });

    } catch (globalError: any) {
        console.error("[DEEP_SYNC_FATAL]", globalError);
        return NextResponse.json({
            success: false,
            error: globalError.message || "Błąd krytyczny procesora XML."
        }, { status: 500 });
    }
}
