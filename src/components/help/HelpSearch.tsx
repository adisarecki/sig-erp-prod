"use client"

import { useState, useMemo } from "react"
import { Search, X } from "lucide-react"
import type { HelpEntry } from "@/../../docs/help/glossary"
import Link from "next/link"

interface HelpSearchProps {
    entries: HelpEntry[]
}

const CATEGORY_LABELS: Record<string, string> = {
    concept: "Koncepcja",
    glossary: "Słownik",
    howto: "Poradnik"
}

const CATEGORY_COLORS: Record<string, string> = {
    concept: "bg-indigo-50 text-indigo-700 border-indigo-200",
    glossary: "bg-emerald-50 text-emerald-700 border-emerald-200",
    howto: "bg-amber-50 text-amber-700 border-amber-200"
}

export function HelpSearch({ entries }: HelpSearchProps) {
    const [query, setQuery] = useState("")

    const results = useMemo(() => {
        if (!query.trim()) return []
        const q = query.toLowerCase()
        return entries.filter(e =>
            e.title.toLowerCase().includes(q) ||
            e.summary.toLowerCase().includes(q) ||
            e.id.toLowerCase().includes(q) ||
            (e.vector?.toLowerCase().includes(q))
        )
    }, [query, entries])

    return (
        <div className="relative w-full">
            <div className="flex items-center gap-3 bg-white border-2 border-slate-200 rounded-2xl px-5 py-3 shadow-sm focus-within:border-indigo-400 transition-colors">
                <Search className="w-5 h-5 text-slate-400 shrink-0" />
                <input
                    type="search"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Szukaj definicji, pojęcia lub poradnika..."
                    className="flex-1 bg-transparent outline-none text-slate-800 placeholder:text-slate-400 text-base"
                />
                {query && (
                    <button
                        onClick={() => setQuery("")}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {query && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                    {results.length === 0 ? (
                        <div className="p-6 text-center text-slate-500 text-sm">
                            Brak wyników dla <span className="font-bold text-slate-700">"{query}"</span>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {results.map(entry => (
                                <Link
                                    key={entry.id}
                                    href={`/help/${entry.id}`}
                                    className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group"
                                    onClick={() => setQuery("")}
                                >
                                    <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded border shrink-0 mt-0.5 ${CATEGORY_COLORS[entry.category]}`}>
                                        {CATEGORY_LABELS[entry.category]}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-slate-900 group-hover:text-indigo-700 transition-colors truncate">{entry.title}</p>
                                        <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{entry.summary}</p>
                                    </div>
                                    {entry.vector && (
                                        <span className="text-[10px] font-mono text-slate-400 shrink-0">{entry.vector}</span>
                                    )}
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
