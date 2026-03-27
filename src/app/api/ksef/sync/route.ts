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
        const tenantId = await getCurrentTenantId();
        
        // 1. Security Guard - Check if Tenant has KSeF Token
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId }
        }) as any

        if (!tenant || !tenant.ksefToken) {
            return NextResponse.json(
                { success: false, error: "Brak skonfigurowanego tokenu KSeF w ustawieniach firmy." },
                { status: 403 }
            );
        }

        // 1. Initialize Service and Sync
        const ksefService = new KSeFService();
        
        // 2. Query latest invoices
        const latestInvoices = await ksefService.queryLatestInvoices();
        
        // For Sprint 1, we just log and return the count
        console.log(`[KSeF_SYNC] Found ${latestInvoices.length} invoices to sync.`);

        return NextResponse.json({
            success: true,
            count: latestInvoices.length,
            message: `Pobrano ${latestInvoices.length} nowych faktur z KSeF (Metadane).`
        });

    } catch (error: any) {
        console.error("[KSeF_API_SYNC_ERROR]", error);
        return NextResponse.json(
            { success: false, error: error.message || "Wystąpił błąd podczas synchronizacji z KSeF." },
            { status: 500 }
        );
    }
}
