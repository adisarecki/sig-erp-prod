"use client"

import { cn } from "@/lib/utils"
import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react"

interface BankStatusBadgeProps {
    isVerified: boolean | null | undefined
    showLabel?: boolean
    size?: "sm" | "md"
    className?: string
}

export function BankStatusBadge({ isVerified, showLabel = true, size = "sm", className }: BankStatusBadgeProps) {
    if (isVerified === undefined || isVerified === null) {
        return (
            <span
                title="Status weryfikacji nieznany"
                className={cn(
                    "inline-flex items-center gap-1 rounded-full border font-bold uppercase tracking-wider select-none",
                    size === "sm" ? "px-2 py-0.5 text-[9px]" : "px-3 py-1 text-[10px]",
                    "bg-slate-50 text-slate-500 border-slate-200",
                    className
                )}
            >
                <ShieldQuestion className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
                {showLabel && <span>Nieznane</span>}
            </span>
        )
    }

    return (
        <span
            title={isVerified ? "Rachunek znajduje się na Białej Liście MF" : "Rachunek NIE figuruje na Białej Liście MF"}
            className={cn(
                "inline-flex items-center gap-1 rounded-full border font-bold uppercase tracking-wider select-none transition-all duration-300",
                size === "sm" ? "px-2 py-0.5 text-[9px]" : "px-3 py-1 text-[10px]",
                isVerified 
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm shadow-emerald-100" 
                    : "bg-rose-50 text-rose-700 border-rose-200 animate-pulse",
                className
            )}
        >
            {isVerified ? (
                <ShieldCheck className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
            ) : (
                <ShieldAlert className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
            )}
            {showLabel && <span>{isVerified ? "Zweryfikowane" : "BRAK NA BIAŁEJ LIŚCIE"}</span>}
        </span>
    )
}
