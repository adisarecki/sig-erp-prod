import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTenantId } from '@/lib/tenant';
import prisma from '@/lib/prisma';
import { KSeFService } from '@/lib/ksef/ksefService';
import Decimal from 'decimal.js';
import { syncContractorToFirestore, syncInvoiceToFirestore } from '@/lib/finance/sync-utils';
import { recalculateProjectBudget } from '@/app/actions/projects';
import { randomUUID } from 'crypto';

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
                    stats.skipped++;
                    continue;
                }

                // 2. Load from Inbox Buffer (PENDING)
                const buffered = await prisma.ksefInvoice.findUnique({ where: { ksefNumber: ksefId } });
                if (!buffered) {
                    stats.errors++;
                    continue;
                }

                const detail = await ksefService.fetchAndParse(ksefId, { accessToken: sessionToken });
                const nip = detail.sellerNip;
                const name = detail.sellerName;
                
                // --- FINANCIAL MASTER WRITE (POSTGRES - Vector 110) ---
                const dbResult = await prisma.$transaction(async (tx: any) => {
                    // A. Contractor Resolution
                    let contractor = await tx.contractor.findUnique({ where: { tenantId_nip: { tenantId, nip } } });
                    let isNewContractor = false;
                    if (!contractor) {
                        const newCtrId = randomUUID();
                        contractor = await tx.contractor.create({
                            data: { id: newCtrId, tenantId, nip, name, status: 'ACTIVE', type: 'DOSTAWCA' }
                        });
                        isNewContractor = true;
                    }

                    // B. Business Duplicate Anchor (Vector 098.3)
                    const businessDuplicate = await tx.invoice.findFirst({
                        where: { contractorId: contractor.id, invoiceNumber: detail.invoiceNumber }
                    });
                    if (businessDuplicate) throw new Error(`DUBEL_BIZNESOWY: ${detail.invoiceNumber}`);

                    // C. Atomic Invoice Creation
                    const invoiceId = randomUUID();
                    const invoice = await tx.invoice.create({
                        data: {
                            id: invoiceId,
                            tenantId,
                            contractorId: contractor.id,
                            ksefId,
                            invoiceNumber: detail.invoiceNumber,
                            type: 'EXPENSE',
                            amountNet: detail.netAmount.toNumber(),
                            amountGross: detail.grossAmount.toNumber(),
                            taxRate: detail.netAmount.isZero() ? 0 : detail.vatAmount.div(detail.netAmount).toDecimalPlaces(4).toNumber(),
                            issueDate: detail.issueDate,
                            dueDate: detail.dueDate,
                            status: 'ACTIVE',
                            ksefType: detail.ksefType
                        }
                    });

                    // D. Central Ledger Entry (SSoT - Vector 109)
                    const { recordInvoiceToLedger } = await import("@/lib/finance/ledger-manager");
                    await recordInvoiceToLedger({
                        tenantId,
                        invoiceId: invoiceId,
                        amountNet: detail.netAmount,
                        vatAmount: detail.vatAmount,
                        type: 'EXPENSE',
                        date: detail.issueDate
                    }, tx);

                    // E. Update Buffer Status
                    await tx.ksefInvoice.update({
                        where: { ksefNumber: ksefId },
                        data: { status: 'ACCEPTED' }
                    });

                    return { invoice, contractorId: contractor.id, isNewContractor };
                });

                // --- OPERATIONAL MIRROR SYNC (FIRESTORE) ---
                if (dbResult.isNewContractor) {
                    const cSnap = await prisma.contractor.findUnique({ where: { id: dbResult.contractorId } });
                    if (cSnap) await syncContractorToFirestore(cSnap);
                }

                await syncInvoiceToFirestore({
                    ...dbResult.invoice,
                    amountNet: Number(dbResult.invoice.amountNet),
                    amountGross: Number(dbResult.invoice.amountGross),
                    taxRate: Number(dbResult.invoice.taxRate)
                });

                // Enrichment Check (Non-critical operational data)
                try {
                    const { compareAndNotify } = await import("@/lib/finance/contractorEnricher");
                    await compareAndNotify(detail, tenantId);
                } catch ( enrichmentErr ) {
                    console.warn("[KSEF_ENRICHMENT_WARN]", enrichmentErr);
                }

                stats.imported++;
                results.push({ ksefId, success: true });
            } catch (err: any) {
                console.error(`[KSEF_IMPORT_ITEM_ERROR] ${ksefId}:`, err.message);
                stats.errors++;
                results.push({ ksefId, success: false, error: err.message });
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
