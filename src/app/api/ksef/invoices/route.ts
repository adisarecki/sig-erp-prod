import { NextRequest, NextResponse } from 'next/server';
import { KSeFService } from '@/lib/ksef/ksefService';
import { KsefSessionManager } from '@/lib/ksef/ksefSessionManager';
import { validateRange } from '@/lib/ksef/ksefDateUtils';
import Decimal from 'decimal.js';
import prisma from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { syncContractorToFirestore, syncInvoiceToFirestore } from "@/lib/finance/sync-utils";

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Długie zapytania KSeF (v2.0 Timeout Guard)

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        
        // ... (existing filters)
        const dateFrom = searchParams.get('dateFrom') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const dateTo = searchParams.get('dateTo') || new Date().toISOString();

        // VECTOR 111.1: Authoritative Date Validation & Structured Logging
        const range = validateRange(dateFrom, dateTo);
        
        console.log(`[KSeF_API_LOG]
  raw_input_range: ${dateFrom} - ${dateTo}
  normalized_warsaw_range: ${range.fromNormalized} - ${range.toNormalized}
  subject_type: Subject1 & Subject2
  calculation_result: ${range.days} days / ${range.isValid ? 'ACCEPTED' : 'REJECTED'}`);
        
        if (!range.isValid) {
            return NextResponse.json({
                success: false,
                error: "⚠️ KSeF Limit: Zakres dat nie może przekraczać 90 dni. Skróć okres wyszukiwania."
            }, { status: 400 });
        }

        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50'), 50);

        const tenantId = await getCurrentTenantId();
        const ksefSvc = new KSeFService();
        const sessionMgr = new KsefSessionManager();
        
        const accessToken = await sessionMgr.ensureAccessToken(tenantId);

        const [salesResponse, expensesResponse] = await Promise.all([
            ksefSvc.fetchInvoiceMetadata({ accessToken, dateFrom, dateTo, pageSize, subjectType: 'subject1' }).then(res => res.map((item: any) => ({ ...item, _apiDirection: 'REVENUE' }))).catch(() => []),
            ksefSvc.fetchInvoiceMetadata({ accessToken, dateFrom, dateTo, pageSize, subjectType: 'subject2' }).then(res => res.map((item: any) => ({ ...item, _apiDirection: 'EXPENSE' }))).catch(() => [])
        ]);
        
        const combinedList = [...salesResponse, ...expensesResponse];
        let savedCount = 0;
        const results = [];

        for (const item of combinedList) {
            try {
                const ksefId = item.ksefNumber || item.invoiceReferenceNumber;
                if (!ksefId) continue;

                const isRevenue = item._apiDirection === "REVENUE";
                let nip = '0000000000';
                let name = 'Nieznany Kontrahent';

                if (isRevenue) {
                    const buyer = item.buyer || item.subject2;
                    nip = (buyer as any)?.identifier?.value || (buyer as any)?.issuedByIdentifier?.value || '0000000000';
                    name = buyer?.name || (buyer as any)?.issuedByName || 'Nieznany Kontrahent';
                } else {
                    const seller = item.seller || item.subject1;
                    nip = (seller as any)?.nip || (seller as any)?.issuedByIdentifier?.value || '0000000000';
                    name = seller?.name || (seller as any)?.issuedByName || 'Nieznany Kontrahent';
                }

                // 4a. Contractor Sync
                let contractor = await prisma.contractor.findUnique({ where: { tenantId_nip: { tenantId, nip } } });

                if (!contractor) {
                    contractor = await prisma.contractor.create({
                        data: { tenantId, nip, name, status: 'PENDING', type: isRevenue ? 'KLIENT' : 'DOSTAWCA' }
                    });
                    await syncContractorToFirestore(contractor);
                } else if (!contractor.name || contractor.name === 'Nieznany Kontrahent') {
                    contractor = await prisma.contractor.update({ where: { id: contractor.id }, data: { name } });
                    await syncContractorToFirestore(contractor);
                }

                // 4b. Invoice Header Sync
                const amountGross = new Decimal(item.grossGrossAmount || item.grossAmount || 0);
                const amountNet = new Decimal(item.netAmount || 0);
                const vatAmount = new Decimal(item.vatAmount || 0);

                // 4b. VECTOR 098.1: ABSOLUTNA BLOKADA DUPLIKATÓW (Pre-check)
                const existingInvoice = await prisma.invoice.findUnique({
                    where: { ksefId }
                });

                let result;
                if (existingInvoice) {
                    // Jeśli istnieje, tylko aktualizujemy (Vector 098.2: Context Binding)
                    result = await prisma.invoice.update({
                        where: { ksefId },
                        data: { updatedAt: new Date() }
                    });
                } else {
                    // Jeśli nie istnieje, tworzymy "szkielet" (XML_MISSING)
                    result = await prisma.invoice.create({
                        data: {
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
                        }
                    });
                    savedCount++;
                }

                await syncInvoiceToFirestore({
                    ...result,
                    type: result.type,
                    amountNet: result.amountNet.toNumber(),
                    amountGross: result.amountGross.toNumber(),
                    taxRate: result.taxRate.toNumber()
                });

                savedCount++;
                results.push({ ksefId, invoiceNumber: item.invoiceNumber, seller: name, amount: amountGross.toString() });
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
