import { NextResponse } from 'next/server';
import { getCurrentTenantId } from '@/lib/tenant';
import prisma from '@/lib/prisma';
import { KSeFService } from '@/lib/ksef/ksefService';

/**
 * GET /api/ksef/sync
 * Manually trigger KSeF invoice synchronization.
 */
export async function GET() {
    try {
        // 1. Initialize Service
        // Uses KSEF_NIP and KSEF_TOKEN from environment automatically
        const ksefService = new KSeFService();

        // 2. Get sessionToken (v2.0 handshake with dynamic key)
        let sessionToken: string;
        try {
            sessionToken = await ksefService.getSessionToken();
        } catch (err: any) {
            console.error("[KSeF_SYNC_AUTH_ERROR]", err.message);
            return NextResponse.json(
                { success: false, error: `Błąd autoryzacji KSeF (v2.0): ${err.message}` },
                { status: 401 }
            );
        }

        // 3. Use sessionToken for further requests (fetch invoices)
        const invoiceList = await ksefService.queryLatestInvoices({ sessionToken });
        
        // 4. Batch Fetch Detail XML for everything found
        const results = [];
        for (const item of invoiceList) {
            try {
                const details = await ksefService.fetchAndParse(item.invoiceReferenceNumber, { sessionToken });
                results.push({
                    ksefNumber: details.ksefNumber,
                    invoiceNumber: details.invoiceNumber,
                    seller: details.counterpartyName,
                    amount: details.grossAmount.toString(),
                    status: "UNVERIFIED"
                });
            } catch (err: any) {
                console.error(`[KSeF_SYNC_DETAIL_ERROR] ${item.invoiceReferenceNumber}:`, err.message);
            }
        }

        return NextResponse.json({
            success: true,
            count: results.length,
            invoices: results,
            message: `Pomyślnie zsynchronizowano ${results.length} faktur z KSeF.`
        });


    } catch (error: any) {
        console.error("[KSeF_API_SYNC_ERROR]", error);
        return NextResponse.json(
            { success: false, error: error.message || "Wystąpił błąd podczas synchronizacji z KSeF." },
            { status: 500 }
        );
    }
}
