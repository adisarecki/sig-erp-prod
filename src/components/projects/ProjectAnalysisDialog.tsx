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
import { LineChart as LineChartIcon } from "lucide-react"
import { ProjectBurnChart } from "./ProjectBurnChart"

interface ProjectAnalysisDialogProps {
    projectName: string
    invoices: { type: string, amountNet: number, amountGross: number, issueDate: string | Date }[]
    transactions?: { type: string, amount: number, transactionDate: string | Date }[]
    budgetEstimated: number
}

export function ProjectAnalysisDialog({ projectName, invoices, transactions = [], budgetEstimated }: ProjectAnalysisDialogProps) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                    <LineChartIcon className="h-5 w-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[650px] bg-white border border-slate-200 shadow-xl rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-slate-900">Analiza Zdrowia Projektu</DialogTitle>
                    <DialogDescription className="text-slate-500">
                        Wizualizacja zużycia budżetu dla projektu: <strong className="text-slate-700">{projectName}</strong>
                    </DialogDescription>
                </DialogHeader>
                <div className="mt-6">
                    {(() => {
                        const costInvoices = invoices.filter((inv) => inv.type === 'KOSZT' || inv.type === 'EXPENSE' || inv.type === 'WYDATEK' || inv.type === 'ZAKUP')
                        const incomeInvoices = invoices.filter((inv) => inv.type === 'SPRZEDAŻ' || inv.type === 'PRZYCHÓD' || inv.type === 'INCOME' || inv.type === 'REVENUE')

                        const totalCostsNet = costInvoices.reduce((sum, inv) => sum + Number(inv.amountNet), 0)
                        const totalIncomesNet = incomeInvoices.reduce((sum, inv) => sum + Number(inv.amountNet), 0)

                        const percentBilled = budgetEstimated > 0 ? (totalIncomesNet / budgetEstimated) * 100 : 0
                        const remainingToBill = budgetEstimated - totalIncomesNet
                        
                        const netMargin = totalIncomesNet - totalCostsNet
                        const isLoss = netMargin < 0

                        return (
                            <div className="space-y-6">
                                {/* Sekcja 1: Postęp Kontraktu (Contract Progress) */}
                                <div className={`p-4 rounded-xl border flex items-start gap-4 transition-all bg-slate-50 border-slate-200 text-slate-900`}>
                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 bg-blue-100`}>
                                        <span className="text-xl">📊</span>
                                    </div>
                                    <div className="space-y-1 w-full flex-1">
                                        <p className="font-bold text-lg leading-none">
                                            Postęp Fakturowania Kontraktu
                                        </p>
                                        <p className="text-sm opacity-90 mb-3 block">
                                            Zafakturowano {percentBilled.toFixed(1)}% szacowanego budżetu (Pozostało do zafakturowania: <strong className="text-blue-700 font-bold">{new Intl.NumberFormat('pl-PL').format(remainingToBill)} zł (Netto)</strong>).
                                        </p>
                                        <div className="w-full bg-slate-200/50 rounded-full h-3 overflow-hidden mt-3">
                                            <div
                                                className={`h-3 rounded-full transition-all duration-1000 bg-blue-500`}
                                                style={{ width: `${Math.min(100, percentBilled)}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[10px] mt-1 font-semibold opacity-70 uppercase tracking-tighter">
                                            <span>Zafakturowano: {new Intl.NumberFormat('pl-PL').format(totalIncomesNet)} zł</span>
                                            <span>Limit Kontraktu: {new Intl.NumberFormat('pl-PL').format(budgetEstimated)} zł</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Sekcja 2: Wynik Finansowy Projektu (Scorecard) */}
                                <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                                        <span className="text-6xl">💰</span>
                                    </div>
                                    <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400 mb-6 flex items-center gap-2">
                                        <span>Rentowność Jednostkowa (Real Profit)</span>
                                        {isLoss && <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse">Projekt Niezarobkowy!</span>}
                                    </h3>

                                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mb-1">Przychody (Netto)</p>
                                            <p className="text-xl font-black text-emerald-400">{new Intl.NumberFormat('pl-PL').format(totalIncomesNet)} zł</p>
                                            <p className="text-[10px] text-slate-500 mt-1">Realny wpływ</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mb-1">Koszty (Netto)</p>
                                            <p className="text-xl font-black text-rose-400">-{new Intl.NumberFormat('pl-PL').format(totalCostsNet)} zł</p>
                                            <p className="text-[10px] text-slate-500 mt-1">Wydatki realne</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mb-1">Marża Kwotowa</p>
                                            <p className={`text-xl font-black ${isLoss ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                {isLoss ? '' : '+'}{new Intl.NumberFormat('pl-PL').format(netMargin)} zł
                                            </p>
                                            <p className="text-[10px] text-slate-500 mt-1">Zysk / Strata</p>
                                        </div>
                                        {/* ROI Badge */}
                                        <div className={`p-2 rounded-xl h-full flex flex-col justify-center border ${
                                            (netMargin / totalCostsNet * 100) > 30 ? 'bg-emerald-500/10 border-emerald-500/20' :
                                            (netMargin / totalCostsNet * 100) >= 15 ? 'bg-amber-500/10 border-amber-500/20' :
                                            'bg-rose-500/10 border-rose-500/20'
                                        }`}>
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter mb-1">ROI (Zwrot)</p>
                                            <p className={`text-xl font-black ${
                                                (netMargin / totalCostsNet * 100) > 30 ? 'text-emerald-400' :
                                                (netMargin / totalCostsNet * 100) >= 15 ? 'text-amber-400' :
                                                'text-rose-400'
                                            }`}>
                                                {totalCostsNet > 0 ? (netMargin / totalCostsNet * 100).toFixed(1) : '0'}%
                                            </p>
                                            <p className="text-[8px] font-bold uppercase mt-1 opacity-70">
                                                {(netMargin / totalCostsNet * 100) > 30 ? "Super biznes" : (netMargin / totalCostsNet * 100) >= 15 ? "Ok, pilnuj" : "Alarm!"}
                                            </p>
                                        </div>
                                        {/* Rentowność */}
                                        <div className="flex flex-col justify-center">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mb-1">Rentowność</p>
                                            <p className="text-xl font-black text-indigo-400">
                                                {totalIncomesNet > 0 ? (netMargin / totalIncomesNet * 100).toFixed(1) : '0'}%
                                            </p>
                                            <p className="text-[10px] text-slate-500 mt-1">Marża na sprzedaży</p>
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
                                    <p className="text-[10px] text-slate-400 mt-4 text-center italic">
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
