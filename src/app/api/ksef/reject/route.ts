import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTenantId } from '@/lib/tenant';
import prisma from '@/lib/prisma';

/**
 * POST /api/ksef/reject
 * VECTOR 103: Reject Document (Strefa Buforowa)
 * Marks selected invoices as REJECTED in KsefInvoice table so they 
 * don't appear in future sync results.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { ksefIds } = body;

        if (!ksefIds || !Array.isArray(ksefIds) || ksefIds.length === 0) {
            return NextResponse.json({ success: false, error: "Brak identyfikatorów KSeF." }, { status: 400 });
        }

        const tenantId = await getCurrentTenantId();
        
        let rejectedCount = 0;

        for (const ksefId of ksefIds) {
            try {
                // We upsert because we might not have a record in KsefInvoice yet 
                // if it was just fetched via shallow sync and never persisted.
                await prisma.ksefInvoice.upsert({
                    where: { ksefNumber: ksefId },
                    create: {
                        tenantId,
                        ksefNumber: ksefId,
                        invoiceNumber: 'ODRZUCONA', // Placeholder since we don't have full data
                        issueDate: new Date(),
                        counterpartyNip: '0000000000',
                        counterpartyName: 'Odrzucona',
                        netAmount: 0,
                        vatAmount: 0,
                        grossAmount: 0,
                        rawXml: '',
                        status: 'REJECTED'
                    },
                    update: {
                        status: 'REJECTED',
                        updatedAt: new Date()
                    }
                });
                rejectedCount++;
            } catch (err: any) {
                console.error(`[REJECT_ITEM_ERROR] ${ksefId}:`, err.message);
            }
        }

        return NextResponse.json({
            success: true,
            count: rejectedCount,
            message: `Odrzucono ${rejectedCount} faktur.`
        });

    } catch (error: unknown) {
        const err = error as Error;
        console.error("[KSeF_API_REJECT_ERROR]", err);
        return NextResponse.json(
            { success: false, error: err.message || "Wystąpił błąd podczas odrzucania faktur." },
            { status: 500 }
        );
    }
}
