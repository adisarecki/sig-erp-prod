"use client"

import { cn } from "@/lib/utils"
import type { VatStatus } from "@/app/actions/vat"

interface VatStatusBadgeProps {
    status: VatStatus | null | undefined
    showLabel?: boolean
    size?: "sm" | "md"
    className?: string
}

const VAT_CONFIG: Record<VatStatus, { icon: string; label: string; className: string }> = {
    Czynny: {
        icon: "🟢",
        label: "VAT: Czynny",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200"
    },
    Zwolniony: {
        icon: "🟡",
        label: "VAT: Zwolniony",
        className: "bg-amber-50 text-amber-700 border-amber-200"
    },
    Niezarejestrowany: {
        icon: "🔴",
        label: "VAT: Niezarejestrowany",
        className: "bg-rose-50 text-rose-700 border-rose-200"
    },
    Nieznany: {
        icon: "⚪",
        label: "VAT: Nieznany",
        className: "bg-slate-50 text-slate-500 border-slate-200"
    }
}

export function VatStatusBadge({ status, showLabel = true, size = "sm", className }: VatStatusBadgeProps) {
    if (!status) return null

    const config = VAT_CONFIG[status] ?? VAT_CONFIG["Nieznany"]

    return (
        <span
            title={config.label}
            className={cn(
                "inline-flex items-center gap-1 rounded-full border font-bold uppercase tracking-wider select-none",
                size === "sm" ? "px-2 py-0.5 text-[9px]" : "px-3 py-1 text-[10px]",
                config.className,
                className
            )}
        >
            <span>{config.icon}</span>
            {showLabel && <span>{config.label}</span>}
        </span>
    )
}
