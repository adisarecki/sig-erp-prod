"use client"

import { useState } from "react"
import { Check, Info, RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { applyContractorUpdate } from "@/app/actions/enrichment"

interface EnrichmentProposalProps {
    notifications: any[]
}

export function EnrichmentProposalWidget({ notifications }: EnrichmentProposalProps) {
    const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({})

    const handleApply = async (id: string) => {
        setLoadingMap(prev => ({ ...prev, [id]: true }))
        try {
            const result = await applyContractorUpdate(id)
            if (result.success) {
                toast.success(result.message)
            } else {
                toast.error(result.error)
            }
        } catch (err) {
            toast.error("Wystąpił błąd podczas aktualizacji.")
        } finally {
            setLoadingMap(prev => ({ ...prev, [id]: false }))
        }
    }

    if (!notifications || notifications.length === 0) return null

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
                <RefreshCw className="w-5 h-5 text-indigo-500" />
                <h3 className="text-sm font-black uppercase tracking-tight text-slate-400">Propozycje Enrichmentu</h3>
            </div>

            {notifications.map((n) => {
                const metadata = n.metadata as any
                const diffs = metadata?.diffs || []
                
                return (
                    <div key={n.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl transition-all hover:border-indigo-500/50">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-white text-sm">{n.title}</p>
                                <p className="text-xs text-slate-500 mt-1">{n.message}</p>
                                
                                <div className="mt-4 space-y-2 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                                    {diffs.map((diff: any, idx: number) => (
                                        <div key={idx} className="text-[11px] grid grid-cols-2 gap-4">
                                            <div>
                                                <span className="text-slate-500 uppercase font-bold block mb-1">Pole: {diff.field}</span>
                                                <span className="text-rose-400 line-through block truncate">{Array.isArray(diff.oldValue) ? diff.oldValue.join(', ') : diff.oldValue}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 uppercase font-bold block mb-1">Nowa wartość</span>
                                                <span className="text-emerald-400 font-bold block truncate">{Array.isArray(diff.newValue) ? diff.newValue.join(', ') : diff.newValue}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <Button 
                                size="sm" 
                                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 px-4 rounded-xl"
                                onClick={() => handleApply(n.id)}
                                disabled={loadingMap[n.id]}
                            >
                                {loadingMap[n.id] ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                                Zatwierdź
                            </Button>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
