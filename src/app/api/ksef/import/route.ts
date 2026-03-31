import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTenantId } from '@/lib/tenant';
import prisma from '@/lib/prisma';
import { KSeFService } from '@/lib/ksef/ksefService';
import Decimal from 'decimal.js';
import { syncContractorToFirestore, syncInvoiceToFirestore } from '@/lib/finance/sync-utils';
import { recalculateProjectBudget } from '@/app/actions/projects';

/**
 * POST /api/ksef/import
 * VECTOR 103: Deep Settle (Bramka KSeF Inbox)
 * Finalizes selected invoices from the KSeF buffer and moves them to the main ledger.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { ksefIds } = body; // Array of ksefNumber/ksefId strings

        if (!ksefIds || !Array.isArray(ksefIds) || ksefIds.length === 0) {
            return NextResponse.json({ success: false, error: "Brak faktur do zaksięgowania." }, { status: 400 });
        }

        const tenantId = await getCurrentTenantId();
        const ksefService = new KSeFService();
        
        let sessionToken: string;
        try {
            sessionToken = await ksefService.getSessionToken();
        } catch (err: any) {
            console.error("[KSeF_IMPORT_AUTH_ERROR]", err.message);
            return NextResponse.json({ success: false, error: `Błąd autoryzacji KSeF: ${err.message}` }, { status: 401 });
        }

        const stats = { imported: 0, skipped: 0, errors: 0 };
        const results = [];

        for (const ksefId of ksefIds) {
            try {
                // 1. Absolute Duplicate Shield (Vector 098.1)
                const existing = await prisma.invoice.findUnique({ where: { ksefId } });
                if (existing) {
                    console.warn(`[KSeF_SHIELD] Vector 098 Triggered: Double Billing Blocked for ${ksefId}`);
                    stats.skipped++;
                    continue;
                }

                // 2. Load from Inbox Buffer (PENDING)
                const buffered = await prisma.ksefInvoice.findUnique({ 
                    where: { ksefNumber: ksefId } 
                });

                if (!buffered) {
                    console.warn(`[KSeF_IMPORT] Missing buffer record for ${ksefId}`);
                    stats.errors++;
                    continue;
                }

                // 3. Fetch Full Details if buffer is incomplete or we need the most recent XML
                // (Already has XML, but we fetch detail to get the structure for Enrichment)
                const detail = await ksefService.fetchAndParse(ksefId, { accessToken: sessionToken });

                // 4. Contractor Sync & Enrichment (Vector 094 / 099)
                const nip = detail.sellerNip;
                const name = detail.sellerName;
                
                let contractor = await prisma.contractor.findUnique({ where: { tenantId_nip: { tenantId, nip } } });

                if (!contractor) {
                    contractor = await prisma.contractor.create({
                        data: { 
                            tenantId, 
                            nip, 
                            name, 
                            status: 'ACTIVE', 
                            type: 'DOSTAWCA' // Assume expense for purchase sync (Subject2)
                        }
                    });
                    await syncContractorToFirestore(contractor);
                }

                // Smart Enrichment Check (Vector 099)
                const { compareAndNotify } = await import("@/lib/finance/contractorEnricher");
                await compareAndNotify(detail, tenantId);

                // 5. Hardened Duplicate Shield (Vector 098.2): Atomic Presence Check
                // Even with findUnique above, we use catch for P2002 to be absolutely sure.
                let newInvoice;
                try {
                    newInvoice = await prisma.invoice.create({
                        data: {
                            tenantId,
                            contractorId: contractor.id,
                            ksefId,
                            invoiceNumber: detail.invoiceNumber,
                            type: 'EXPENSE',
                            amountNet: detail.netAmount,
                            amountGross: detail.grossAmount,
                            taxRate: detail.netAmount.isZero() ? new Decimal(0) : detail.vatAmount.div(detail.netAmount).toDecimalPlaces(4),
                            issueDate: detail.issueDate,
                            dueDate: detail.dueDate,
                            paymentStatus: 'UNPAID',
                            status: 'ACTIVE',
                            ksefType: detail.ksefType
                        }
                    });
                } catch (dbErr: any) {
                    if (dbErr.code === 'P2002') {
                        console.warn(`[KSeF_SHIELD] DB unique constraint hit for ${ksefId}. Blocking duplicate.`);
                        stats.skipped++;
                        results.push({ ksefId, success: false, error: "Vector 098 Triggered: Double Billing Blocked" });
                        continue;
                    }
                    throw dbErr;
                }

                // 6. Update Buffer Status to ACCEPTED
                await prisma.ksefInvoice.update({
                    where: { ksefNumber: ksefId },
                    data: { status: 'ACCEPTED' as any } // Cast to handle lint/runtime-sync delay
                });

                // 7. Sync to Firestore & Recalculate (Vector 101/096)
                await syncInvoiceToFirestore({
                    ...newInvoice,
                    amountNet: newInvoice.amountNet.toNumber(),
                    amountGross: newInvoice.amountGross.toNumber(),
                    taxRate: newInvoice.taxRate.toNumber()
                });

                // If invoice is linked to a project in the future, we'd call recalculate here.
                // For now, it updates the global income/expense pool for Dashboard Health (Wector 101.1).

                stats.imported++;
                results.push({ ksefId, success: true });

            } catch (err: any) {
                console.error(`[IMPORT_ITEM_ERROR] ${ksefId}:`, err.message);
                stats.errors++;
            }
        }

        return NextResponse.json({
            success: true,
            stats,
            message: `Zaksięgowano ${stats.imported} faktur w systemie. Pominięto: ${stats.skipped}. Błędy: ${stats.errors}.`
        });

    } catch (error: unknown) {
        const err = error as Error;
        console.error("[KSeF_API_IMPORT_ERROR]", err);
        return NextResponse.json(
            { success: false, error: err.message || "Wystąpił błąd podczas księgowania faktur Inboxa." },
            { status: 500 }
        );
    }
}
