import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTenantId } from '@/lib/tenant';
import prisma from '@/lib/prisma';
import { KSeFService } from '@/lib/ksef/ksefService';
import Decimal from 'decimal.js';
import { syncContractorToFirestore, syncInvoiceToFirestore } from '@/lib/finance/sync-utils';
import { recalculateProjectBudget } from '@/app/actions/projects';

/**
 * POST /api/ksef/import
 * VECTOR 103: Deep Sync (Strefa Buforowa)
 * Imports selected invoices into the main system.
 * This handles Contractor upsert, Invoice creation, and immediate enrichment if possible.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { invoices } = body; // Array of metadata objects from shallow sync

        if (!invoices || !Array.isArray(invoices) || invoices.length === 0) {
            return NextResponse.json({ success: false, error: "Brak faktur do importu." }, { status: 400 });
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

        for (const item of invoices) {
            try {
                const ksefId = item.ksefId;
                if (!ksefId) continue;

                // 1. Check if already exists (Safety Double-Check)
                const existing = await prisma.invoice.findUnique({ where: { ksefId } });
                if (existing) {
                    stats.skipped++;
                    continue;
                }

                const isIncome = item.direction === "INCOME";
                const nip = item.nip;
                const name = item.name;

                // 2. Contractor Sync (Vector 094)
                let contractor = await prisma.contractor.findUnique({ where: { tenantId_nip: { tenantId, nip } } });

                if (!contractor) {
                    contractor = await prisma.contractor.create({
                        data: { tenantId, nip, name, status: 'PENDING', type: isIncome ? 'KLIENT' : 'DOSTAWCA' }
                    });
                    await syncContractorToFirestore(contractor);
                } else if (!contractor.name || contractor.name === 'Nieznany Kontrahent') {
                    contractor = await prisma.contractor.update({ where: { id: contractor.id }, data: { name } });
                    await syncContractorToFirestore(contractor);
                }

                // 3. Create Invoice skeleton (status: XML_MISSING)
                const amountNet = new Decimal(item.amountNet || 0);
                const amountGross = new Decimal(item.amountGross || 0);
                const vatAmount = amountGross.minus(amountNet);

                const newInvoice = await prisma.invoice.create({
                    data: {
                        tenantId,
                        contractorId: contractor.id,
                        ksefId,
                        invoiceNumber: item.invoiceNumber || 'OCZEKUJE',
                        type: isIncome ? 'INCOME' : 'EXPENSE',
                        amountNet,
                        amountGross,
                        taxRate: amountNet.isZero() ? new Decimal(0) : vatAmount.div(amountNet).toDecimalPlaces(4),
                        issueDate: new Date(item.issueDate || Date.now()),
                        dueDate: new Date(item.issueDate || Date.now()),
                        paymentStatus: 'UNPAID',
                        status: 'XML_MISSING', // Phase 1 status
                        ksefType: 'VAT'
                    }
                });

                // 4. Initial sync to Firestore
                await syncInvoiceToFirestore({
                    ...newInvoice,
                    amountNet: newInvoice.amountNet.toNumber(),
                    amountGross: newInvoice.amountGross.toNumber(),
                    taxRate: newInvoice.taxRate.toNumber()
                });

                // 5. VECTOR 098.2 / 099: Immediate Enrichment (Fetch XML & Finalize)
                try {
                    const detail = await ksefService.fetchAndParse(ksefId, { accessToken: sessionToken });
                    
                    // Atomic update to ACTIVE status and full data
                    await prisma.invoice.update({
                        where: { id: newInvoice.id },
                        data: {
                            status: 'ACTIVE',
                            invoiceNumber: detail.invoiceNumber,
                            issueDate: detail.issueDate,
                            dueDate: detail.dueDate,
                            amountNet: detail.netAmount,
                            amountGross: detail.grossAmount,
                            taxRate: detail.netAmount.isZero() ? new Decimal(0) : detail.vatAmount.div(detail.netAmount).toDecimalPlaces(4),
                        }
                    });

                    // Buffer Table Entry
                    await prisma.ksefInvoice.upsert({
                        where: { ksefNumber: ksefId },
                        create: {
                            tenantId,
                            ksefNumber: ksefId,
                            invoiceNumber: detail.invoiceNumber,
                            issueDate: detail.issueDate,
                            counterpartyNip: String(nip),
                            counterpartyName: String(name),
                            netAmount: detail.netAmount,
                            vatAmount: detail.vatAmount,
                            grossAmount: detail.grossAmount,
                            rawXml: detail.rawXml,
                            status: "IMPORTED"
                        },
                        update: {
                            status: "IMPORTED",
                            updatedAt: new Date()
                        }
                    });

                    // Smart Enrichment (Bank accounts etc)
                    if (!isIncome) {
                        const { compareAndNotify } = await import("@/lib/finance/contractorEnricher");
                        await compareAndNotify(detail, tenantId);
                    }

                } catch (enrichError) {
                    console.warn(`[IMPORT_ENRICH_WARN] Failed immediate enrichment for ${ksefId}:`, enrichError);
                    // We don't fail the whole import, it stays as XML_MISSING for background processing
                }

                stats.imported++;
                results.push({ ksefId, success: true });

            } catch (err: any) {
                console.error(`[IMPORT_ITEM_ERROR] ${item.ksefId}:`, err.message);
                stats.errors++;
            }
        }

        return NextResponse.json({
            success: true,
            stats,
            message: `Zaimportowano ${stats.imported} faktur. Pominięto: ${stats.skipped}. Błędy: ${stats.errors}.`
        });

    } catch (error: unknown) {
        const err = error as Error;
        console.error("[KSeF_API_IMPORT_ERROR]", err);
        return NextResponse.json(
            { success: false, error: err.message || "Wystąpił błąd podczas importu faktur." },
            { status: 500 }
        );
    }
}
