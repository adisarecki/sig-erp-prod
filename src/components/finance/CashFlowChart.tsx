"use client"

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts'

interface ChartData {
    date: string
    optymista: number
    realista: number
}

interface CashFlowChartProps {
    data: ChartData[]
}

export function CashFlowChart({ data }: CashFlowChartProps) {
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        setIsMounted(true)
    }, [])

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(value)
    }

    if (!isMounted) return <div className="h-[300px] w-full bg-slate-50 animate-pulse rounded-xl mt-4" />

    return (
        <div className="h-[300px] w-full mt-4 min-w-0 min-h-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis 
                        dataKey="date" 
                        stroke="#64748B" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false}
                    />
                    <YAxis 
                        stroke="#64748B" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(value) => `${value / 1000}k`}
                    />
                    <Tooltip 
                        formatter={(value: any) => formatCurrency(Number(value || 0))}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend verticalAlign="top" height={36}/>
                    <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                    <Line 
                        type="monotone" 
                        dataKey="optymista" 
                        name="Prognoza (Optymista)" 
                        stroke="#10b981" 
                        strokeWidth={4}
                        dot={false}
                        activeDot={{ r: 8 }}
                    />
                    <Line 
                        type="monotone" 
                        dataKey="realista" 
                        name="Realista (-14 dni)" 
                        stroke="#64748B" 
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}
