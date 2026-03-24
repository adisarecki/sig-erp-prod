import { NextRequest, NextResponse } from "next/server";
import { getCurrentTenantId } from "@/lib/tenant";
import prisma from "@/lib/prisma";

/**
 * SYNC RESET UTILITY (Phase 12)
 * Returns a clean, empty baseline for the finance registry after a purge.
 * This prevents the frontend from crashing if it expects a valid transaction array.
 */
export async function GET(request: NextRequest) {
    try {
        const tenantId = await getCurrentTenantId();
        
        // We return success and an empty valid structure for transactions.
        // This ensures that even if SWR/React Query is polling, it gets a valid response.
        return NextResponse.json({ 
            success: true, 
            transactions: [], 
            count: 0,
            message: "Registry state reset successfully.",
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error("[SYNC_RESET_ERROR]", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
