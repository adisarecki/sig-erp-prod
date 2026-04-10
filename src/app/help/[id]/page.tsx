import { notFound } from "next/navigation"
import Link from "next/link"
import {
    ArrowLeft, BookOpen, Layers, HelpCircle, Terminal, Link2,
    Monitor, AlertTriangle, ArrowRight
} from "lucide-react"
import { getHelpEntry, getRelatedEntries, allHelpEntries } from "@/../../docs/help"
import { FeedbackButton } from "@/components/help/FeedbackButton"
import type { Metadata } from "next"

interface PageProps {
    params: Promise<{ id: string }>
}

export async function generateStaticParams() {
    return allHelpEntries.map(e => ({ id: e.id }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id } = await params
    const entry = getHelpEntry(id)
    if (!entry) return { title: "Nie znaleziono" }
    return {
        title: `${entry.title} | Baza Wiedzy SIG ERP`,
        description: entry.summary
    }
}

const CATEGORY_CONFIG = {
    concept: { label: "Koncepcja Finansowa", Icon: Layers, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200" },
    glossary: { label: "Słownik", Icon: BookOpen, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
    howto: { label: "Poradnik", Icon: HelpCircle, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" }
}

const SOURCE_LABELS: Record<string, string> = {
    ledger: "Centralny Ledger (Prisma)",
    bank: "Wyciąg Bankowy (PKO BP Import)",
    gus: "GUS BIR 1.1 (SOAP/MTOM)",
    ksef: "KSeF MF (REST/JWT)",
    ui: "UI Only (Client State)",
    "mf-whitelist": "Wykaz MF (REST/Public)"
}

export default async function HelpEntryPage({ params }: PageProps) {
    const { id } = await params
    const entry = getHelpEntry(id)

    if (!entry) notFound()

    const config = CATEGORY_CONFIG[entry.category]
    const Icon = config.Icon
    const related = getRelatedEntries(entry.related ?? []).filter(Boolean)
    const depends = getRelatedEntries(entry.dependsOn ?? []).filter(Boolean)

    // Detect if description is still a placeholder
    const isPlaceholder = entry.description.includes("[VISION LAYER]")

    return (
        <div className="max-w-3xl mx-auto space-y-8 py-8 px-4">
            {/* BACK */}
            <Link
                href="/help"
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" /> Wróć do Bazy Wiedzy
            </Link>

            {/* HEADER CARD */}
            <div className={`rounded-3xl border-2 ${config.border} ${config.bg} p-8 space-y-4`}>
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-2xl bg-white border ${config.border} shadow-sm`}>
                            <Icon className={`w-6 h-6 ${config.color}`} />
                        </div>
                        <div>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${config.color}`}>
                                {config.label}
                            </span>
                            {entry.vector && (
                                <span className="ml-2 text-[10px] font-mono text-slate-400">{entry.vector}</span>
                            )}
                        </div>
                    </div>
                    {isPlaceholder && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 border border-amber-300 text-amber-700 text-[10px] font-black uppercase tracking-wider rounded-lg shrink-0">
                            <AlertTriangle className="w-3 h-3" />
                            Vision Layer Pending
                        </span>
                    )}
                </div>

                <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
                    {entry.title}
                </h1>
                <p className="text-lg text-slate-600 font-medium leading-relaxed">
                    {entry.summary}
                </p>
            </div>

            {/* DESCRIPTION */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Opis</h2>
                <div className="text-slate-700 leading-relaxed space-y-3">
                    {entry.description.split(". ").map((sentence, i) => (
                        sentence.trim() ? (
                            <p key={i} className={sentence.includes("[VISION LAYER]") ? "text-slate-400 italic" : ""}>
                                {sentence.trim()}{sentence.endsWith(".") ? "" : "."}
                            </p>
                        ) : null
                    ))}
                </div>
            </div>

            {/* FORMULA */}
            {entry.formula && (
                <div className="bg-slate-900 rounded-2xl p-5 space-y-2">
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                        <Terminal className="w-3.5 h-3.5" />
                        Formuła / Reguła Obliczeniowa
                    </div>
                    <code className="text-indigo-300 font-mono text-sm leading-relaxed block">
                        {entry.formula}
                    </code>
                </div>
            )}

            {/* METADATA GRID */}
            <div className="grid sm:grid-cols-2 gap-4">
                {entry.technicalSource && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Źródło Danych</p>
                        <p className="font-bold text-slate-800 text-sm">{SOURCE_LABELS[entry.technicalSource] ?? entry.technicalSource}</p>
                    </div>
                )}
                {entry.uiTargets && entry.uiTargets.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <Monitor className="w-3 h-3" />
                            Widoczne w UI
                        </div>
                        <ul className="space-y-1">
                            {entry.uiTargets.map((t, i) => (
                                <li key={i} className="text-xs font-mono text-slate-600 bg-white rounded px-2 py-1 border border-slate-100">
                                    {t}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* DEPENDS ON */}
            {depends.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                        <Link2 className="w-4 h-4" /> Zależy od
                    </h2>
                    <div className="grid sm:grid-cols-2 gap-3">
                        {depends.map(dep => dep && (
                            <Link
                                key={dep.id}
                                href={`/help/${dep.id}`}
                                className="flex items-center justify-between gap-2 p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group"
                            >
                                <div>
                                    <p className="font-bold text-sm text-slate-800 group-hover:text-indigo-700 transition-colors">{dep.title}</p>
                                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{dep.summary}</p>
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 shrink-0 transition-colors" />
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* RELATED */}
            {related.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Powiązane Pojęcia</h2>
                    <div className="grid sm:grid-cols-2 gap-3">
                        {related.map(rel => rel && (
                            <Link
                                key={rel.id}
                                href={`/help/${rel.id}`}
                                className="flex items-center justify-between gap-2 p-4 bg-white border border-slate-200 rounded-xl hover:border-emerald-300 hover:bg-emerald-50/50 transition-all group"
                            >
                                <div>
                                    <p className="font-bold text-sm text-slate-800 group-hover:text-emerald-700 transition-colors">{rel.title}</p>
                                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{rel.summary}</p>
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 shrink-0 transition-colors" />
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* FOOTER */}
            <div className="border-t border-slate-100 pt-6 flex items-center justify-between gap-4 flex-wrap">
                <p className="text-xs text-slate-400 max-w-md">
                    Definicja odzwierciedla rzeczywistą logikę silnika finansowego SIG ERP.
                    {isPlaceholder && " Pola [VISION LAYER] czekają na uzupełnienie przez warstwę biznesową."}
                </p>
                <FeedbackButton helpId={id} variant="inline" />
            </div>
        </div>
    )
}
