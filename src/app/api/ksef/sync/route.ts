import { NextResponse } from 'next/server';
import { getCurrentTenantId } from '@/lib/tenant';
import prisma from '@/lib/prisma';
import { KSeFService, KSeFInvoiceHeader } from '@/lib/ksef/ksefService';
import Decimal from 'decimal.js';
import { getAdminDb } from '@/lib/firebaseAdmin';

/**
 * GET /api/ksef/sync
 * Manually trigger KSeF invoice synchronization.
 * Fetched invoices are upserted into Prisma and Firestore (Dual-Sync).
 */
export async function GET() {
    try {
        // 1. Initialize Service & Tenant
        const ksefService = new KSeFService();
        const tenantId = await getCurrentTenantId();

        // 2. Get sessionToken (v2.0 handshake with dynamic key)
        let sessionToken: string;
        try {
            sessionToken = await ksefService.getSessionToken();
        } catch (err: unknown) {
            const error = err as Error;
            console.error("[KSeF_SYNC_AUTH_ERROR]", error.message);
            return NextResponse.json(
                { success: false, error: `Błąd autoryzacji KSeF (v2.0): ${error.message}` },
                { status: 401 }
            );
        }

        // 3. Use sessionToken for further requests (fetch invoices with PermanentStorage for incremental sync)
        const invoiceList: KSeFInvoiceHeader[] = await ksefService.fetchInvoiceMetadata({ 
            accessToken: sessionToken,
            dateType: 'PermanentStorage'
        });
        
        if (!invoiceList || invoiceList.length === 0) {
            console.log("[KSeF_SYNC] No new invoices found in the current period.");
            return NextResponse.json({
                success: true,
                count: 0,
                invoices: [],
                message: "Brak nowych faktur w KSeF w wybranym okresie."
            });
        }

        // 4. Shallow Sync Loop (Metadata-only) - Prisma only
        let savedCount = 0;
        const results = [];

        for (const item of invoiceList) {
            try {
                // Official KSeF v2.0 unique identifier
                const ksefId = (item as any).ksefNumber || item.invoiceReferenceNumber;
                if (!ksefId) continue;

                // For the sync route, we assume these are mostly incoming expenses (zakupy) 
                // in general sync mode, but we check direction if available.
                const isRevenue = (item as any)._apiDirection === "REVENUE";
                
                // Determine Counterparty based on Direct Seller/Buyer mapping (Log format)
                let nip = '0000000000';
                let name = 'Nieznany Kontrahent';

                if (isRevenue) {
                    const buyer = (item as any).buyer || item.subject2;
                    nip = (buyer as any)?.identifier?.value || (buyer as any)?.issuedByIdentifier?.value || '0000000000';
                    name = buyer?.name || (buyer as any)?.issuedByName || 'Nieznany Kontrahent';
                } else {
                    const seller = (item as any).seller || item.subject1;
                    nip = (seller as any)?.nip || (seller as any)?.issuedByIdentifier?.value || '0000000000';
                    name = seller?.name || (seller as any)?.issuedByName || 'Nieznany Kontrahent';
                }

                // 4a. Contractor Upsert
                let contractor = await prisma.contractor.findUnique({
                    where: { tenantId_nip: { tenantId, nip } }
                });

                if (!contractor) {
                    contractor = await prisma.contractor.create({
                        data: {
                            tenantId,
                            nip,
                            name,
                            status: 'PENDING',
                            type: isRevenue ? 'KLIENT' : 'DOSTAWCA'
                        }
                    });
                } else if (!contractor.name || contractor.name === 'Nieznany Kontrahent' || contractor.name === '') {
                    contractor = await prisma.contractor.update({
                        where: { id: contractor.id },
                        data: { name }
                    });
                }

                // 4b. Invoice Upsert
                const amountGross = new Decimal(item.grossAmount || 0);
                const amountNet = new Decimal(item.netAmount || 0);
                const vatAmount = new Decimal(item.vatAmount || 0);

                const savedInvoice = await prisma.invoice.upsert({
                    where: { ksefId },
                    create: {
                        tenantId,
                        contractorId: contractor.id,
                        ksefId,
                        invoiceNumber: item.invoiceNumber || 'OCZEKUJE',
                        type: isRevenue ? 'REVENUE' : 'EXPENSE',
                        amountNet,
                        amountGross,
                        taxRate: amountNet.isZero() ? new Decimal(0) : vatAmount.div(amountNet).toDecimalPlaces(4),
                        issueDate: new Date(item.issueDate || Date.now()),
                        dueDate: new Date(item.issueDate || Date.now()),
                        paymentStatus: 'UNPAID',
                        status: 'XML_MISSING',
                        ksefType: 'VAT'
                    },
                    update: {
                        status: 'XML_MISSING',
                        updatedAt: new Date()
                    }
                });

                results.push({
                    id: savedInvoice.id,
                    ksefId: ksefId,
                    invoiceNumber: item.invoiceNumber,
                    seller: name,
                    amount: amountGross.toString(),
                    status: "XML_MISSING"
                });

                savedCount++;
            } catch (err: unknown) {
                console.error(`[KSeF_SHALLOW_SYNC_ERROR] ${item.invoiceReferenceNumber}:`, (err as Error).message);
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
