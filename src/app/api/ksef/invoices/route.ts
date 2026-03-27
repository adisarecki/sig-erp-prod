import { NextRequest, NextResponse } from 'next/server';
import { KSeFService } from '@/lib/ksef/ksefService';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        
        // 1. Extract Filters
        const dateFrom = searchParams.get('dateFrom') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const dateTo = searchParams.get('dateTo') || new Date().toISOString();
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50'), 50); // KSeF limit is 50

        const ksefSvc = new KSeFService();
        
        // 2. Session Handshake (v2.0)
        const sessionToken = await ksefSvc.getSessionToken();

        // 3. Query Invoices with filters
        const invoiceList = await ksefSvc.fetchInvoiceMetadata({ 
            sessionToken,
            dateFrom,
            dateTo,
            pageSize
        });
        
        // 4. Map Results
        const mappedInvoices = invoiceList.map((item: any) => ({
            ksefReferenceNumber: item.invoiceReferenceNumber,
            invoiceNumber: item.invoiceNumber || "N/A",
            issueDate: item.invoicingDate,
            sellerNIP: item.sellerNip || "Nieznany",
            sellerName: item.sellerName || "Nieznany",
            buyerNIP: item.buyerNip || "Mój Tenant",
            buyerName: item.buyerName || "Mój Tenant",
            netAmount: item.netAmount || 0,
            vatAmount: item.vatAmount || 0,
            grossAmount: item.grossAmount || 0,
            status: "RECEIVED"
        }));

        return NextResponse.json({
            success: true,
            invoices: mappedInvoices,
            pagination: {
                total: mappedInvoices.length,
                page,
                pageSize,
                message: mappedInvoices.length === 50 ? "Osiągnięto limit strony (50). Użyj filtrów daty, aby zobaczyć więcej." : "Pobrano wszystkie pasujące rekordy."
            }
        });


    } catch (error: any) {
        console.error('[KSeF_API_INVOICES] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Błąd podczas pobierania faktur z KSeF' },
            { status: 500 }
        );
    }
}
