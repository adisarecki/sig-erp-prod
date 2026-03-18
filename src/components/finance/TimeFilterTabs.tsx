"use client"

import { Button } from "@/components/ui/button"
import { useRouter, useSearchParams } from "next/navigation"

export function TimeFilterTabs() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const currentFilter = searchParams.get("period") || "ALL"

    const filters = [
        { id: "MONTH", label: "Ten Miesiąc" },
        { id: "QUARTER", label: "Ten Kwartał" },
        { id: "YEAR", label: "Ten Rok" },
        { id: "ALL", label: "Całość" }
    ]

    const handleFilterChange = (id: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("period", id)
        router.push(`?${params.toString()}`)
    }

    return (
        <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
            {filters.map((f) => (
                <Button
                    key={f.id}
                    variant={currentFilter === f.id ? "default" : "ghost"}
                    size="sm"
                    className={`rounded-lg transition-all ${currentFilter === f.id ? 'bg-white text-slate-900 shadow-sm hover:bg-white' : 'text-slate-500'}`}
                    onClick={() => handleFilterChange(f.id)}
                >
                    {f.label}
                </Button>
            ))}
        </div>
    )
}
