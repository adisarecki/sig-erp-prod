"use client"

import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { Lock, AlertCircle, CheckCircle2, Clock } from "lucide-react"
import { AddRetentionModal } from "./AddRetentionModal"
import { updateRetentionStatus } from "@/app/actions/retentions"
import { useState } from "react"
import Decimal from "decimal.js"

interface RetentionVaultProps {
    retentions: any[]
    projects: any[]
    contractors: any[]
}

export function RetentionVault({ retentions, projects, contractors }: RetentionVaultProps) {
    const [isUpdating, setIsUpdating] = useState<string | null>(null)

    const now = new Date()
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    const formatPln = (value: number) => {
        return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value)
    }

    const handleMarkAsRecovered = async (id: string) => {
        setIsUpdating(id)
        try {
            await updateRetentionStatus(id, "RECOVERED")
        } catch (error) {
            console.error(error)
        } finally {
            setIsUpdating(null)
        }
    }

    const activeRetentions = retentions.filter(r => r.status !== "RECOVERED")
    const totalFrozen = activeRetentions.reduce((sum, r) => sum.plus(new Decimal(r.amount)), new Decimal(0))

    return (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                        <Lock className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Skarbiec Kaucji</h2>
                        <p className="text-xs text-slate-500 font-medium">Środki zamrożone u inwestorów</p>
                    </div>
                </div>
                <AddRetentionModal projects={projects} contractors={contractors} />
            </div>

            <div className="p-6 flex-1 overflow-auto max-h-[400px]">
                {activeRetentions.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <p className="text-sm">Brak aktywnych kaucji w skarbcu.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {activeRetentions.map((ret) => {
                            const expiryDate = new Date(ret.expiryDate)
                            const isExpiringSoon = expiryDate <= thirtyDaysFromNow
                            const isOverdue = expiryDate < now

                            return (
                                <div key={ret.id} className={`p-4 rounded-2xl border transition-all ${isExpiringSoon ? 'border-rose-200 bg-rose-50/30' : 'border-slate-100 bg-white hover:border-slate-300'}`}>
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${ret.type === 'SHORT_TERM' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                                    {ret.type === 'SHORT_TERM' ? 'Krótka' : 'Długa'}
                                                </span>
                                                {isExpiringSoon && (
                                                    <span className="text-[10px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-full animate-pulse uppercase">
                                                        Do Odzyskania
                                                    </span>
                                                )}
                                            </div>
                                            <p className="font-bold text-slate-900 truncate">
                                                {ret.project?.name || ret.description || "Kaucja bez opisu"}
                                            </p>
                                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                                <Clock className="w-3 h-3" />
                                                <span>Wygaśnięcie: {format(expiryDate, 'd MMMM yyyy', { locale: pl })}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-lg font-black ${isExpiringSoon ? 'text-rose-600' : 'text-slate-900'}`}>
                                                {formatPln(Number(ret.amount))}
                                            </p>
                                            <button
                                                onClick={() => handleMarkAsRecovered(ret.id)}
                                                disabled={isUpdating === ret.id}
                                                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors uppercase mt-1 flex items-center justify-end gap-1 ml-auto"
                                            >
                                                {isUpdating === ret.id ? "..." : (
                                                    <>
                                                        <CheckCircle2 className="w-3 h-3" />
                                                        Odzyskaj
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            <div className="p-4 bg-indigo-900 text-white flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-widest opacity-80">Suma Zamrożona</span>
                <span className="text-xl font-black">{formatPln(totalFrozen.toNumber())}</span>
            </div>
        </div>
    )
}
