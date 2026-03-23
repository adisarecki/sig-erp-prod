"use client"

import { Button } from "@/components/ui/button"
import { useRouter, useSearchParams } from "next/navigation"

export function TimeFilterTabs({ 
    availableYears = [2024, 2025, 2026], 
    currentYear = 2026 
}: { 
    availableYears?: number[], 
    currentYear?: number 
}) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const currentPeriod = searchParams.get("period") || "ALL"

    const filters = [
        { id: "MONTH", label: "Miesiąc" },
        { id: "QUARTER", label: "Kwartał" },
        { id: "YEAR", label: "Rok" },
        { id: "ALL", label: "Całość" }
    ]

    const updateParams = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set(key, value)
        router.push(`?${params.toString()}`)
    }

    return (
        <div className="flex items-center gap-2">
            {/* Selektor Roku (Vector 023) */}
            <select 
                value={currentYear}
                onChange={(e) => updateParams("year", e.target.value)}
                className="bg-slate-100 text-slate-700 text-sm font-bold px-3 py-1.5 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 cursor-pointer outline-none"
            >
                {availableYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                ))}
            </select>

            <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                {filters.map((f) => (
                    <Button
                        key={f.id}
                        variant={currentPeriod === f.id ? "default" : "ghost"}
                        size="sm"
                        className={`rounded-lg transition-all ${currentPeriod === f.id ? 'bg-white text-slate-900 shadow-sm hover:bg-white' : 'text-slate-500'}`}
                        onClick={() => updateParams("period", f.id)}
                    >
                        {f.label}
                    </Button>
                ))}
            </div>
        </div>
    )
}
