import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTenantId } from '@/lib/tenant';
import prisma from '@/lib/prisma';
import { KSeFService, KSeFInvoiceHeader } from '@/lib/ksef/ksefService';

/**
 * GET /api/ksef/sync
 * VECTOR 103: KSeF Gatekeeper (Strefa Buforowa)
 * Fetches metadata from KSeF and populates the KsefInvoice (Inbox) buffer table.
 * Does NOT create final 'Invoice' or 'Transaction' records.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const from = searchParams.get('from') || undefined;
        const to = searchParams.get('to') || undefined;

        const ksefService = new KSeFService();
        const tenantId = await getCurrentTenantId();
        
        let sessionToken: string;
        try {
            sessionToken = await ksefService.getSessionToken();
        } catch (err: any) {
            console.error("[KSeF_SYNC_AUTH_ERROR]", err.message);
            return NextResponse.json({ success: false, error: `Błąd autoryzacji: ${err.message}` }, { status: 401 });
        }

        console.log(`[KSeF_GATEKEEPER] Shallow sync from ${from || 'default'} to ${to || 'now'} for tenant ${tenantId}`);

        // 1. Fetch metadata headers from KSeF
        const invoiceList: KSeFInvoiceHeader[] = await ksefService.fetchInvoiceMetadata({ 
            accessToken: sessionToken,
            dateType: 'PermanentStorage',
            dateFrom: from,
            dateTo: to
        });
        
        if (!invoiceList || invoiceList.length === 0) {
            return NextResponse.json({ 
                success: true, 
                count: 0, 
                invoices: [],
                message: "Brak nowych faktur w wybranym zakresie." 
            });
        }

        // 2. Absolute Duplicate Shield (Vector 098.1)
        // Get all KSeF IDs already finalized in the main Invoice table
        const finalizedInvoices = await prisma.invoice.findMany({
            where: { tenantId, ksefId: { not: null } },
            select: { ksefId: true }
        });
        const finalizedIds = new Set(finalizedInvoices.map(i => i.ksefId));

        // Get those already in the buffer
        const existingBuffer = await prisma.ksefInvoice.findMany({
            where: { tenantId },
            select: { ksefNumber: true }
        });
        const bufferedIds = new Set(existingBuffer.map(i => i.ksefNumber));
        
        // --- SECOND LINE OF DEFENSE (Vector 098.3) ---
        // Get all invoice numbers from current list to check for business duplicates (Number + Contractor NIP)
        const allInvoiceNumbers = invoiceList.map(i => i.invoiceNumber).filter(Boolean) as string[];
        const potentialDuplicates = await prisma.invoice.findMany({
            where: {
                tenantId,
                invoiceNumber: { in: allInvoiceNumbers }
            },
            select: {
                invoiceNumber: true,
                contractor: { select: { nip: true } }
            }
        });
        
        const businessDuplicates = new Set(
            potentialDuplicates
                .filter(inv => inv.contractor?.nip && inv.invoiceNumber)
                .map(inv => `${inv.contractor.nip}_${inv.invoiceNumber}`)
        );

        // 3. Filter only NEW invoices (not in Invoice table AND not in Buffer AND no business dupe)
        const newInvoices = invoiceList.filter(item => {
            const ksefId = (item as any).ksefNumber || item.invoiceReferenceNumber;
            const invoiceNumber = item.invoiceNumber;
            const sellerNip = (item as any).sellerNip || (item as any).issuerReferenceNumber; // Context dependent

            // First Line: KSeF ID
            if (finalizedIds.has(ksefId) || bufferedIds.has(ksefId)) return false;

            // Second Line: Business Logic (Number + NIP)
            // Note: If sync metadata doesn't have NIP, we'll catch it in the Import Phase 2.
            if (invoiceNumber && (item as any).sellerNip) {
                const key = `${(item as any).sellerNip}_${invoiceNumber}`;
                if (businessDuplicates.has(key)) {
                    console.warn(`[KSeF_SHIELD] Business Duplicate Blocked: ${key}`);
                    return false;
                }
            }

            return true;
        });

        console.log(`[KSeF_GATEKEEPER] Found ${invoiceList.length} total, ${newInvoices.length} are new for Inbox.`);

        // 4. Batch Process NEW Invoices: Fetch Detail XML & Upsert into Buffer
        const processedCount = 0;
        const results = [];

        // For small batches (typical sync), we can fetch XML now. For huge batches, we might want to delegate this.
        // Given the "Wizjoner" requirement, we'll try to populate the buffer now.
        for (const meta of newInvoices) {
            const ksefId = (meta as any).ksefNumber || meta.invoiceReferenceNumber;
            
            try {
                // Fetch full detail for the buffer (includes XML)
                const detail = await ksefService.fetchAndParse(ksefId, { accessToken: sessionToken });
                
                const bufferRecord = await prisma.ksefInvoice.create({
                    data: {
                        tenantId,
                        ksefNumber: ksefId,
                        invoiceNumber: detail.invoiceNumber,
                        issueDate: detail.issueDate,
                        counterpartyNip: detail.sellerNip, // For purchase invoices, issuer is seller
                        counterpartyName: detail.sellerName,
                        netAmount: detail.netAmount,
                        vatAmount: detail.vatAmount,
                        grossAmount: detail.grossAmount,
                        rawXml: detail.rawXml,
                        status: 'PENDING'
                    }
                });
                
                results.push(bufferRecord);
            } catch (err: any) {
                console.warn(`[KSeF_GATEKEEPER] Failed to fetch/buffer ${ksefId}:`, err.message);
            }
        }

        // Return current PENDING items in the Inbox
        const currentInbox = await prisma.ksefInvoice.findMany({
            where: { tenantId, status: 'PENDING' },
            orderBy: { issueDate: 'desc' }
        });

        return NextResponse.json({
            success: true,
            totalFound: invoiceList.length,
            newBuffered: results.length,
            inboxCount: currentInbox.length,
            invoices: currentInbox,
            message: `Zaktualizowano Inbox KSeF. Nowe: ${results.length}, Razem oczekujących: ${currentInbox.length}.`
        });

    } catch (error: unknown) {
        const err = error as Error;
        console.error("[KSeF_API_SYNC_ERROR]", err);
        return NextResponse.json(
            { success: false, error: err.message || "Wystąpił błąd podczas synchronizacji z Inboxem KSeF." },
            { status: 500 }
        );
    }
}
