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

        // Pobieramy transakcje z Firestore
        const adminDb = getAdminDb()
        let query = adminDb.collection("transactions").where("tenantId", "==", tenantId)

        const transactionsSnap = await query.get()

        transactions = transactionsSnap.docs
            .map(d => ({ id: d.id, ...d.data() as any }))
            .filter(t => t.status === "ACTIVE")
            .filter(t => {
                if (activeFilter === 'PROJECT') return t.classification === 'PROJECT_COST'
                if (activeFilter === 'GENERAL') return t.classification === 'GENERAL_COST'
                return true
            })
            .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())

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

