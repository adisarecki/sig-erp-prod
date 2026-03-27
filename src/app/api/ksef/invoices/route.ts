import { NextRequest, NextResponse } from 'next/server';
import { KSeFService } from '@/lib/ksef/ksefService';

const OWNER_NIP = '9542751368';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const dateFrom = searchParams.get('dateFrom') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const dateTo = searchParams.get('dateTo') || new Date().toISOString();
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = parseInt(searchParams.get('pageSize') || '20');

        const ksefSvc = new KSeFService();
        
        // 1. Query Invoices
        const invoiceList = await ksefSvc.queryLatestInvoices();
        
        // 2. Map Results to include requested fields
        const mappedInvoices = invoiceList.map((item: any) => ({
            ksefReferenceNumber: item.invoiceReferenceNumber,
            invoiceNumber: item.invoiceNumber,
            issueDate: item.invoicingDate,
            sellerNIP: item.sellerNip,
            sellerName: item.sellerName,
            buyerNIP: item.buyerNip,
            buyerName: item.buyerName,
            netAmount: item.netAmount,
            vatAmount: item.vatAmount,
            grossAmount: item.grossAmount,
            status: "RECEIVED" // Standard for Subject2 query
        }));

        // 3. Simple Pagination
        const totalCount = mappedInvoices.length;
        const pagedInvoices = mappedInvoices.slice((page - 1) * pageSize, page * pageSize);

        return NextResponse.json({
            invoices: pagedInvoices,
            pagination: {
                total: totalCount,
                page,
                pageSize,
                totalPages: Math.ceil(totalCount / pageSize)
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
