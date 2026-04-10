"use client"

import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { Lock, AlertCircle, CheckCircle2, Clock } from "lucide-react"
import { AddRetentionModal } from "./AddRetentionModal"
import { updateRetentionStatus } from "@/app/actions/retentions"
import { useState } from "react"
import Decimal from "decimal.js"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { ExternalLink, FileText, Info, Search } from "lucide-react"
import { HelpLink } from "@/components/ui/HelpLink"

interface RetentionVaultProps {
    retentions: any[]
    projects: { id: string, name: string }[]
    contractors: { id: string, name: string }[]
    invoices?: any[]
}

export function RetentionVault({ retentions, projects, contractors, invoices = [] }: RetentionVaultProps) {
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

    const activeRetentions = retentions.filter(r => r.status !== "RECOVERED" && r.status !== "ESTIMATED")
    const totalFrozen = activeRetentions.reduce((sum, r) => sum.plus(new Decimal(r.amount)), new Decimal(0))

    const getContractorName = (id?: string) => {
        if (!id) return null
        return contractors.find(c => c.id === id)?.name || "Nieznany Inwestor"
    }

    const getProjectName = (id?: string) => {
        if (!id) return null
        return projects.find(p => p.id === id)?.name || "Ogólny"
    }

    const getInvoiceDetails = (invoiceId?: string) => {
        if (!invoiceId) return null
        return invoices.find(inv => inv.id === invoiceId)
    }

    return (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                        <Lock className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Skarbiec Kaucji</h2>
                            <HelpLink helpId="retention-vault" tooltip="Czym jest Skarbiec Kaucji i jak nim zarządzać?" />
                        </div>
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
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1">
                                                    <p className="font-bold text-slate-900 truncate flex items-center gap-1">
                                                        <span className="text-slate-500 font-medium">{getContractorName(ret.contractorId)}</span>
                                                        <span className="text-slate-300 mx-1">|</span>
                                                        <Popover>
                                                            <PopoverTrigger className="hover:text-indigo-600 transition-colors flex items-center gap-1 group bg-transparent border-0 p-0 cursor-pointer">
                                                                <span>{getProjectName(ret.projectId) || ret.description || "Kaucja Bez Nazwy"}</span>
                                                                <Info className="w-3 h-3 text-slate-300 group-hover:text-indigo-400" />
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-80 p-0 rounded-2xl shadow-2xl border-slate-200 overflow-hidden" align="start">
                                                                <div className="bg-indigo-900 p-4 text-white">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <FileText className="w-4 h-4 text-indigo-300" />
                                                                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Szczegóły Audytu</span>
                                                                    </div>
                                                                    <p className="font-bold text-sm leading-tight">
                                                                        {ret.invoiceId ? `Faktura: ${getInvoiceDetails(ret.invoiceId)?.externalId || 'Brak numeru'}` : "Kaucja Projektowa / Ręczna"}
                                                                    </p>
                                                                </div>
                                                                <div className="p-4 space-y-3 bg-white">
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div>
                                                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Źródło</p>
                                                                            <p className="text-xs font-semibold text-slate-700">{ret.source === 'INVOICE' ? 'Faktura VAT' : 'Umowa Projektowa'}</p>
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Kwota Brutto</p>
                                                                            <p className="text-xs font-semibold text-slate-700">{formatPln(Number(ret.amount))}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Opis / Tytułem</p>
                                                                        <p className="text-xs text-slate-600 italic">"{ret.description || 'Brak dodatkowego opisu'}"</p>
                                                                    </div>
                                                                    {ret.invoiceId && (
                                                                        <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                                                                            <span className="text-[10px] text-slate-400">ID: {ret.id.substring(0,8)}...</span>
                                                                            <span className="text-[10px] font-bold text-indigo-600 flex items-center gap-1 cursor-not-allowed opacity-50">
                                                                                Pokaż dokument <ExternalLink className="w-2 h-2" />
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </p>
                                                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                                        <Clock className="w-3 h-3 text-indigo-400" />
                                                        <span className="font-medium">Data Odmrożenia:</span>
                                                        <span className="font-black text-slate-700">{format(expiryDate, 'd MMMM yyyy', { locale: pl })}</span>
                                                    </div>
                                                </div>
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
