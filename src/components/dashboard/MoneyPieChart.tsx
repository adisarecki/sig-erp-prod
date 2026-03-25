"use client"

import { useState, useEffect } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"

interface MoneyPieChartProps {
    data: {
        name: string
        value: number
        color: string
    }[]
}

const formatPln = (value: number) => {
    return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(value)
}

const CustomTooltip = ({ active, payload }: { active?: boolean, payload?: unknown[] }) => {
    if (active && payload && payload.length) {
        const payloadData = payload[0] as { name: string, value: number, payload?: { name: string, value: number } };
        const data = payloadData.payload || payloadData;
        return (
            <div className="bg-white p-3 border border-slate-200 shadow-md rounded-lg text-sm">
                <p className="font-semibold text-slate-800">{data.name}</p>
                <p className="text-slate-600 mt-1">{formatPln(data.value)}</p>
            </div>
        )
    }
    return null
}

export function MoneyPieChart({ data }: MoneyPieChartProps) {
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        const frame = requestAnimationFrame(() => setIsMounted(true))
        return () => cancelAnimationFrame(frame)
    }, [])

    // Blokada dla MoneyPieChart - zapobiega błędom width(-1) przed załadowaniem layoutu
    if (!isMounted) {
        return <div className="w-full h-[300px] bg-slate-50/50 animate-pulse rounded-xl" />
    }

    // Jeśli na start firma ma 0 we wszystkich parametrach
    const isDataEmpty = data.every(item => item.value === 0)

    if (isDataEmpty) {
        return (
            <div className="w-full h-[300px] flex items-center justify-center text-slate-400 text-sm italic bg-slate-50/30 rounded-xl">
                Brak danych do analizy kapitału.
            </div>
        )
    }

    return (
        <div className="w-full h-[400px] min-h-[400px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="45%"
                        innerRadius={65}
                        outerRadius={85}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    )
}
