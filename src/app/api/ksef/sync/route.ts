import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTenantId } from '@/lib/tenant';
import prisma from '@/lib/prisma';
import { KSeFService, KSeFInvoiceHeader } from '@/lib/ksef/ksefService';

/**
 * GET /api/ksef/sync
 * VECTOR 103: Shallow Sync (Strefa Buforowa)
 * Fetches invoice metadata from KSeF without creating final records.
 * Supports 'from' and 'to' query parameters.
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

        console.log(`[KSeF_SHALLOW_SYNC] Fetching metadata from ${from || 'default'} to ${to || 'now'}`);

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

        // 1. Get all KSeF IDs already finalized in the Invoice table
        const finalizedInvoices = await prisma.invoice.findMany({
            where: { tenantId, ksefId: { not: null } },
            select: { ksefId: true }
        });
        const finalizedIds = new Set(finalizedInvoices.map(i => i.ksefId));

        // 2. Get all KSeF IDs in the buffer table (to detect REJECTED status)
        const bufferedInvoices = await prisma.ksefInvoice.findMany({
            where: { tenantId },
            select: { ksefNumber: true, status: true }
        });
        const rejectedIds = new Set(bufferedInvoices.filter(i => i.status === 'REJECTED').map(i => i.ksefNumber));
        const importedIds = new Set(bufferedInvoices.filter(i => i.status === 'IMPORTED').map(i => i.ksefNumber));

        // 3. Filter and Enrich results for Frontend Display
        const filteredInvoices = invoiceList.filter(item => {
            const ksefId = (item as any).ksefNumber || item.invoiceReferenceNumber;
            // Ignore if already imported (in Invoice or KsefInvoice marked IMPORTED) or explicitly rejected
            return !finalizedIds.has(ksefId) && !rejectedIds.has(ksefId) && !importedIds.has(ksefId);
        }).map(item => {
            const direction = (item as any)._apiDirection || "EXPENSE";
            const isIncome = direction === "INCOME";
            let nip = '0000000000';
            let name = 'Nieznany Kontrahent';

            if (isIncome) {
                const buyer = (item as any).buyer || item.subject2;
                nip = String((buyer as any)?.identifier?.value || '0000000000');
                name = String(buyer?.name || 'Nieznany Kontrahent');
            } else {
                const seller = (item as any).seller || item.subject1;
                nip = String((seller as any)?.nip || '0000000000');
                name = String(seller?.name || 'Nieznany Kontrahent');
            }

            return {
                ...item,
                ksefId: (item as any).ksefNumber || item.invoiceReferenceNumber,
                direction,
                nip,
                name,
                issueDate: item.issueDate,
                amountNet: item.netAmount || 0,
                amountGross: item.grossAmount || 0,
            };
        });

        console.log(`[KSeF_SHALLOW_SYNC] Found ${invoiceList.length} total, returning ${filteredInvoices.length} filtered.`);

        return NextResponse.json({
            success: true,
            count: filteredInvoices.length,
            invoices: filteredInvoices,
            message: `Pobrano listę faktur z KSeF (${filteredInvoices.length} nowych).`
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
