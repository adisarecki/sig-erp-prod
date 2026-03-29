"use client"

import { useState, useEffect } from "react"
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from "recharts"

interface ProjectBurnChartProps {
    invoices: { type: string, amountNet: number, amountGross: number, issueDate: string | Date }[]
    transactions?: { type: string, amount: number, transactionDate: string | Date }[]
    budgetEstimated: number
}

// Formatowanie daty dla osi X
const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" }).format(date)
}

const formatPln = (value: number) => {
    return new Intl.NumberFormat("pl-PL", {
        maximumFractionDigits: 0
    }).format(value) + " zł"
}

export function ProjectBurnChart({ invoices, transactions = [], budgetEstimated }: ProjectBurnChartProps) {
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        const frame = requestAnimationFrame(() => setIsMounted(true))
        return () => cancelAnimationFrame(frame)
    }, [])

    if (invoices.length === 0) {
        return (
            <div className="w-full h-[320px] flex items-center justify-center text-slate-400 text-sm italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Brak zarejestrowanych dokumentów. Wykres zasilany danymi po dodaniu pierwszej faktury.
            </div>
        )
    }

    // 1. Sortuj wszystkie faktury chronologicznie
    const allSorted = [...invoices].sort((a, b) => new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime())

    // 2. Budowa tabeli narastającej (dziennej)
    const groupedByDate: Record<string, { invIncome: number, invExpense: number, cashIncome: number, cashExpense: number }> = {}
    
    invoices.forEach(inv => {
        const dateKey = new Date(inv.issueDate).toISOString().split('T')[0]
        if (!groupedByDate[dateKey]) {
            groupedByDate[dateKey] = { invIncome: 0, invExpense: 0, cashIncome: 0, cashExpense: 0 }
        }
        
        const isIncome = inv.type === 'SPRZEDAŻ' || inv.type === 'PRZYCHÓD' || inv.type === 'INCOME' || inv.type === 'REVENUE'
        const isExpense = inv.type === 'KOSZT' || inv.type === 'EXPENSE' || inv.type === 'WYDATEK' || inv.type === 'ZAKUP'
        
        if (isIncome) groupedByDate[dateKey].invIncome += Number(inv.amountNet)
        if (isExpense) groupedByDate[dateKey].invExpense += Number(inv.amountNet)
    })

    transactions.forEach(t => {
        const dateKey = new Date(t.transactionDate).toISOString().split('T')[0]
        if (!groupedByDate[dateKey]) {
            groupedByDate[dateKey] = { invIncome: 0, invExpense: 0, cashIncome: 0, cashExpense: 0 }
        }
        
        const isIncome = t.type === 'PRZYCHÓD' || t.type === 'INCOME' || t.type === 'REVENUE' || t.type === 'SPRZEDAŻ'
        const isExpense = t.type === 'KOSZT' || t.type === 'EXPENSE' || t.type === 'WYDATEK' || t.type === 'ZAKUP'
        
        if (isIncome) groupedByDate[dateKey].cashIncome += Number(t.amount)
        if (isExpense) groupedByDate[dateKey].cashExpense += Number(t.amount)
    })

    const chartData: any[] = []
    let cumulInvIncome = 0
    let cumulInvExpense = 0
    let cumulCashIncome = 0
    let cumulCashExpense = 0
    
    // Pobierz wszystkie unikalne daty i posortuj
    const sortedDates = Object.keys(groupedByDate).sort()
    
    // Punkt startowy (zerowy)
    if (sortedDates.length > 0) {
        const firstDate = new Date(sortedDates[0])
        firstDate.setDate(firstDate.getDate() - 1)
        chartData.push({
            date: firstDate.toISOString(),
            income: 0,
            expense: 0,
            result: 0,
            runway: budgetEstimated,
            roi: 0
        })
    }

    sortedDates.forEach(date => {
        cumulInvIncome += groupedByDate[date].invIncome
        cumulInvExpense += groupedByDate[date].invExpense
        cumulCashIncome += groupedByDate[date].cashIncome
        cumulCashExpense += groupedByDate[date].cashExpense
        
        const result = cumulCashIncome - cumulCashExpense
        const runway = Math.max(0, budgetEstimated - cumulInvIncome)
        
        // ROI(t) = (Profit(t) / Cost(t)) * 100
        const currentRoi = cumulCashExpense > 0 ? (result / cumulCashExpense) * 100 : 0
        
        chartData.push({
            date: new Date(date).toISOString(),
            income: cumulInvIncome,
            expense: cumulInvExpense,
            result: result,
            runway: runway,
            roi: Number(currentRoi.toFixed(1))
        })
    })

    if (!isMounted) {
        return <div className="w-full h-[320px] bg-slate-50/50 animate-pulse rounded-xl border border-slate-100" />
    }

    return (
        <div className="w-full h-[400px] min-h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                    <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={30}
                    />
                    {/* Oś lewa: PLN */}
                    <YAxis
                        yAxisId="pln"
                        width={80}
                        tickFormatter={formatPln}
                        tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                    />
                    {/* Oś prawa: ROI (%) */}
                    <YAxis
                        yAxisId="roi"
                        orientation="right"
                        tickFormatter={(val) => `${val}%`}
                        tick={{ fontSize: 10, fill: '#6366f1', fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                        domain={[0, 'auto']}
                    />
                    <Tooltip
                        content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                                return (
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xl space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b pb-1 mb-2">
                                            Stan na: {label ? formatDate(label as string) : ''}
                                        </p>
                                        <div className="space-y-1">
                                            <div className="flex justify-between gap-8 items-center">
                                                <span className="text-xs font-bold text-slate-500">Zafakturowano:</span>
                                                <span className="text-xs font-black text-amber-500">{new Intl.NumberFormat('pl-PL').format(payload[0]?.value as number || 0)} zł</span>
                                            </div>
                                            <div className="flex justify-between gap-8 items-center">
                                                <span className="text-xs font-bold text-slate-500">Wydano (Netto):</span>
                                                <span className="text-xs font-black text-blue-500">{new Intl.NumberFormat('pl-PL').format(payload[1]?.value as number || 0)} zł</span>
                                            </div>
                                            <div className="flex justify-between gap-8 items-center pt-1 border-t">
                                                <span className="text-xs font-bold text-slate-700">Skumulowany Zysk:</span>
                                                <span className={`text-sm font-black ${(payload[2]?.value as number || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {new Intl.NumberFormat('pl-PL').format(payload[2]?.value as number || 0)} zł
                                                </span>
                                            </div>
                                            <div className="flex justify-between gap-8 items-center mt-1 pt-1 border-t border-dashed">
                                                <span className="text-xs font-bold text-indigo-600">Aktualny ROI:</span>
                                                <span className="text-sm font-black text-indigo-700">{(payload[4]?.value as number || 0).toFixed(1)}%</span>
                                            </div>
                                            <div className="flex justify-between gap-8 items-center mt-1 pt-1 border-t border-dashed">
                                                <span className="text-[10px] font-bold text-slate-400 italic">Do zafakturowania:</span>
                                                <span className="text-[10px] font-black text-slate-400 italic">{new Intl.NumberFormat('pl-PL').format(payload[3]?.value as number || 0)} zł</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Legend
                        verticalAlign="top"
                        height={40}
                        iconType="circle"
                        formatter={(value) => <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter ml-1">{value}</span>}
                    />

                    {/* Skumulowane Przychody */}
                    <Line
                        yAxisId="pln"
                        name="Przychody (Netto)"
                        type="monotone"
                        dataKey="income"
                        stroke="#f59e0b" // Yellow/Amber
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0, fill: "#f59e0b" }}
                    />

                    {/* Skumulowane Koszty */}
                    <Line
                        yAxisId="pln"
                        name="Koszty (Netto)"
                        type="monotone"
                        dataKey="expense"
                        stroke="#3b82f6" // Blue
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0, fill: "#3b82f6" }}
                    />

                    {/* Wynik / Zysk */}
                    <Line
                        yAxisId="pln"
                        name="Wynik (Profit)"
                        type="monotone"
                        dataKey="result"
                        stroke="#10b981" // Green
                        strokeWidth={4} // Bold
                        dot={false}
                        activeDot={{ r: 6, strokeWidth: 0, fill: "#10b981" }}
                    />

                    {/* Runway / Pozostały Budżet */}
                    <Line
                        yAxisId="pln"
                        name="Pozostały Budżet"
                        type="monotone"
                        dataKey="runway"
                        stroke="#94a3b8" // Slate/Gray
                        strokeWidth={1}
                        strokeDasharray="5 5" // Dashed
                        dot={false}
                        activeDot={{ r: 3, strokeWidth: 0, fill: "#94a3b8" }}
                    />

                    {/* ROI Line (Dynamika zwrotu) */}
                    <Line
                        yAxisId="roi"
                        name="ROI (%)"
                        type="monotone"
                        dataKey="roi"
                        stroke="#6366f1" // Indigo
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0, fill: "#6366f1" }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}
