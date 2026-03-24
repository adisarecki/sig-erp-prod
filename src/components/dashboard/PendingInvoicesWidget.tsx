"use client"

import { useState, useEffect } from "react"
import { getClosedProjectsForInvoicing } from "@/app/actions/projects"
import { FileText, ArrowRight, AlertCircle, TrendingUp } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export function PendingInvoicesWidget() {
    const [projects, setProjects] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        async function fetch() {
            const data = await getClosedProjectsForInvoicing()
            setProjects(data)
            setIsLoading(false)
        }
        fetch()
    }, [])

    if (isLoading) return <div className="h-48 bg-slate-50 animate-pulse rounded-3xl" />
    if (projects.length === 0) return null

    return (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-amber-50/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-xl shadow-sm border border-amber-200">
                        <FileText className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Do Zafakturowania</h2>
                        <p className="text-xs text-slate-500 font-medium">Zamknięte projekty z nieopłaconym budżetem</p>
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-3">
                {projects.map((p) => (
                    <div key={p.id} className="p-4 rounded-2xl border border-amber-100 bg-white hover:border-amber-300 transition-all group">
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">Wystaw Fakturę</span>
                                </div>
                                <h3 className="font-bold text-slate-900 truncate">{p.name}</h3>
                                <p className="text-xs text-slate-500 truncate font-medium">{p.contractorName}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-black text-amber-600">
                                    {p.remainingNet.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                                </p>
                                <Link href={`/projects`}>
                                    <button className="text-[10px] font-bold text-slate-400 group-hover:text-amber-600 transition-colors uppercase mt-1 flex items-center justify-end gap-1 ml-auto">
                                        Szczegóły
                                        <ArrowRight className="w-3 h-3" />
                                    </button>
                                </Link>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100">
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-white p-3 rounded-xl border border-slate-200">
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <p className="leading-relaxed">Zamykasz inwestycję, ale w systemie widnieje kwota, której jeszcze nie zafakturowałeś klientowi.</p>
                </div>
            </div>
        </div>
    )
}
