import { NextRequest, NextResponse } from 'next/server';
import { KSeFService } from '@/lib/ksef/ksefService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Długie zapytania KSeF (v2.0 Timeout Guard)

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

        // 3. Double-Fetch: Query Sales (subject1) & Expenses (subject2) concurrently
        const [salesResponse, expensesResponse] = await Promise.all([
            // REVENUE (Sprzedaż)
            ksefSvc.fetchInvoiceMetadata({ 
                sessionToken,
                dateFrom,
                dateTo,
                pageSize,
                subjectType: 'subject1'
            }).then(res => res.map((item: any) => ({ ...item, _apiDirection: 'REVENUE' })))
              .catch(err => {
                  console.error('[KSeF_API_INVOICES] Sales fetch error:', err);
                  return []; // Fallback empty array on specific failure
              }),
              
            // EXPENSE (Koszty) - TEST 1 Bypass: Wide date range (from 2026-01-01)
            ksefSvc.fetchInvoiceMetadata({ 
                sessionToken,
                dateFrom: "2026-01-01T00:00:00.000Z", // Wide range bypass (Requested by Wizjoner)
                dateTo,
                pageSize,
                subjectType: 'subject2'
            }).then(res => res.map((item: any) => ({ ...item, _apiDirection: 'EXPENSE' })))
              .catch(err => {
                  console.error('[KSeF_API_INVOICES] Expenses fetch error:', err);
                  return []; // Fallback empty array on specific failure
              })
        ]);
        
        const combinedList = [...salesResponse, ...expensesResponse];
        
        // 4. Map Results
        const mappedInvoices = combinedList.map((item: any) => ({
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
            direction: item._apiDirection, // Added for UI badge
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
        
        // Zadanie: Zwróć 200 z pustą tablicą zamiast błędu 500 (Fail-Safe), 
        // aby uniknąć crashu frontendu w okresach bezfakturowych.
        return NextResponse.json({
            success: true,
            invoices: [],
            pagination: {
                total: 0,
                page: 1,
                pageSize: 50,
                message: "Brak faktur lub błąd bezpiecznego połączenia (Wektor: 404)."
            }
        }, { status: 200 });
    }
}
