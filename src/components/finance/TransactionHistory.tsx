"use client"

import { Trash2, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { deleteTransaction } from "@/app/actions/transactions"

interface Transaction {
    id: string;
    type: string;
    description: string | null;
    category: string;
    transactionDate: string;
    amount: number;
    projectId?: string | null;
}

interface TransactionHistoryProps {
    transactions: Transaction[];
    projectsMap?: Record<string, string>;
}

export function TransactionHistory({ 
    transactions: initialTransactions,
    projectsMap = {}
}: TransactionHistoryProps) {
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

    if (initialTransactions.length === 0) {
        return (
            <div className="p-8 text-center text-slate-500">
                Historia transakcji jest pusta. Dodaj swój pierwszy koszt lub przychód firmowy.
            </div>
        )
    }

    return (
        <div className="divide-y divide-slate-100">
            {initialTransactions.map((t) => (
                <div key={t.id} className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-slate-50 transition-colors group">
                    <div className="flex gap-4 items-center">
                        <div className={`p-3 rounded-xl flex items-center justify-center shrink-0 ${t.type === 'PRZYCHÓD' ? 'bg-green-100 text-green-600' : 'bg-rose-100 text-rose-600'}`}>
                            {t.type === 'PRZYCHÓD' ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
                        </div>
                        <div>
                            <p className="font-semibold text-slate-900 text-lg">
                                {t.description || t.category}
                            </p>
                            <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                                <span className="font-medium px-2 py-0.5 rounded-md bg-slate-100">
                                    {new Date(t.transactionDate).toLocaleDateString('pl-PL')}
                                </span>
                                <span>•</span>
                                <span>Projekt: {t.projectId ? (projectsMap[t.projectId] || t.projectId) : <span className="italic text-slate-400">Ogólne (Brak przypisania)</span>}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-6 mt-4 sm:mt-0">
                        <div className={`text-xl font-bold whitespace-nowrap ${t.type === 'PRZYCHÓD' ? 'text-green-600' : 'text-slate-900'}`}>
                            {t.type === 'PRZYCHÓD' ? '+' : '-'}{formatPln(Number(t.amount))}
                        </div>
                        <button
                            onClick={() => handleDelete(t.id, t.description || t.category)}
                            className="p-2 text-rose-600 hover:bg-rose-100 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                            title="Usuń transakcję"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    )
}
