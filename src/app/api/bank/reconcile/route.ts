import { NextResponse } from 'next/server';
import { getCurrentTenantId } from "@/lib/tenant";
import { ReconciliationEngine } from "@/lib/bank/reconciliation-engine";

/**
 * DNA Vector 104: Triggers the 2-level Matching Engine for all NEW bank transactions.
 */
export async function POST(req: Request) {
    try {
        const tenantId = await getCurrentTenantId();
        
        // Execute Reconciliation logic
        await ReconciliationEngine.processBankInbox(tenantId);

        return NextResponse.json({ 
            success: true, 
            message: "Reconciliation engine completed processing."
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
