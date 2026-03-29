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
                const ksefId = item.invoiceReferenceNumber;
                if (!ksefId) continue;

                // Determine Counterparty (Subject1 is always Seller, Subject2 is always Buyer)
                // If it's REVENUE (User is Seller/Subject1), counterparty is Subject2 (Buyer)
                // If it's EXPENSE (User is Buyer/Subject2), counterparty is Subject1 (Seller)
                const isRevenue = item._apiDirection === "REVENUE";
                const counterparty = isRevenue ? item.subject2 : item.subject1;
                
                const nip = counterparty?.issuedByIdentifier?.value || '0000000000';
                const name = counterparty?.issuedByName || 'Nieznany Kontrahent';

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
                    // Update name only if empty
                    contractor = await prisma.contractor.update({
                        where: { id: contractor.id },
                        data: { name }
                    });
                }

                // 4b. Invoice Upsert (ksefId as key)
                const amountGross = new Decimal(item.grossAmount || 0);
                const amountNet = new Decimal(item.netAmount || 0);
                const vatAmount = new Decimal(item.vatAmount || 0);

                await prisma.invoice.upsert({
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

                savedCount++;
                results.push({
                    ksefId,
                    invoiceNumber: item.invoiceNumber,
                    seller: name,
                    amount: amountGross.toString(),
                    status: "XML_MISSING"
                });
            } catch (err: unknown) {
                console.error(`[KSeF_API_INVOICES] Item error for ${item.invoiceReferenceNumber}:`, err);
            }
        }

        return NextResponse.json({
            success: true,
            savedCount,
            pagination: {
                total: combinedList.length,
                page,
                pageSize,
                message: combinedList.length === 50 ? "Osiągnięto limit strony (50). Użyj filtrów daty, aby zobaczyć więcej." : `Pobrano ${combinedList.length} nagłówków. Zapisano ${savedCount} sztuk w systemie Prisma (XML_MISSING).`
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
