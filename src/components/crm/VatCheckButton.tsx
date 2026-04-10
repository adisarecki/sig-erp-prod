"use client"

import { useState } from "react"
import { checkVatStatus, type VatStatus } from "@/app/actions/vat"
import { VatStatusBadge } from "@/components/ui/VatStatusBadge"
import { ShieldCheck, Loader2 } from "lucide-react"

interface VatCheckButtonProps {
    nip: string
}

/**
 * Vector 140: On-demand VAT status check for CRM list rows.
 * Deliberately on-demand (click) to preserve the MF API 100 req/day limit.
 */
export function VatCheckButton({ nip }: VatCheckButtonProps) {
    const [loading, setLoading] = useState(false)
    const [status, setStatus] = useState<VatStatus | null>(null)
    const [accountCount, setAccountCount] = useState<number | null>(null)
    const [checked, setChecked] = useState(false)

    const handleCheck = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (loading || checked) return

        setLoading(true)
        try {
            const result = await checkVatStatus(nip)
            if (result.success) {
                setStatus(result.statusVat)
                setAccountCount(result.accountNumbers.length)
            } else {
                setStatus("Nieznany")
                setAccountCount(0)
            }
            setChecked(true)
        } catch {
            setStatus("Nieznany")
        } finally {
            setLoading(false)
        }
    }

    // After check: show badge
    if (checked && status) {
        return (
            <div className="flex items-center gap-1.5">
                <VatStatusBadge status={status} size="sm" />
                {accountCount !== null && (
                    <span className="text-[9px] font-mono text-slate-400">
                        {accountCount} kont
                    </span>
                )}
            </div>
        )
    }

    // Before check: show trigger button
    return (
        <button
            type="button"
            onClick={handleCheck}
            disabled={loading}
            title="Sprawdź status VAT (Wykaz MF)"
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full border border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all disabled:opacity-50"
        >
            {loading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
                <ShieldCheck className="w-3 h-3" />
            )}
            {loading ? "..." : "VAT"}
        </button>
    )
}
