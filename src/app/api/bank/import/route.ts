import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { PkoBpCsvAdapter } from "@/lib/bank/pko-bp-adapter";

/**
 * DNA Vector 104: PKO BP Bank Statement Ingestion.
 * Handles CSV upload and persists data into BankInbox (Gatekeeper Table).
 */
export async function POST(req: Request) {
    try {
        const tenantId = await getCurrentTenantId();
        const { csvContent } = await req.json();

        if (!csvContent) {
            return NextResponse.json({ success: false, error: "Missing CSV content." }, { status: 400 });
        }

        const transactions = PkoBpCsvAdapter.parse(csvContent);

        // Logic: Persist all new entries to BankInbox
        let createdCount = 0;
        for (const tx of transactions) {
            // Optional: Check if already exists based on title, date, amount (basic dedup)
            await prisma.bankInbox.create({
                data: {
                    tenantId,
                    date: tx.date,
                    amount: tx.amount,
                    rawType: tx.rawType,
                    counterpartyName: tx.counterpartyName,
                    title: tx.title,
                    status: 'NEW'
                }
            });
            createdCount++;
        }

        return NextResponse.json({ 
            success: true, 
            results: { createdCount }
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
