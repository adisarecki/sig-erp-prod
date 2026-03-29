import { NextRequest, NextResponse } from 'next/server';
import { KSeFService } from '@/lib/ksef/ksefService';
import { KsefSessionManager } from '@/lib/ksef/ksefSessionManager';
import Decimal from 'decimal.js';
import prisma from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";

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
        
        console.log('[KSEF_API_INVOICES] INPUT options:', {
            dateFrom,
            dateTo,
            pageSize,
            page
        });

        const tenantId = await getCurrentTenantId();
        const ksefSvc = new KSeFService();
        const sessionMgr = new KsefSessionManager();
        
        // 2. Automated Session Management (JWT Manager / Check & Refresh)
        const accessToken = await sessionMgr.ensureAccessToken(tenantId);

        // 3. Double-Fetch: Query Sales (subject1) & Expenses (subject2) concurrently
        const [salesResponse, expensesResponse] = await Promise.all([
            // REVENUE (Sprzedaż)
            ksefSvc.fetchInvoiceMetadata({ 
                accessToken,
                dateFrom,
                dateTo,
                pageSize,
                subjectType: 'subject1'
            }).then(res => res.map((item: any) => ({ ...item, _apiDirection: 'REVENUE' })))
              .catch(err => {
                  console.error('[KSeF_API_INVOICES] Sales fetch error:', err);
                  return [];
              }),
              
            // EXPENSE (Koszty) - Szeroki zakres dla testów (2026-01-01)
            ksefSvc.fetchInvoiceMetadata({ 
                accessToken,
                dateFrom: "2026-01-01T00:00:00.000Z", // Wide range bypass (Zgodnie z poleceniem Wizjonera)
                dateTo,
                pageSize,
                subjectType: 'subject2'
            }).then(res => res.map((item: any) => ({ ...item, _apiDirection: 'EXPENSE' })))
              .catch(err => {
                  console.error('[KSeF_API_INVOICES] Expenses fetch error:', err);
                  return [];
              })
        ]);
        
        const combinedList = [...salesResponse, ...expensesResponse];
        
        // 4. Mappowanie wyników i ZAPIS DO PRISMA (Szybki Sync) - Płytki Sync
        let savedCount = 0;
        const results = [];

        for (const item of combinedList) {
            try {
                // Official KSeF v2.0 unique identifier
                const ksefId = item.ksefNumber || item.invoiceReferenceNumber;
                if (!ksefId) continue;

                const isRevenue = item._apiDirection === "REVENUE";
                
                // Zadanie 2: Weryfikacja klucza NIP (Krytyczne!)
                // Seller NIP: item.seller.nip
                // Buyer NIP: item.buyer.identifier.value
                let nip = '0000000000';
                let name = 'Nieznany Kontrahent';

                if (isRevenue) {
                    // Dla sprzedaży (Revenue/Subject1) kontrahentem jest Nabywca (Buyer)
                    const buyer = item.buyer || item.subject2;
                    nip = (buyer as any)?.identifier?.value || (buyer as any)?.issuedByIdentifier?.value || '0000000000';
                    name = buyer?.name || (buyer as any)?.issuedByName || 'Nieznany Kontrahent';
                } else {
                    // Dla kosztów (Expense/Subject2) kontrahentem jest Sprzedawca (Seller)
                    const seller = item.seller || item.subject1;
                    nip = (seller as any)?.nip || (seller as any)?.issuedByIdentifier?.value || '0000000000';
                    name = seller?.name || (seller as any)?.issuedByName || 'Nieznany Kontrahent';
                }

                console.log(`[SYNC_PROCESS] Processing invoice: ${item.invoiceNumber} from ${name} (NIP: ${nip})`);

                // 4a. Contractor Upsert (NIP as key)
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
                    // Name priority protection rule: update only if currently empty
                    contractor = await prisma.contractor.update({
                        where: { id: contractor.id },
                        data: { name }
                    });
                }

                // 4b. Invoice Upsert (ksefId as key)
                const amountGross = new Decimal(item.grossGrossAmount || item.grossAmount || 0);
                const amountNet = new Decimal(item.netAmount || 0);
                const vatAmount = new Decimal(item.vatAmount || 0);

                // Zadanie 3: Sprawdzenie await Promise.all (Await Safety)
                const result = await prisma.invoice.upsert({
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
                        // Keep header current if it's still missing XML
                        status: 'XML_MISSING',
                        updatedAt: new Date()
                    }
                });

                console.log(`[PRISMA_SUCCESS] Invoice ${item.invoiceNumber} saved with ID: ${result.id}`);
                savedCount++;
                results.push({
                    ksefId,
                    invoiceNumber: item.invoiceNumber,
                    seller: name,
                    amount: amountGross.toString()
                });
            } catch (dbError: any) {
                console.error(`[PRISMA_FATAL] Error saving invoice ${item.invoiceNumber}:`, dbError);
            }
        }

        return NextResponse.json({
            success: true,
            savedCount,
            results,
            pagination: {
                total: combinedList.length,
                page,
                pageSize,
                message: combinedList.length === 50 ? "Osiągnięto limit strony (50). Użyj filtrów daty, aby zobaczyć więcej." : `Pobrano ${combinedList.length} nagłówków. Zapisano ${savedCount} sztuk w systemie Prisma (Płytki Sync).`
            }
        });

    } catch (error: any) {
        console.error('[KSeF_API_INVOICES] Global Error:', error);
        
        return NextResponse.json({
            success: false,
            error: error.message || "Błąd wewnętrzny serwera podczas synchronizacji.",
            savedCount: 0,
            pagination: {
                total: 0,
                page: 1,
                pageSize: 50,
                message: "Błąd połączenia z KSeF lub bazą danych."
            }
        }, { status: 500 });
    }
}
