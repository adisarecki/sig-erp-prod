import { NextRequest, NextResponse } from 'next/server';
import { KSeFClient } from '@/lib/ksef/ksef-client';
import { KSeFMapper } from '@/lib/ksef/ksef-mapper';

const OWNER_NIP = '9542751368';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const dateFrom = searchParams.get('dateFrom') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const dateTo = searchParams.get('dateTo') || new Date().toISOString();
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = parseInt(searchParams.get('pageSize') || '20');

        const client = new KSeFClient();
        const mapper = new KSeFMapper();

        // 1. Authenticate
        const sessionId = await client.authenticate(OWNER_NIP);

        // 2. Query Invoices
        const result = await client.queryInvoices(sessionId, { dateFrom, dateTo });
        
        // 3. Map Results
        const invoiceList = result.invoiceList || [];
        const mappedInvoices = invoiceList.map((item: any) => mapper.mapSearchResult(item));

        // 4. Basic Client-side Pagination for the API response
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
