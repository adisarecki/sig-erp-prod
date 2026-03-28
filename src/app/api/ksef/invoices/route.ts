import { NextRequest, NextResponse } from 'next/server';
import { KSeFService } from '@/lib/ksef/ksefService';
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

        const tenantId = await getCurrentTenantId();
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
                  return [];
              }),
              
            // EXPENSE (Koszty) - Szeroki zakres dla testów (2026-01-01)
            ksefSvc.fetchInvoiceMetadata({ 
                sessionToken,
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
        
        // 4. Mappowanie wyników i ZAPIS DO PRISMA (Szybki Sync)
        let savedCount = 0;

        for (const item of combinedList) {
            const ksefReferenceNumber = item.invoiceReferenceNumber || item.ksefReferenceNumber;
            if (!ksefReferenceNumber) continue;

            // Extract Contractor data safely checking KSeF API variations:
            const sellerNip = item.subjectBy?.issuedByIdentifier?.identifier || item.sellerNip || "Nieznany";
            const sellerName = item.subjectBy?.issuedByName?.tradeName || item.sellerName || "Nieznany";
            const buyerNip = item.subjectTo?.issuedByIdentifier?.identifier || item.buyerNip || "Mój Tenant";
            const buyerName = item.subjectTo?.issuedByName?.tradeName || item.buyerName || "Mój Tenant";

            const isRevenue = item._apiDirection === "REVENUE";
            const counterpartyNip = isRevenue ? buyerNip : sellerNip;
            const counterpartyName = isRevenue ? buyerName : sellerName;

            // Find or Create PENDING Contractor (Płytki Profil z API)
            let contractor = await prisma.contractor.findUnique({
                where: { tenantId_nip: { tenantId, nip: counterpartyNip } }
            });

            if (!contractor) {
                contractor = await prisma.contractor.create({
                    data: {
                        tenantId,
                        nip: counterpartyNip,
                        name: counterpartyName,
                        status: "PENDING",
                        type: isRevenue ? "KLIENT" : "DOSTAWCA",
                    }
                });
            }

            // Mamy net/vat/gross z itemu (KSeF doc expects net/gross/vat directly)
            const netAmount = parseFloat(item.net || item.netAmount || "0");
            const grossAmount = parseFloat(item.gross || item.grossAmount || "0");
            let taxRateValue = 0;
            if (netAmount > 0) {
                taxRateValue = (grossAmount - netAmount) / netAmount;
            }

            const invoiceNumber = item.invoiceNumber || "Oczekuje na XML";
            const issueDate = item.invoicingDate ? new Date(item.invoicingDate).toISOString() : new Date().toISOString();

            // Szybki upsert do bazy danych ze statusem XML_MISSING
            await prisma.invoice.upsert({
                where: { ksefId: ksefReferenceNumber },
                create: {
                    tenantId,
                    contractorId: contractor.id,
                    ksefId: ksefReferenceNumber,
                    invoiceNumber: invoiceNumber,
                    type: isRevenue ? "REVENUE" : "EXPENSE",
                    amountNet: netAmount,
                    amountGross: grossAmount,
                    taxRate: Number.isNaN(taxRateValue) ? 0 : taxRateValue,
                    issueDate: new Date(issueDate),
                    dueDate: new Date(issueDate), // Domyślnie równa issueDate dopóki XML nie dociągnie `dueDate`
                    paymentStatus: "UNPAID",
                    status: "XML_MISSING" // UWAGA: Oznacza, że faktura czeka na pełne pobranie XML
                },
                update: {
                    // Celowo puste, Header ma być tylko wrzutką, chyba że status to nadal XML_MISSING (wtedy the XML fetch wasn't run)
                }
            });
            savedCount++;
        }

        return NextResponse.json({
            success: true,
            savedCount,
            pagination: {
                total: combinedList.length,
                page,
                pageSize,
                message: combinedList.length === 50 ? "Osiągnięto limit strony (50). Użyj filtrów daty, aby zobaczyć więcej." : `Pobrano ${combinedList.length} nagłówków. Zapisano ${savedCount} sztuk.`
            }
        });

    } catch (error: any) {
        console.error('[KSeF_API_INVOICES] Error:', error);
        
        return NextResponse.json({
            success: true,
            savedCount: 0,
            pagination: {
                total: 0,
                page: 1,
                pageSize: 50,
                message: "Brak faktur lub błąd bezpiecznego połączenia (Wektor: 404)."
            }
        }, { status: 200 });
    }
}
