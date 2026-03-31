"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { LineChart as LineChartIcon, Lock } from "lucide-react"
import { ProjectBurnChart } from "./ProjectBurnChart"

interface ProjectAnalysisDialogProps {
    projectName: string
    invoices: { type: string, amountNet: number, amountGross: number, issueDate: string | Date }[]
    transactions?: { type: string, amount: number, transactionDate: string | Date }[]
    budgetEstimated: number
    retentionRate?: number // Podstawowa stawka kaucji (np. 0.1 dla 10%)
}

export function ProjectAnalysisDialog({ 
    projectName, 
    invoices, 
    transactions = [], 
    budgetEstimated,
    retentionRate = 0.1 // Domyślnie 10% dla Widoku Wizjonera
}: ProjectAnalysisDialogProps) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                    <LineChartIcon className="h-5 w-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[650px] bg-white border border-slate-200 shadow-xl rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-slate-900">Analiza Zdrowia Projektu (Real Cash)</DialogTitle>
                    <DialogDescription className="text-slate-500">
                        Wizualizacja realnego wpływu gotówki dla: <strong className="text-slate-700">{projectName}</strong>
                    </DialogDescription>
                </DialogHeader>
                <div className="mt-6">
                    {(() => {
                        const costInvoices = invoices.filter((inv) => inv.type === 'KOSZT' || inv.type === 'EXPENSE' || inv.type === 'WYDATEK' || inv.type === 'ZAKUP')
                        const incomeInvoices = invoices.filter((inv) => inv.type === 'SPRZEDAŻ' || inv.type === 'PRZYCHÓD' || inv.type === 'INCOME' || inv.type === 'REVENUE')

                        const totalCostsNet = costInvoices.reduce((sum, inv) => sum + Number(inv.amountNet), 0)
                        const totalIncomesNet = incomeInvoices.reduce((sum, inv) => sum + Number(inv.amountNet), 0)

                        // VECTOR 101: Rekalibracja na 90% Real Inflow
                        const realInflowRate = 1 - retentionRate
                        const maxRealInflow = budgetEstimated * realInflowRate
                        const currentRealInflow = totalIncomesNet * realInflowRate
                        const currentRetention = totalIncomesNet * retentionRate
                        
                        const percentOfRealInflow = maxRealInflow > 0 ? (currentRealInflow / maxRealInflow) * 100 : 0
                        const percentOfRetention = budgetEstimated > 0 ? (currentRetention / budgetEstimated) * 100 : 0
                        
                        const remainingToRealInflow = maxRealInflow - currentRealInflow
                        
                        // Rentowność liczona od Real Cash (90%), nie od faktury (100%)
                        const realProfitNet = currentRealInflow - totalCostsNet
                        const isLoss = realProfitNet < 0

                        return (
                            <div className="space-y-6">
                                {/* Sekcja 1: Postęp Kontraktu (Double-Layer Progress Bar) */}
                                <div className={`p-4 rounded-xl border flex items-start gap-4 transition-all bg-slate-50 border-slate-200 text-slate-900`}>
                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 bg-emerald-100`}>
                                        <span className="text-xl">💰</span>
                                    </div>
                                    <div className="space-y-1 w-full flex-1">
                                        <div className="flex justify-between items-end mb-1">
                                            <p className="font-black text-lg leading-none uppercase tracking-tight">
                                                Postęp Realnego Wpływu
                                            </p>
                                            <span className="text-xs font-bold text-slate-400">Total: {new Intl.NumberFormat('pl-PL').format(budgetEstimated)} zł</span>
                                        </div>
                                        <p className="text-sm opacity-90 mb-3 block">
                                            Pozostało do Realnego Wpływu: <strong className="text-emerald-600 font-black">{new Intl.NumberFormat('pl-PL').format(remainingToRealInflow)} zł (Netto)</strong>
                                        </p>
                                        
                                        {/* Double-Layer Progress Bar */}
                                        <div className="w-full bg-slate-200/50 rounded-full h-4 overflow-hidden mt-3 relative flex">
                                            <div
                                                className={`h-4 transition-all duration-1000 bg-emerald-500 z-10 shadow-[0_0_15px_rgba(16,185,129,0.3)]`}
                                                style={{ width: `${Math.min(90, percentOfRealInflow * realInflowRate)}%` }}
                                                title="Realny wpływ (Netto)"
                                            />
                                            <div
                                                className={`h-4 transition-all duration-1000 bg-slate-400/50`}
                                                style={{ width: `${Math.min(10, percentOfRetention)}%` }}
                                                title="Zablokowana kaucja (🔒)"
                                            />
                                        </div>
                                        
                                        <div className="flex justify-between text-[10px] mt-2 font-black uppercase tracking-widest">
                                            <span className="text-emerald-600">Dostępne: {new Intl.NumberFormat('pl-PL').format(currentRealInflow)} zł</span>
                                            <span className="text-slate-400 flex items-center gap-1"><Lock className="w-3 h-3" /> Kaucja: {new Intl.NumberFormat('pl-PL').format(currentRetention)} zł</span>
                                            <span className="text-slate-900 border-l border-slate-300 pl-2">Limit Operacyjny: {new Intl.NumberFormat('pl-PL').format(maxRealInflow)} zł</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Sekcja 2: Wynik Finansowy Projektu (Scorecard) */}
                                <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                                        <span className="text-6xl">📊</span>
                                    </div>
                                    <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400 mb-6 flex items-center gap-2">
                                        <span className="flex items-center gap-2 italic">Real Profit Analysis <TooltipHelp content="Zysk liczony w oparciu o realny wpływ (90%), a nie obietnicę zapłaty kaucji." /></span>
                                        {isLoss && <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse font-black uppercase">Alarm: Deficyt gotówkowy!</span>}
                                    </h3>

                                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mb-1">Przychody (Netto 90%)</p>
                                            <p className="text-xl font-black text-emerald-400">{new Intl.NumberFormat('pl-PL').format(currentRealInflow)} zł</p>
                                            <p className="text-[9px] text-slate-500 mt-1 uppercase font-bold tracking-tight">Kasa na koncie</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mb-1">Koszty (Netto)</p>
                                            <p className="text-xl font-black text-rose-400">-{new Intl.NumberFormat('pl-PL').format(totalCostsNet)} zł</p>
                                            <p className="text-[9px] text-slate-500 mt-1 uppercase font-bold tracking-tight">Wydatki realne</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mb-1">Realna Marża</p>
                                            <p className={`text-xl font-black ${isLoss ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                {isLoss ? '' : '+'}{new Intl.NumberFormat('pl-PL').format(realProfitNet)} zł
                                            </p>
                                            <p className="text-[9px] text-slate-500 mt-1 uppercase font-bold tracking-tight">Zysk dostępny (Dziś)</p>
                                        </div>
                                        {/* ROI Badge */}
                                        <div className={`p-2 rounded-xl h-full flex flex-col justify-center border ${
                                            (realProfitNet / totalCostsNet * 100) > 20 ? 'bg-emerald-500/10 border-emerald-500/20' :
                                            (realProfitNet / totalCostsNet * 100) >= 10 ? 'bg-amber-500/10 border-amber-500/20' :
                                            'bg-rose-500/10 border-rose-500/20'
                                        }`}>
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter mb-1">Real ROI</p>
                                            <p className={`text-xl font-black ${
                                                (realProfitNet / totalCostsNet * 100) > 20 ? 'text-emerald-400' :
                                                (realProfitNet / totalCostsNet * 100) >= 10 ? 'text-amber-400' :
                                                'text-rose-400'
                                            }`}>
                                                {totalCostsNet > 0 ? (realProfitNet / totalCostsNet * 100).toFixed(1) : '0'}%
                                            </p>
                                            <p className="text-[8px] font-bold uppercase mt-1 opacity-70">
                                                {(realProfitNet / totalCostsNet * 100) > 20 ? "Ekstraklasa" : (realProfitNet / totalCostsNet * 100) >= 10 ? "Bezpiecznie" : "Ryzykownie"}
                                            </p>
                                        </div>
                                        {/* Rentowność */}
                                        <div className="flex flex-col justify-center">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mb-1">Rentowność</p>
                                            <p className="text-xl font-black text-indigo-400">
                                                {currentRealInflow > 0 ? (realProfitNet / currentRealInflow * 100).toFixed(1) : '0'}%
                                            </p>
                                            <p className="text-[9px] text-slate-500 mt-1 uppercase font-bold tracking-tight">Gotówka / Przychód</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Wykres */}
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    <div className="w-full h-[350px] min-w-[500px]">
                                        <ProjectBurnChart
                                            invoices={invoices}
                                            transactions={transactions}
                                            budgetEstimated={budgetEstimated}
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-4 text-center italic font-medium">
                                        * Wykres prezentuje dynamikę przychodów, kosztów (Netto) oraz narastający zysk projektu na osi czasu.
                                    </p>
                                </div>
                            </div>
                        )
                    })()}
                </div>
            </DialogContent>
        </Dialog>
    )
}

// Komponent pomocniczy dla tooltipów (jeśli brak w ui)
function TooltipHelp({ content }: { content: string }) {
    return (
        <span className="cursor-help text-slate-400" title={content}>
            ⓘ
        </span>
    )
}
