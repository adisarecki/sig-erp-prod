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
    transactions: { type: string, amount: number | string | { toNumber: () => number }, transactionDate: string | Date }[]
    budgetEstimated: number
}

export function ProjectAnalysisDialog({ projectName, transactions, budgetEstimated }: ProjectAnalysisDialogProps) {
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
                        const totalCosts = transactions
                            .filter((t: { type: string }) => t.type === 'KOSZT' || t.type === 'WYDATEK')
                            .reduce((sum: number, t: { amount: number | string | { toNumber: () => number } }) => {
                                const val = t.amount;
                                const numericAmount = (typeof val === 'object' && val !== null && 'toNumber' in val)
                                    ? (val as { toNumber: () => number }).toNumber()
                                    : Number(val || 0);
                                return sum + numericAmount;
                            }, 0)

                        const percentUsed = budgetEstimated > 0 ? (totalCosts / budgetEstimated) * 100 : 0
                        const isDanger = percentUsed >= 85
                        const remaining = budgetEstimated - totalCosts

                        return (
                            <div className={`p-4 rounded-xl border mb-6 flex items-start gap-4 transition-all ${isDanger
                                ? "bg-red-50 border-red-200 text-red-900"
                                : "bg-green-50 border-green-200 text-green-900"
                                }`}>
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${isDanger ? "bg-red-100" : "bg-green-100"
                                    }`}>
                                    <span className="text-xl">{isDanger ? "🔴" : "🟢"}</span>
                                </div>
                                <div className="space-y-1 w-full flex-1">
                                    <p className="font-bold text-lg leading-none">
                                        Status: {isDanger ? "Zagrożenie!" : "Bezpieczny"}
                                    </p>
                                    <p className="text-sm opacity-90 mb-3 block">
                                        {isDanger
                                            ? `Przekroczono bezpieczny próg lub budżet o ${new Intl.NumberFormat('pl-PL').format(Math.abs(remaining))} zł. Przejrzyj koszty!`
                                            : `Wykorzystano ${Math.round(percentUsed)}% szacowanego budżetu (Pozostało: ${new Intl.NumberFormat('pl-PL').format(remaining)} zł).`
                                        }
                                    </p>
                                    <div className="w-full bg-slate-200/50 rounded-full h-3 overflow-hidden mt-3">
                                        <div
                                            className={`h-3 rounded-full transition-all duration-1000 ${isDanger ? 'bg-red-500' : 'bg-green-500'}`}
                                            style={{ width: `${Math.min(100, percentUsed)}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs mt-1 font-semibold opacity-80">
                                        <span>Skumulowane Koszty: {new Intl.NumberFormat('pl-PL').format(totalCosts)} zł</span>
                                        <span>Sufit: {new Intl.NumberFormat('pl-PL').format(budgetEstimated)} zł</span>
                                    </div>
                                </div>
                            </div>
                        )
                    })()}

                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <div className="w-full h-[350px] min-w-[500px]">
                            <ProjectBurnChart
                                transactions={transactions}
                                budgetEstimated={budgetEstimated}
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-4 text-center italic">
                            * Wykres prezentuje skumulowane koszty rzeczywiste w porównaniu do estymowanego budżetu (sufitu).
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
