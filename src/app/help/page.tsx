import Link from "next/link"
import { BookOpen, Layers, HelpCircle, ArrowRight, Zap, GitCommit, Clock } from "lucide-react"
import { allHelpEntries, getRecentChangelog } from "@/../../docs/help"
import { HelpSearch } from "@/components/help/HelpSearch"
import { FeedbackButton } from "@/components/help/FeedbackButton"
import type { HelpEntry } from "@/../../docs/help/glossary"

export const metadata = {
    title: "Baza Wiedzy | SIG ERP",
    description: "Centrum definicji, poradników i historii zmian systemu SIG ERP."
}

const CATEGORY_CONFIG: Record<string, {
    label: string
    icon: React.ElementType
    color: string
    border: string
    bg: string
}> = {
    concept: {
        label: "Koncepcje Finansowe",
        icon: Layers,
        color: "text-indigo-700",
        border: "border-indigo-200",
        bg: "bg-indigo-50"
    },
    glossary: {
        label: "Słownik Systemu",
        icon: BookOpen,
        color: "text-emerald-700",
        border: "border-emerald-200",
        bg: "bg-emerald-50"
    },
    howto: {
        label: "Poradniki (How-To)",
        icon: HelpCircle,
        color: "text-amber-700",
        border: "border-amber-200",
        bg: "bg-amber-50"
    }
}

const CHANGE_TYPE_COLORS: Record<string, string> = {
    feature: "bg-emerald-100 text-emerald-700",
    fix: "bg-amber-100 text-amber-700",
    security: "bg-rose-100 text-rose-700",
    breaking: "bg-red-200 text-red-800"
}

const CHANGE_TYPE_LABELS: Record<string, string> = {
    feature: "Nowa funkcja",
    fix: "Naprawa",
    security: "Bezpieczeństwo",
    breaking: "Breaking Change"
}

export default function HelpPage() {
    const changelog = getRecentChangelog(5)

    const grouped = allHelpEntries.reduce((acc, entry) => {
        if (!acc[entry.category]) acc[entry.category] = []
        acc[entry.category].push(entry)
        return acc
    }, {} as Record<string, HelpEntry[]>)

    return (
        <div className="max-w-5xl mx-auto space-y-10 py-8 px-4">
            {/* HEADER */}
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-widest">
                    <Zap className="w-3.5 h-3.5" />
                    <span>SIG ERP — Knowledge Hub</span>
                </div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">Baza Wiedzy Systemu</h1>
                <p className="text-slate-500 text-lg max-w-2xl">
                    Typowane definicje finansowe, poradniki operacyjne i historia techniczna systemu.
                    Wszystkie pojęcia odzwierciedlają rzeczywistą logikę silnika finansowego.
                </p>
            </div>

            {/* SEARCH */}
            <div className="relative z-30">
                <HelpSearch entries={allHelpEntries} />
            </div>

            {/* CATEGORY CARDS */}
            <div className="grid md:grid-cols-3 gap-6">
                {(["concept", "glossary", "howto"] as const).map(cat => {
                    const config = CATEGORY_CONFIG[cat]
                    const Icon = config.icon
                    const entries = grouped[cat] ?? []
                    return (
                        <div key={cat} className={`rounded-2xl border-2 ${config.border} ${config.bg} p-6 space-y-4`}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl bg-white border ${config.border}`}>
                                    <Icon className={`w-5 h-5 ${config.color}`} />
                                </div>
                                <div>
                                    <h2 className={`font-black text-sm uppercase tracking-widest ${config.color}`}>
                                        {config.label}
                                    </h2>
                                    <p className="text-xs text-slate-500">{entries.length} {entries.length === 1 ? "wpis" : "wpisy"}</p>
                                </div>
                            </div>
                            <ul className="space-y-1">
                                {entries.map(entry => (
                                    <li key={entry.id}>
                                        <Link
                                            href={`/help/${entry.id}`}
                                            className={`flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/70 hover:bg-white border border-transparent hover:border-slate-200 transition-all group`}
                                        >
                                            <span className="text-sm font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors truncate">
                                                {entry.title}
                                            </span>
                                            <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-500 shrink-0 transition-colors" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )
                })}
            </div>

            {/* CHANGELOG — last 5, sorted DESC */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <GitCommit className="w-5 h-5 text-slate-500" />
                        <h2 className="text-xl font-black text-slate-900">Historia Zmian (Changelog)</h2>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">ostatnie 5 wpisów</span>
                </div>

                <div className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    {changelog.map((entry, idx) => (
                        <div key={idx} className="p-5 flex gap-5 items-start hover:bg-slate-50 transition-colors">
                            <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
                                <span className="text-[10px] font-mono text-slate-400">{entry.date}</span>
                                <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full ${CHANGE_TYPE_COLORS[entry.type]}`}>
                                    {CHANGE_TYPE_LABELS[entry.type]}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-mono text-indigo-600 font-bold">{entry.vector}</span>
                                    <h3 className="font-bold text-slate-900">{entry.title}</h3>
                                </div>
                                <p className="text-sm text-slate-600 mt-1 leading-relaxed">{entry.description}</p>
                                {entry.relatedHelpIds && entry.relatedHelpIds.length > 0 && (
                                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                        <span className="text-[10px] text-slate-400">Powiązane:</span>
                                        {entry.relatedHelpIds.map(id => (
                                            <Link
                                                key={id}
                                                href={`/help/${id}`}
                                                className="text-[10px] font-mono font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                                            >
                                                {id}
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* FOOTER */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-6">
                <p className="text-xs text-slate-400">
                    Wszystkie definicje odzwierciedlają rzeczywistą logikę silnika finansowego (Ledger SSoT).
                    Brak parsowania Markdown w runtime.
                </p>
                <FeedbackButton variant="inline" />
            </div>
        </div>
    )
}
