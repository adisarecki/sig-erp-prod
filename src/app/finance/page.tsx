export const dynamic = "force-dynamic"
import { TooltipHelp } from "@/components/ui/TooltipHelp"
import { QuickActionsBar } from "@/components/finance/QuickActionsBar"
import { ArrowDownRight, ArrowUpRight, FileText } from "lucide-react"
import Link from "next/link"

import { scanForLeaks } from "@/lib/finance/leakage-detection"
import { LeakageAlerts } from "@/components/finance/LeakageAlerts"
import { getAdminDb } from "@/lib/firebaseAdmin"
import { getCurrentTenantId } from "@/lib/tenant"
import { getProjects } from "@/app/actions/projects"
import { getContractors } from "@/app/actions/crm"

import { TransactionHistory } from "@/components/finance/TransactionHistory"

// ... (existing functions)

export default async function FinancePage({ 
    searchParams 
}: { 
    searchParams: Promise<{ filter?: string }> 
}) {
    const params = await searchParams
    const activeFilter = params.filter || 'ALL'
    const tenantId = await getCurrentTenantId()
    let transactions: any[] = []
    let projectsMap: { id: string, name: string }[] = []
    let contractorsMap: { id: string, name: string }[] = []
    let leakageAlerts: any[] = []
    let fetchError: string | null = null

    try {
        leakageAlerts = await scanForLeaks(tenantId)

        // Pobieramy projekty z Firestore
        const rawProjects = (await getProjects()) as any[]
        projectsMap = rawProjects.map(p => ({ id: p.id, name: p.name }))

        // Pobieramy kontrahentów
        const rawContractors = (await getContractors()) as any[]
        contractorsMap = rawContractors.map(c => ({ id: c.id, name: c.name }))

        // Pobieramy transakcje i faktury z Firestore
        const adminDb = getAdminDb()
        const [transactionsSnap, invoicesSnap] = await Promise.all([
            adminDb.collection("transactions").where("tenantId", "==", tenantId).get(),
            adminDb.collection("invoices").where("tenantId", "==", tenantId).get()
        ])

        const rawTransactions = transactionsSnap.docs.map(d => ({ id: d.id, ...d.data() as any })).filter(t => t.status === "ACTIVE")
        const rawInvoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() as any }))

        const now = new Date()

        // Grupowanie transakcji po invoiceId dla łatwego lookupu
        const txByInvoiceId = new Map<string, any>()
        rawTransactions.forEach(tx => {
            if (tx.invoiceId) {
                txByInvoiceId.set(tx.invoiceId, tx)
            }
        })

        const historyItems = [
            // 1. Transakcje wolne (bez powiązania z fakturą)
            ...rawTransactions
                .filter(tx => !tx.invoiceId)
                .map(t => ({
                    id: t.id,
                    isInvoice: false,
                    type: t.type,
                    title: t.description || t.category,
                    date: t.transactionDate,
                    amount: Number(t.amount),
                    projectId: t.projectId || null,
                    classification: t.classification || (t.projectId ? 'PROJECT_COST' : 'GENERAL_COST'),
                    statusBadge: 'OPŁACONA',
                    statusColor: 'bg-emerald-100 text-emerald-700'
                })),
            // 2. Faktury (z ewentualnie wstrzykniętym statusem płatności)
            ...rawInvoices.map(inv => {
                const isIncome = inv.type === 'SPRZEDAŻ'
                const dueDate = new Date(inv.dueDate)
                const linkedTx = txByInvoiceId.get(inv.id)
                
                let badge = 'DO ZAPŁATY'
                let color = 'bg-amber-100 text-amber-700'
                let displayDate = inv.issueDate || inv.createdAt

                if (inv.status === 'PAID' || linkedTx) {
                    badge = 'OPŁACONA'
                    color = 'bg-emerald-100 text-emerald-700'
                    // Jeśli mamy transakcję, data płatności jest istotniejsza dla osi czasu
                    if (linkedTx) {
                        displayDate = linkedTx.transactionDate
                    }
                } else if (dueDate < now) {
                    badge = 'OPÓŹNIONA'
                    color = 'bg-rose-100 text-rose-700'
                }

                return {
                    id: inv.id,
                    isInvoice: true,
                    type: isIncome ? 'PRZYCHÓD' : 'KOSZT',
                    title: inv.externalId || inv.description || 'Dokument Finansowy',
                    date: displayDate,
                    dueDate: inv.dueDate,
                    amount: Number(inv.amountGross),
                    projectId: inv.projectId || null,
                    classification: inv.projectId ? 'PROJECT_COST' : 'GENERAL_COST',
                    statusBadge: badge,
                    statusColor: color,
                    contractorId: inv.contractorId
                }
            })
        ]

        transactions = historyItems
            .filter(t => {
                if (activeFilter === 'PROJECT') return t.classification === 'PROJECT_COST'
                if (activeFilter === 'GENERAL') return t.classification === 'GENERAL_COST'
                return true
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    } catch (err: any) {
        console.error("Finance Page fetch error:", err)
        fetchError = err.message || "Wystąpił nieoczekiwany błąd podczas pobierania danych z bazy."
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Finanse i Cash Flow</h1>
                    <p className="text-slate-500 mt-1">Wszystkie transakcje, faktury i zaciągnięte wyciągi z banku.</p>
                </div>
                <div className="inline-flex items-center">
                    <TooltipHelp content="Moduł Łowca Kontrahentów - importuje historię z banku PKO BP do budowania bazy kontrahentów." />
                    <Link href="/finance/import" className="bg-white border text-blue-600 hover:bg-blue-50 hover:border-blue-200 border-slate-200 px-4 py-2 rounded-md font-medium transition cursor-pointer shadow-sm">
                        Import PKO BP
                    </Link>
                </div>
            </div>

            {fetchError && (
                <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200">
                    <p className="font-bold">Błąd wczytywania danych finances</p>
                    <p className="text-sm">{fetchError}</p>
                </div>
            )}

            {/* LEAKAGE DETECTION ALERTS */}
            <LeakageAlerts alerts={leakageAlerts} />

            {/* PANEL SZYBKICH AKCJI */}
            <QuickActionsBar projects={projectsMap} contractors={contractorsMap} />

            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="border-b border-slate-100 px-6 py-4 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-slate-500" /> Rejestr Transakcji
                    </h2>
                    
                    <div className="flex bg-slate-100 p-1 rounded-lg self-stretch sm:self-auto">
                        <Link 
                            href="/finance?filter=ALL"
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            WSZYSTKIE
                        </Link>
                        <Link 
                            href="/finance?filter=PROJECT"
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeFilter === 'PROJECT' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            PROJEKTOWE
                        </Link>
                        <Link 
                            href="/finance?filter=GENERAL"
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeFilter === 'GENERAL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            KOSZTY ADMINISTRACYJNE/OGÓLNE
                        </Link>
                    </div>
                </div>
                
                <TransactionHistory 
                    transactions={transactions} 
                    projectsMap={Object.fromEntries(projectsMap.map(p => [p.id, p.name]))}
                    allProjects={projectsMap}
                />
            </div>
        </div>
    );
}

