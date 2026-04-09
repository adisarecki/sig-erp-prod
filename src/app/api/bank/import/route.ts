import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { CSVBankParser } from "@/lib/csv-bank-parser";
import { ContractorResolutionService } from "@/lib/finance/contractorResolutionService";

/**
 * DNA Vector 104: PKO BP Bank Statement Ingestion.
 * Handles CSV upload and persists data into BankStaging (Gatekeeper Table).
 */
export async function POST(req: Request) {
    try {
        const tenantId = await getCurrentTenantId();
        const { csvContent } = await req.json();

        if (!csvContent) {
            return NextResponse.json({ success: false, error: "Missing CSV content." }, { status: 400 });
        }

        const transactions = CSVBankParser.parse(csvContent);

        // Logic: Persist all new entries to BankStaging
        let createdCount = 0;
        for (const tx of transactions) {
            // VECTOR 116.1: Real-time Identity Resolution during Import
            const resolution = await ContractorResolutionService.resolveFromBankTransaction(
                tenantId,
                {
                    iban: (tx as any).iban || (tx as any).accountNumber,
                    counterpartyName: tx.counterpartyRaw,
                    description: (tx as any).rawType + " " + (tx.title || ""),
                    title: tx.title,
                    amount: tx.amount
                },
                prisma
            );

            // @ts-ignore
            await prisma.bankStaging.create({
                data: {
                    tenantId,
                    date: new Date(tx.transactionDate),
                    amount: tx.amount,
                    rawType: (tx as any).typeDescription || tx.description || "",
                    counterpartyName: tx.counterpartyRaw,
                    title: tx.title,
                    status: resolution.confidence === 100 ? 'SUGGESTED' : (resolution.contractorId ? 'SUGGESTED' : 'PENDING'),
                    suggestionId: resolution.contractorId,
                    matchConfidence: resolution.confidence
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
