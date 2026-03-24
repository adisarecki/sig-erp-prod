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
    ReferenceLine,
    Legend
} from "recharts"

interface ProjectBurnChartProps {
    invoices: { type: string, amountNet: number, amountGross: number, issueDate: string | Date }[]
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

export function ProjectBurnChart({ invoices, budgetEstimated }: ProjectBurnChartProps) {
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        const frame = requestAnimationFrame(() => setIsMounted(true))
        return () => cancelAnimationFrame(frame)
    }, [])

    // 1. Wyciągnięcie tylko dokumentów kosztowych
    const costInvoices = invoices
        .filter((inv) => inv.type === "KOSZT" || inv.type === "EXPENSE" || inv.type === "WYDATEK")
        .sort((a, b) => new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime())

    if (costInvoices.length === 0) {
        return (
            <div className="w-full h-[320px] flex items-center justify-center text-slate-400 text-sm italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Brak zarejestrowanych kosztów. Wykres zasilany danymi po dodaniu pierwszej faktury kosztowej.
            </div>
        )
    }

    // 2. Budowa tabeli narastającej
    const chartData: { date: string, Koszt: number }[] = []
    let currentCumulative = 0
    costInvoices.forEach((inv) => {
        currentCumulative += Number(inv.amountGross || inv.amountNet)
        chartData.push({
            date: typeof inv.issueDate === 'string' ? inv.issueDate : (inv.issueDate as Date).toISOString(),
            Koszt: currentCumulative,
        })
    })

    // Punkt startowy
    if (chartData.length > 0) {
        const firstDate = new Date(chartData[0].date)
        firstDate.setDate(firstDate.getDate() - 2)
        chartData.unshift({
            date: firstDate.toISOString(),
            Koszt: 0,
        })
    }

    const isDanger = budgetEstimated > 0 && currentCumulative > budgetEstimated * 0.85

    if (!isMounted) {
        return <div className="w-full h-[320px] bg-slate-50/50 animate-pulse rounded-xl border border-slate-100" />
    }

    return (
        <div className="w-full h-[320px] min-h-[320px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={20}
                    />
                    <YAxis
                        width={85}
                        tickFormatter={formatPln}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip
                        labelFormatter={(label: unknown) => `Data: ${formatDate(label as string)}`}
                        formatter={(value: unknown) => [
                            `${new Intl.NumberFormat("pl-PL").format(Number(value))} zł`,
                            "Skumulowane koszty"
                        ]}
                        contentStyle={{
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            padding: '12px'
                        }}
                    />
                    <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        formatter={(value) => <span className="text-xs font-medium text-slate-600 ml-1">{value}</span>}
                    />

                    <ReferenceLine
                        y={budgetEstimated}
                        stroke="#ef4444"
                        strokeDasharray="4 4"
                        strokeWidth={2}
                        name="Limit Budżetu"
                    />

                    <Line
                        name="Koszty Rzeczywiste (Brutto)"
                        type="monotone"
                        dataKey="Koszt"
                        stroke={isDanger ? "#ef4444" : "#3b82f6"}
                        strokeWidth={4}
                        dot={false}
                        activeDot={{ r: 6, strokeWidth: 0, fill: isDanger ? "#ef4444" : "#3b82f6" }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}
