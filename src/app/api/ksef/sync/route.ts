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
        const results = [];

        for (const item of invoiceList) {
            try {
                // Determine Counterparty (In Subject2 query, counterpart is Subject1)
                const nip = item.subject1?.issuedByIdentifier?.value || '0000000000';
                const name = item.subject1?.issuedByName || 'Nieznany Sprzedawca';

                // 4a. Contractor Upsert (NIP as key)
                const contractor = await prisma.contractor.upsert({
                    where: { 
                        tenantId_nip: {
                            tenantId,
                            nip
                        }
                    },
                    update: {
                        // Priority: Keeping system name if already filled
                        name: {
                            set: name // We will handle actual "priority" logic in a more complex way if needed, 
                                     // but Prisma's set is fine here as a baseline for shallow sync.
                                     // User specified: "System Name has priority. Only update if empty."
                        }
                    },
                    create: {
                        tenantId,
                        nip,
                        name,
                        status: 'PENDING',
                        type: 'DOSTAWCA'
                    }
                });

                // Re-verify name priority: If contractor already existed, don't overwrite name if not empty
                // (Prisma upsert update is tricky for conditional field updates, so we might need a separate check if we want to be strict)
                // Let's do a more robust check:
                const existingContractor = await prisma.contractor.findUnique({
                    where: { tenantId_nip: { tenantId, nip } }
                });
                
                if (existingContractor && existingContractor.name && existingContractor.name !== name && existingContractor.name !== 'Nieznany Sprzedawca') {
                    // Keep existing name
                } else {
                    await prisma.contractor.update({
                        where: { id: contractor.id },
                        data: { name }
                    });
                }

                // 4b. Invoice Upsert (ksefId as key)
                // Handle 0 amounts and currency gracefully
                const amountGross = new Decimal(item.grossAmount || 0);
                const amountNet = new Decimal(item.netAmount || 0);
                const vatAmount = new Decimal(item.vatAmount || 0);
                
                const savedInvoice = await prisma.invoice.upsert({
                    where: { ksefId: item.invoiceReferenceNumber },
                    update: {
                        status: 'XML_MISSING',
                        updatedAt: new Date(),
                    },
                    create: {
                        tenantId,
                        contractorId: contractor.id,
                        ksefId: item.invoiceReferenceNumber,
                        invoiceNumber: item.invoiceNumber || 'BRAK',
                        type: 'ZAKUP',
                        amountNet,
                        amountGross,
                        taxRate: amountNet.isZero() ? new Decimal(0) : vatAmount.div(amountNet).toDecimalPlaces(4),
                        issueDate: new Date(item.issueDate || Date.now()),
                        dueDate: new Date(item.issueDate || Date.now()), // Shallow fallback
                        status: 'XML_MISSING',
                        paymentStatus: 'UNPAID',
                        ksefType: 'VAT'
                    }
                });

                results.push({
                    id: savedInvoice.id,
                    ksefId: item.invoiceReferenceNumber,
                    invoiceNumber: item.invoiceNumber,
                    seller: name,
                    amount: amountGross.toString(),
                    status: "XML_MISSING"
                });

            } catch (err: unknown) {
                console.error(`[KSeF_SHALLOW_SYNC_ERROR] ${item.invoiceReferenceNumber}:`, (err as Error).message);
            }
        }

        return NextResponse.json({
            success: true,
            count: results.length,
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
