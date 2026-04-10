import { getSuggestedReconciliations } from "@/app/actions/reconciliation"
import { ReconciliationWorkbench } from "@/components/finance"
import { BadgeDollarSign } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function ReconciliationPage() {
    const suggestedData = await getSuggestedReconciliations()

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Poczekalnia Rozliczeń</h1>
                    <p className="text-slate-500 mt-1">Mózg SIG ERP – Inteligentne parowanie przelewów z fakturami (Fuzzy Match).</p>
                </div>
            </div>

            {/* HERO SECTION - RECONCILIATION STATS */}
            <div className="bg-gradient-to-br from-blue-900 via-slate-900 to-black text-white p-8 rounded-3xl shadow-xl relative overflow-hidden border border-slate-800">
                <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                    <BadgeDollarSign className="w-48 h-48 text-blue-300" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-medium text-slate-300">Gotowość do Rozliczenia</h2>
                    </div>
                    <p className="text-5xl font-black tracking-tight mt-4 text-blue-400">
                        {suggestedData.length} <span className="text-2xl font-normal text-slate-400">transakcji oczekuje</span>
                    </p>
                    <div className="mt-6 border-t border-slate-700/50 pt-6">
                        <p className="text-sm text-slate-400 font-medium">System automatyzuje do 90% pracy. Zweryfikuj i zatwierdź propozycje poniżej.</p>
                    </div>
                </div>
            </div>

            <ReconciliationWorkbench initialData={suggestedData} />
        </div>
    )
}
