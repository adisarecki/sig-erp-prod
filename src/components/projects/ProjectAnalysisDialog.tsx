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
import { LineChart as LineChartIcon, Lock, Info } from "lucide-react"
import { ProjectBurnChart } from "./ProjectBurnChart"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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
    retentionRate = 0.1 // Domyślnie 10% dla Widoku Wizjonera (Wektor 101.1)
}: ProjectAnalysisDialogProps) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                    <LineChartIcon className="h-5 w-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] bg-white border border-slate-200 shadow-xl rounded-3xl p-0 overflow-hidden">
                <DialogHeader className="p-8 bg-slate-50 border-b">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100">
                            <LineChartIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight italic">Analiza Zdrowia: Paliwo vs Skarbiec</DialogTitle>
                            <DialogDescription className="text-slate-500 font-medium">
                                Architektura Płynności Projektu: <strong className="text-slate-700">{projectName}</strong>
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>
                
                <div className="p-8 space-y-8">
                    {(() => {
                        const costInvoices = invoices.filter((inv) => inv.type === 'KOSZT' || inv.type === 'EXPENSE' || inv.type === 'WYDATEK' || inv.type === 'ZAKUP')
                        const incomeInvoices = invoices.filter((inv) => inv.type === 'SPRZEDAŻ' || inv.type === 'PRZYCHÓD' || inv.type === 'INCOME' || inv.type === 'REVENUE')

                        const totalCostsNet = costInvoices.reduce((sum, inv) => sum + Number(inv.amountNet), 0)
                        const totalIncomesNet = incomeInvoices.reduce((sum, inv) => sum + Number(inv.amountNet), 0)

                        // --- LOGIC LAYER: VECTOR 101.1 (LIQUIDITY-FIRST) ---
                        const retentionMultiplier = 1 - retentionRate
                        const NetOperatingLimit = budgetEstimated * retentionMultiplier // Paliwo (90%)
                        const GrossBillingPotential = budgetEstimated // Potencjał (100%)
                        const SkarbiecNominal = budgetEstimated * retentionRate // Kaucja (10%)
                        
                        const NetInflowActual = totalIncomesNet * retentionMultiplier // Realny wpływ do dziś
                        const currentRetentionValue = totalIncomesNet * retentionRate // Kaucja zamrożona do dziś
                        
                        // Obliczenia postępu wewnątrz limitu operacyjnego
                        const percentOfNetLimit = NetOperatingLimit > 0 ? (NetInflowActual / NetOperatingLimit) * 100 : 0
                        const remainingNetOperatingLimit = NetOperatingLimit - NetInflowActual
                        
                        // Rentowność (RealProfit) bazuje na NetInflowActual, a nie na fakturowaniu (Gross)
                        const RealProfit = NetInflowActual - totalCostsNet
                        const isLoss = RealProfit < 0
                        const currentRoi = totalCostsNet > 0 ? (RealProfit / totalCostsNet * 100) : 0

                        return (
                            <div className="space-y-8">
                                {/* UI LAYER: DOUBLE-LAYER PROGRESS BAR */}
                                <div className="p-6 rounded-3xl border border-slate-200 bg-slate-50/50 shadow-sm relative group overflow-hidden">
                                    <div className="flex justify-between items-end mb-6">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs font-black uppercase tracking-widest text-emerald-600 italic">Realny Limit Operacyjny (Paliwo)</p>
                                                <TooltipHelp content="Net liquidity for operational spending (90%)" />
                                            </div>
                                            <p className="text-3xl font-black text-slate-900 tracking-tighter">
                                                {new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(NetOperatingLimit)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <TooltipHelp content="Total Contract Value: Całkowita wartość robót do wykonania (Gross Revenue Potential)." />
                                                <p className="text-[10px] font-black uppercase text-slate-400">Potencjał Fakturowania</p>
                                            </div>
                                            <p className="text-xl font-bold text-slate-400 tracking-tight">
                                                {new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(GrossBillingPotential)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* DoubleLayerProgressBar Engine (Vector 101.1) */}
                                    <div className="relative w-full h-10 bg-slate-200 rounded-2xl overflow-hidden shadow-inner flex border-2 border-slate-100">
                                        {/* Status: Active Inflow (Paliwo zużyte) */}
                                        <div 
                                            className="h-full bg-emerald-500 z-10 transition-all duration-1000 shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center text-[10px] font-black text-white px-2"
                                            style={{ width: `${percentOfNetLimit * retentionMultiplier}%` }}
                                        >
                                            {percentOfNetLimit > 10 ? `${(percentOfNetLimit).toFixed(0)}%` : ''}
                                        </div>
                                        
                                        {/* Status: Available Area (Paliwo wolne) */}
                                        <div className="flex-1 h-full bg-slate-200" />
                                        
                                        {/* Status: LOCKED ZONE (Skarbiec / Kaucja) - Vector 101.1 Visuals */}
                                        <div 
                                            className="h-full bg-slate-400 opacity-80 flex items-center justify-center border-l-2 border-slate-500/50 relative"
                                            style={{ 
                                                width: `${retentionRate * 100}%`,
                                                backgroundImage: 'linear-gradient(45deg, #94a3b8 25%, transparent 25%, transparent 50%, #94a3b8 50%, #94a3b8 75%, transparent 75%, transparent)',
                                                backgroundSize: '12px 12px'
                                            }}
                                        >
                                            <Lock className="w-5 h-5 text-slate-800 z-20" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 mt-4">
                                        <div className="flex flex-col">
                                            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">Obecne Paliwo:</p>
                                            <p className="font-bold text-slate-800">{new Intl.NumberFormat('pl-PL').format(NetInflowActual)} zł</p>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <p className="text-[9px] font-black text-rose-500 uppercase tracking-tighter">Pozostało Paliwa:</p>
                                            <p className="font-bold text-slate-800">{new Intl.NumberFormat('pl-PL').format(remainingNetOperatingLimit)} zł</p>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <div className="flex items-center gap-1">
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Skarbiec (Kaucja):</p>
                                                <TooltipHelp content="Contractual retention funds (10%)" />
                                            </div>
                                            <p className="font-bold text-slate-600">{new Intl.NumberFormat('pl-PL').format(SkarbiecNominal)} zł</p>
                                        </div>
                                    </div>
                                </div>

                                {/* SCORECARD: REAL PROFIT ANALYSIS */}
                                <div className="bg-slate-900 text-white rounded-[2rem] p-8 shadow-2xl relative overflow-hidden border-4 border-slate-800">
                                    <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none rotate-12">
                                        <span className="text-[120px] font-black italic tracking-tighter">LIQUIDITY</span>
                                    </div>
                                    
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-center mb-8">
                                            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-400 italic">Financial Scorecard: Real Cash Inflow</h3>
                                            {isLoss ? (
                                                <span className="bg-rose-600 text-[10px] font-black px-4 py-1.5 rounded-full animate-pulse shadow-lg shadow-rose-500/20 uppercase">Deficyt Płynności!</span>
                                            ) : (
                                                <span className="bg-emerald-600 text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg shadow-emerald-500/20 uppercase">Bezpieczna Marża</span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                                            <div className="space-y-1">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase">Wpływ Realny (Netto)</p>
                                                <p className="text-3xl font-black text-emerald-400 tracking-tighter whitespace-nowrap">{new Intl.NumberFormat('pl-PL').format(NetInflowActual)} zł</p>
                                                <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Kasa na koncie</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase">Wydatki Operacyjne</p>
                                                <p className="text-3xl font-black text-rose-400 tracking-tighter whitespace-nowrap">-{new Intl.NumberFormat('pl-PL').format(totalCostsNet)} zł</p>
                                                <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Koszty netto</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase">Realny Zysk (Dziś)</p>
                                                <p className={`text-3xl font-black tracking-tighter whitespace-nowrap ${isLoss ? 'text-rose-500' : 'text-indigo-400'}`}>
                                                    {isLoss ? '' : '+'}{new Intl.NumberFormat('pl-PL').format(RealProfit)} zł
                                                </p>
                                                <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Gotówka po kosztach</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase">Real ROI</p>
                                                <div className="flex items-end gap-2">
                                                    <p className={`text-3xl font-black tracking-tighter ${currentRoi > 20 ? 'text-emerald-400' : currentRoi > 10 ? 'text-amber-400' : 'text-rose-400'}`}>
                                                        {currentRoi.toFixed(1)}%
                                                    </p>
                                                </div>
                                                <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Zwrot z wydanego PLN</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200/50 shadow-sm">
                                    <div className="w-full h-[350px] min-w-full">
                                        <ProjectBurnChart
                                            invoices={invoices}
                                            transactions={transactions}
                                            budgetEstimated={budgetEstimated}
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-6 text-center italic font-bold tracking-tight uppercase opacity-50">
                                        * Vector 101.1 Protocol: Dynamika Paliwa i Skarbca na osi czasu.
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

function TooltipHelp({ content }: { content: string }) {
    return (
        <TooltipProvider>
            <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 text-slate-400 cursor-help hover:text-blue-500 transition-colors" />
                </TooltipTrigger>
                <TooltipContent className="bg-slate-900 text-white text-[10px] max-w-[200px] border-slate-800 shadow-xl px-3 py-2 rounded-xl">
                    {content}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
