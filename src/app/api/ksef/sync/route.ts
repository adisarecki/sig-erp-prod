import { NextResponse } from 'next/server';
import { getCurrentTenantId } from '@/lib/tenant';
import prisma from '@/lib/prisma';
import { KSeFService } from '@/lib/ksef/ksef-service';

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

        // 2. Initialize Service and Sync
        const ksefService = new KSeFService();
        
        // Default sync range: last 30 days
        const now = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);

        const dateFrom = thirtyDaysAgo.toISOString();
        const dateTo = now.toISOString();

        const syncedInvoices = await ksefService.syncInvoices(dateFrom, dateTo);

        return NextResponse.json({
            success: true,
            count: syncedInvoices.length,
            message: `Pobrano ${syncedInvoices.length} nowych faktur z KSeF.`
        });

    } catch (error: any) {
        console.error("[KSeF_API_SYNC_ERROR]", error);
        return NextResponse.json(
            { success: false, error: error.message || "Wystąpił błąd podczas synchronizacji z KSeF." },
            { status: 500 }
        );
    }
}
