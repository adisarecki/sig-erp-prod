import { NextResponse } from 'next/server';
import { getCurrentTenantId } from "@/lib/tenant";
import prisma from "@/lib/prisma";
import { ReconciliationEngine } from "@/lib/bank/reconciliation-engine";

/**
 * DNA Vector 104: Manual confirmation of a Suggested Match.
 * This settles the invoice and creates the ledger entry.
 */
export async function POST(req: Request) {
    try {
        const tenantId = await getCurrentTenantId();
        const { inboxId, invoiceId } = await req.json();

        if (!inboxId || !invoiceId) {
            return NextResponse.json({ success: false, error: "Missing inboxId or invoiceId." }, { status: 400 });
        }

        const inboxItem = await prisma.bankInbox.findUnique({
            where: { id: inboxId, tenantId }
        });

        if (!inboxItem) {
            return NextResponse.json({ success: false, error: "Inbox item not found." }, { status: 404 });
        }

        // Reuse the settling logic from the engine
        await ReconciliationEngine.executeAutoMatch(inboxItem, invoiceId);

        return NextResponse.json({ 
            success: true, 
            message: "Invoice settled manually via bank import confirmation."
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
