"use client"

import { useState } from "react"
import { MessageSquarePlus, Loader2, CheckCircle2, X } from "lucide-react"
import { usePathname } from "next/navigation"

interface FeedbackButtonProps {
    helpId?: string
    /** Position variant */
    variant?: "inline" | "floating"
}

/**
 * Vector 150: Lightweight feedback submission button.
 * POST /api/feedback — stores message + route + optional helpId to DB.
 */
export function FeedbackButton({ helpId, variant = "inline" }: FeedbackButtonProps) {
    const [open, setOpen] = useState(false)
    const [message, setMessage] = useState("")
    const [loading, setLoading] = useState(false)
    const [sent, setSent] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const pathname = usePathname()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!message.trim()) return

        setLoading(true)
        setError(null)

        try {
            const res = await fetch("/api/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: message.trim(),
                    route: pathname,
                    helpId: helpId ?? null
                })
            })

            const json = await res.json()
            if (json.success) {
                setSent(true)
                setMessage("")
                setTimeout(() => { setSent(false); setOpen(false) }, 2500)
            } else {
                setError(json.error || "Błąd wysyłania.")
            }
        } catch {
            setError("Błąd połączenia z serwerem.")
        } finally {
            setLoading(false)
        }
    }

    const triggerCls =
        variant === "floating"
            ? "fixed bottom-6 right-6 z-50 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-3 shadow-lg shadow-indigo-200 transition-all hover:scale-110"
            : "inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider border border-dashed border-slate-300 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={triggerCls}
                title="Zgłoś problem lub sugestię"
            >
                <MessageSquarePlus className="w-4 h-4" />
                {variant === "inline" && <span>Zgłoś problem / sugestię</span>}
            </button>

            {open && (
                <div
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in"
                    onClick={() => setOpen(false)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in slide-in-from-bottom-4"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Zgłoś problem / sugestię</h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Strona: <span className="font-mono text-slate-700">{pathname}</span>
                                    {helpId && <span> • Temat: <span className="font-mono text-indigo-600">{helpId}</span></span>}
                                </p>
                            </div>
                            <button
                                onClick={() => setOpen(false)}
                                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {sent ? (
                            <div className="flex flex-col items-center gap-3 py-6 text-emerald-600">
                                <CheckCircle2 className="w-10 h-10" />
                                <p className="font-bold text-lg">Dziękuję! Zgłoszenie zostało wysłane.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-3">
                                <textarea
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    placeholder="Opisz co nie działa lub co chciałbyś zmienić..."
                                    rows={4}
                                    maxLength={2000}
                                    className="w-full resize-none rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-400"
                                    required
                                    autoFocus
                                />
                                {error && (
                                    <p className="text-xs text-rose-600 font-semibold">{error}</p>
                                )}
                                <div className="flex gap-2 justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setOpen(false)}
                                        className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                    >
                                        Anuluj
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading || !message.trim()}
                                        className="px-5 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                        Wyślij
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-400 text-right">{message.length}/2000</p>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}
