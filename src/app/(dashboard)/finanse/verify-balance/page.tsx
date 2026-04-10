import { Landmark, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { VerifyBalanceClient } from "./VerifyBalanceClient"
import prisma from "@/lib/prisma"
import { getCurrentTenantId } from "@/lib/tenant"
import Decimal from "decimal.js"

export const dynamic = "force-dynamic"

export default async function VerifyBalancePage() {
    const tenantId = await getCurrentTenantId()
    
    // Fetch staging items
    // @ts-ignore
    const rawItems = await prisma.bankStaging.findMany({
        where: { 
            tenantId,
            status: { not: "PROCESSED" } 
        },
        orderBy: { date: 'desc' }
    })

    // Prepare serializable items array with suggested categories based on history
    const allPreviousTrans = await prisma.transaction.findMany({
        where: { tenantId, source: "BANK_IMPORT" },
        select: { counterpartyRaw: true, category: true },
        distinct: ['counterpartyRaw']
    });

    const categoryMap = new Map();
    allPreviousTrans.forEach((t: any) => {
        if (t.counterpartyRaw && t.category) categoryMap.set(t.counterpartyRaw.toLowerCase(), t.category);
    });

    const stagingItems = rawItems.map((item: any) => {
        const isIncome = Number(item.amount) > 0;
        let suggestion = categoryMap.get(item.counterpartyName?.toLowerCase());
        if (!suggestion) suggestion = isIncome ? "SPRZEDAŻ" : "KOSZTY_OPERACYJNE";

        return {
            id: item.id,
            date: item.date.toISOString(),
            amount: Number(item.amount),
            title: item.title,
            counterpartyName: item.counterpartyName,
            status: item.status,
            matchConfidence: item.matchConfidence,
            suggestionId: item.suggestionId,
            suggestedCategory: suggestion
        }
    })

    // Calculate current ledger balance
    const transactions = await prisma.transaction.findMany({
        where: { tenantId, status: 'ACTIVE' }
    });

    const ledgerSum = transactions.reduce((sum, tx) => {
        const amount = new Decimal(String(tx.amount));
        return tx.type === 'INCOME' ? sum.plus(amount) : sum.minus(amount.abs());
    }, new Decimal(0));

    // Get latest physical balance (from balance state)
    // @ts-ignore
    const latestState = await prisma.bankBalanceState.findFirst({
        where: { tenantId },
        orderBy: { verificationTimestamp: 'desc' }
    });

    let anchorBalance = null;
    if (latestState) {
        const physicalBalance = new Decimal(String(latestState.verifiedBalance))
        const delta = ledgerSum.minus(physicalBalance).abs()
        
        anchorBalance = {
            ledgerSum: ledgerSum.toNumber(),
            physicalBalance: physicalBalance.toNumber(),
            delta: delta.toNumber(),
            status: delta.isZero() ? 'VERIFIED_STABLE' : 'DISCREPANCY_ALERT'
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 p-6">
            <div className="flex items-center gap-4">
                <Link href="/">
                    <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-slate-500" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight italic flex items-center gap-3">
                        <Landmark className="w-8 h-8 text-indigo-600" />
                        Centrala Weryfikacji Salda
                    </h1>
                    <p className="text-slate-500 font-medium">Vector 120: Hub Rekoncyliacji i Prawdy Finansowej</p>
                </div>
            </div>

            <VerifyBalanceClient 
                stagingItems={stagingItems} 
                anchorBalance={anchorBalance}
            />
        </div>
    )
}
