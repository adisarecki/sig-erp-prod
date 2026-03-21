"use client"

import { Trash2, ArrowUpRight, ArrowDownRight, Link as LinkIcon, Loader2 } from "lucide-react"
import { assignTransactionToProject, deleteTransaction } from "@/app/actions/transactions"
import { useState } from "react"

interface HistoryItem {
    id: string;
    isInvoice: boolean;
    type: string;
    title: string;
    date: string;
    dueDate?: string | null;
    amount: number;
    projectId?: string | null;
    classification?: string;
    statusBadge: string;
    statusColor: string;
}

interface TransactionHistoryProps {
    transactions: HistoryItem[];
    projectsMap?: Record<string, string>;
    allProjects?: { id: string, name: string }[];
}

export function TransactionHistory({ 
    transactions: initialTransactions,
    projectsMap = {},
    allProjects = []
}: TransactionHistoryProps) {
    const [assigningId, setAssigningId] = useState<string | null>(null)

    const formatPln = (value: number) => {
        return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value)
    }

    const handleDelete = async (id: string, description: string) => {
        if (confirm(`Czy na pewno chcesz usunąć tę transakcję? (${description})\nTej operacji nie da się cofnąć.`)) {
            try {
                await deleteTransaction(id)
            } catch (err: any) {
                alert(err.message || "Błąd podczas usuwania transakcji.")
            }
        }
    }

    const handleAssign = async (transactionId: string, projectId: string) => {
        if (!projectId || projectId === "NONE") return
        
        setAssigningId(transactionId)
        try {
            const result = await assignTransactionToProject(transactionId, projectId)
            if (!result.success) {
                alert(result.error || "Błąd podczas przypisywania do projektu.")
            }
        } catch (err: any) {
            alert(err.message || "Błąd sieci.")
        } finally {
            setAssigningId(null)
        }
    }

    if (initialTransactions.length === 0) {
        return (
            <div className="p-8 text-center text-slate-500">
                Historia transakcji jest pusta. Dodaj swój pierwszy koszt lub przychód firmowy.
            </div>
        )
    }

    return (
        <div className="divide-y divide-slate-100">
            {initialTransactions.map((t) => {
                const isGeneral = t.classification === 'GENERAL_COST' || !t.projectId;
                
                return (
                    <div key={t.id} className="p-4 sm:p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center hover:bg-slate-50 transition-colors group">
                        <div className="flex gap-4 items-center flex-1 min-w-0">
                            <div className={`p-3 rounded-xl flex items-center justify-center shrink-0 ${t.type === 'PRZYCHÓD' ? 'bg-green-100 text-green-600' : 'bg-rose-100 text-rose-600'}`}>
                                {t.type === 'PRZYCHÓD' ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold text-slate-900 text-lg truncate flex items-center gap-2">
                                    {t.title}
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-black tracking-tighter shrink-0 ${t.statusColor}`}>
                                        {t.statusBadge}
                                    </span>
                                    {isGeneral && (
                                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase font-black tracking-tighter shrink-0">
                                            ADMIN / OGÓLNY
                                        </span>
                                    )}
                                </p>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 mt-1">
                                    <span className="font-medium px-2 py-0.5 rounded-md bg-slate-100 whitespace-nowrap">
                                        {new Date(t.date).toLocaleDateString('pl-PL')}
                                    </span>
                                    <span className="hidden sm:inline text-slate-300">•</span>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="shrink-0">Projekt:</span>
                                        {t.projectId ? (
                                            <span className="font-medium text-slate-700 truncate">{projectsMap[t.projectId] || t.projectId}</span>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <span className="italic text-slate-400 shrink-0">Brak przypisania</span>
                                                {!t.isInvoice && (
                                                    assigningId === t.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                                    ) : (
                                                        <select 
                                                            className="text-xs bg-white border border-slate-200 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:border-blue-300 transition-colors"
                                                            onChange={(e) => handleAssign(t.id, e.target.value)}
                                                            defaultValue=""
                                                        >
                                                            <option value="" disabled>Przypisz Projekt...</option>
                                                            {allProjects.map(p => (
                                                                <option key={p.id} value={p.id}>{p.name}</option>
                                                            ))}
                                                        </select>
                                                    )
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-6 mt-4 lg:mt-0 ml-14 lg:ml-0">
                            <div className={`text-xl font-bold whitespace-nowrap ${t.type === 'PRZYCHÓD' ? 'text-green-600' : 'text-slate-900'}`}>
                                {t.type === 'PRZYCHÓD' ? '+' : '-'}{formatPln(Number(t.amount))}
                            </div>
                            {!t.isInvoice && (
                                <button
                                    onClick={() => handleDelete(t.id, t.title)}
                                    className="p-2 text-rose-600 hover:bg-rose-100 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                                    title="Usuń transakcję"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    )
}
