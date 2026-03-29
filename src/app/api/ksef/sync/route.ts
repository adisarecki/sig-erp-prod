import { NextResponse } from 'next/server';
import { getCurrentTenantId } from '@/lib/tenant';
import prisma from '@/lib/prisma';
import { KSeFService, KSeFInvoiceHeader } from '@/lib/ksef/ksefService';
import Decimal from 'decimal.js';
import { syncContractorToFirestore, syncInvoiceToFirestore } from '@/lib/finance/sync-utils';

/**
 * GET /api/ksef/sync
 * Manually trigger KSeF invoice synchronization.
 * Fetched invoices are upserted into Prisma and Firestore (Dual-Sync).
 */
export async function GET() {
    try {
        const ksefService = new KSeFService();
        const tenantId = await getCurrentTenantId();
        
        let sessionToken: string;
        try {
            sessionToken = await ksefService.getSessionToken();
        } catch (err: any) {
            console.error("[KSeF_SYNC_AUTH_ERROR]", err.message);
            return NextResponse.json({ success: false, error: `Błąd autoryzacji: ${err.message}` }, { status: 401 });
        }

        const invoiceList: KSeFInvoiceHeader[] = await ksefService.fetchInvoiceMetadata({ 
            accessToken: sessionToken,
            dateType: 'PermanentStorage'
        });
        
        if (!invoiceList || invoiceList.length === 0) {
            return NextResponse.json({ success: true, count: 0, message: "Brak nowych faktur." });
        }

        let savedCount = 0;
        const results = [];

        for (const item of invoiceList) {
            try {
                const ksefId = (item as any).ksefNumber || item.invoiceReferenceNumber;
                if (!ksefId) continue;

                const direction = (item as any)._apiDirection || "EXPENSE"; // Default to EXPENSE if unknown
                const isIncome = direction === "INCOME";
                let nip = '0000000000';
                let name = 'Nieznany Kontrahent';

                if (isIncome) {
                    const buyer = (item as any).buyer || item.subject2;
                    nip = (buyer as any)?.identifier?.value || '0000000000';
                    name = buyer?.name || 'Nieznany Kontrahent';
                } else {
                    const seller = (item as any).seller || item.subject1;
                    nip = (seller as any)?.nip || '0000000000';
                    name = seller?.name || 'Nieznany Kontrahent';
                }

                // 4a. Contractor Sync
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

                // 4b. Invoice Header Sync
                const amountGross = new Decimal(item.grossAmount || 0);
                const amountNet = new Decimal(item.netAmount || 0);
                const vatAmount = new Decimal(item.vatAmount || 0);

                const result = await prisma.invoice.upsert({
                    where: { ksefId },
                    create: {
                        tenantId, contractorId: contractor.id, ksefId,
                        invoiceNumber: item.invoiceNumber || 'OCZEKUJE',
                        type: isIncome ? 'INCOME' : 'EXPENSE',
                        amountNet, amountGross,
                        taxRate: amountNet.isZero() ? new Decimal(0) : vatAmount.div(amountNet).toDecimalPlaces(4),
                        issueDate: new Date(item.issueDate || Date.now()),
                        dueDate: new Date(item.issueDate || Date.now()),
                        paymentStatus: 'UNPAID', status: 'XML_MISSING', ksefType: 'VAT'
                    },
                    update: { status: 'XML_MISSING', updatedAt: new Date() }
                });

                await syncInvoiceToFirestore({
                    ...result,
                    type: result.type,
                    amountNet: result.amountNet.toNumber(),
                    amountGross: result.amountGross.toNumber(),
                    taxRate: result.taxRate.toNumber()
                });

                savedCount++;
                results.push({ id: result.id, ksefId, invoiceNumber: item.invoiceNumber, amount: amountGross.toString() });
            } catch (dbError: any) {
                console.error(`[SYNC_ERROR] ${item.invoiceNumber}:`, dbError);
            }
        }

        return NextResponse.json({
            success: true,
            savedCount,
            invoices: results,
            message: `Płytka synchronizacja zakończona. Zapamiętano ${results.length} nagłówków faktur (XML_MISSING).`
        });

    } catch (error: unknown) {
        const err = error as Error;
        console.error("[KSeF_API_SYNC_ERROR]", err);
        return NextResponse.json(
            { success: false, error: err.message || "Wystąpił błąd podczas synchronizacji z KSeF." },
            { status: 500 }
        );
    }
}
