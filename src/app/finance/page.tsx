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

// Pomocnicza funkcja do formatowania PLN
const formatPln = (value: number) => {
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value)
}

export default async function FinancePage() {
    const tenantId = await getCurrentTenantId()
    const leakageAlerts = await scanForLeaks(tenantId)

    // Pobieramy projekty i kontrahentów z Firestore
    const rawProjects = (await getProjects()) as any[]
    const projectsMap = rawProjects.map(p => ({ id: p.id, name: p.name }))

    const rawContractors = (await getContractors()) as any[]
    const contractorsMap = rawContractors.map(c => ({ id: c.id, name: c.name }))

    // Pobieramy transakcje z Firestore
    const adminDb = getAdminDb()
    const transactionsSnap = await adminDb.collection("transactions")
        .where("tenantId", "==", tenantId)
        .where("status", "==", "ACTIVE")
        .orderBy("transactionDate", "desc")
        .get()

    const transactions = transactionsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }))

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

            {/* LEAKAGE DETECTION ALERTS */}
            <LeakageAlerts alerts={leakageAlerts} />

            {/* PANEL SZYBKICH AKCJI */}
            <QuickActionsBar projects={projectsMap} contractors={contractorsMap} />


            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="border-b border-slate-100 px-6 py-4 bg-slate-50/50">
                    <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-slate-500" /> Rejestr Transakcji
                    </h2>
                </div>
                
                {transactions.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        Historia transakcji jest pusta. Dodaj swój pierwszy koszt lub przychód firmowy.
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {transactions.map((t) => (
                            <div key={t.id} className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-slate-50 transition-colors">
                                <div className="flex gap-4 items-center">
                                    <div className={`p-3 rounded-xl flex items-center justify-center shrink-0 ${t.type === 'PRZYCHÓD' ? 'bg-green-100 text-green-600' : 'bg-rose-100 text-rose-600'}`}>
                                        {t.type === 'PRZYCHÓD' ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-900 text-lg">
                                            {t.description || t.category}
                                        </p>
                                        <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                                            <span className="font-medium px-2 py-0.5 rounded-md bg-slate-100">
                                                {new Date(t.transactionDate).toLocaleDateString('pl-PL')}
                                            </span>
                                            <span>•</span>
                                            <span>Projekt: {t.projectId || <span className="italic text-slate-400">Ogólne (Brak przypisania)</span>}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className={`mt-4 sm:mt-0 text-xl font-bold whitespace-nowrap pl-0 sm:pl-4 ${t.type === 'PRZYCHÓD' ? 'text-green-600' : 'text-slate-900'}`}>
                                    {t.type === 'PRZYCHÓD' ? '+' : '-'}{formatPln(Number(t.amount))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

