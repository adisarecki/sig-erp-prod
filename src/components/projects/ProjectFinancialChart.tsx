"use client"

import { useState, useEffect } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, LabelList } from "recharts"

interface ProjectFinancialChartProps {
    budgetEstimated: number
    totalInvoiced: number
    totalCosts: number
}

const formatPln = (value: number) => {
    return new Intl.NumberFormat("pl-PL", {
        style: 'currency',
        currency: 'PLN',
        maximumFractionDigits: 0
    }).format(value)
}

export function ProjectFinancialChart({ budgetEstimated, totalInvoiced, totalCosts }: ProjectFinancialChartProps) {
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        setIsMounted(true)
    }, [])

    const data = [
        { name: "Budżet", kwota: budgetEstimated, color: "#64748b" }, // Slate
        { name: "Przychody", kwota: totalInvoiced, color: "#10b981" }, // Emerald
        { name: "Koszty", kwota: totalCosts, color: "#f43f5e" } // Rose
    ]

    if (!isMounted) return <div className="h-[300px] w-full bg-slate-50 animate-pulse rounded-xl" />

    return (
        <div className="w-full h-[400px] min-h-[400px] mt-4">
            <div className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
                    <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 12, fontWeight: 600, fill: "#475569" }}
                        />
                        <YAxis 
                            tickFormatter={formatPln} 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 11, fill: "#64748b" }}
                        />
                        <Tooltip 
                            formatter={(value: any) => [formatPln(Number(value) || 0), "Kwota"]}
                            cursor={{ fill: '#f1f5f9', opacity: 0.4 }}
                            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="kwota" radius={[6, 6, 0, 0]} barSize={60}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                            <LabelList 
                                dataKey="kwota" 
                                position="top" 
                                formatter={(value: any) => formatPln(Number(value) || 0)} 
                                style={{ fontSize: 11, fontWeight: 700, fill: "#334155" }} 
                            />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
