"use client"

import { useState, Suspense } from "react"
import { parsePkoCsv, ParsedBankTransaction } from "@/lib/pko-parser"
import { parsePkoXml } from "@/lib/pko-xml-parser"
import { importBankStatement } from "@/app/actions/import"
import { UploadCloud, CheckCircle2, ChevronLeft, AlertCircle, Loader2, X, Wallet, Building2 } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

// ─── Toast State ────────────────────────────────────────────────────────────
type ToastType = "success" | "error" | "info"
interface Toast {
    message: string
    type: ToastType
}

function Toast({ toast, onClose }: { toast: Toast; onClose: () => void }) {
    const colors: Record<ToastType, string> = {
        success: "bg-emerald-600",
        error: "bg-rose-600",
        info: "bg-blue-600",
    }
    return (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl text-white shadow-2xl shadow-black/20 max-w-sm animate-in slide-in-from-top-2 duration-300 ${colors[toast.type]}`}>
            {toast.type === "success" && <CheckCircle2 className="w-5 h-5 shrink-0" />}
            {toast.type === "error" && <AlertCircle className="w-5 h-5 shrink-0" />}
            <span className="font-medium text-sm">{toast.message}</span>
            <button onClick={onClose} className="ml-auto p-1 hover:bg-white/20 rounded-md transition-colors">
                <X className="w-4 h-4" />
            </button>
        </div>
    )
}

// ─── Loading Overlay ─────────────────────────────────────────────────────────
function LoadingOverlay() {
    return (
        <div className="border-2 border-dashed border-blue-300 rounded-2xl p-16 text-center bg-blue-50 animate-pulse">
            <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-blue-100 rounded-full">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                </div>
                <div>
                    <p className="text-xl font-bold text-blue-900">Analizowanie wyciągu...</p>
                    <p className="text-blue-600 text-sm mt-1">Parser skanuje transakcje i dane kontrahentów (Silent Import)</p>
                </div>
            </div>
        </div>
    )
}

// ─── Main Component ──────────────────────────────────────────────────────────
function ImportPreviewPageInner() {
    const [transactions, setTransactions] = useState<ParsedBankTransaction[]>([])
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [isParsing, setIsParsing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [toast, setToast] = useState<Toast | null>(null)
    const [fileName, setFileName] = useState("")

    const router = useRouter()
    const searchParams = useSearchParams()
    const returnTo = searchParams.get("returnTo") || "/finance/reconciliation"

    const showToast = (message: string, type: ToastType) => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 5000)
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setFileName(file.name)
        setIsParsing(true)
        setToast(null)
        setTransactions([])

        const reader = new FileReader()

        reader.onload = (event) => {
            try {
                const text = event.target?.result as string
                if (!text || text.trim().length === 0) {
                    throw new Error("Plik jest pusty lub nie można go odczytać.")
                }

                const isXml = file.name.toLowerCase().endsWith(".xml")
                const parsed = isXml ? parsePkoXml(text) : parsePkoCsv(text)

                if (parsed.length === 0) {
                    showToast("Nie wykryto żadnych transakcji w pliku. Sprawdź format.", "info")
                    setIsParsing(false)
                    return
                }

                const newSelected = new Set(parsed.map((t) => t.id))
                setTransactions(parsed)
                setSelectedIds(newSelected)
                showToast(`Wczytano ${parsed.length} transakcji.`, "success")
            } catch (err) {
                const isXml = file.name.toLowerCase().endsWith(".xml")
                const msg = isXml
                    ? "Błąd formatu pliku – upewnij się, że to plik camt.053 XML z PKO BP."
                    : "Błąd formatu pliku – upewnij się, że to prawidłowy CSV z PKO BP."
                console.error("[ImportPage] Parse error:", err)
                showToast(msg, "error")
            } finally {
                setIsParsing(false)
            }
        }

        reader.onerror = () => {
            showToast("Nie można odczytać pliku. Spróbuj ponownie.", "error")
            setIsParsing(false)
        }

        const encoding = file.name.toLowerCase().endsWith(".xml") ? "UTF-8" : "windows-1250"
        reader.readAsText(file, encoding)
    }

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setSelectedIds(newSet)
    }

    const handleImport = async () => {
        setIsSaving(true)
        try {
            const toImport = transactions.filter((t) => selectedIds.has(t.id))

            if (toImport.length === 0) {
                showToast("Nie wybrano żadnych transakcji.", "error")
                return
            }

            const res = await importBankStatement(toImport)
            showToast(`Dopisano: ${res.added} | Nowi Kontrahenci: ${res.newContractors} | Pominęto: ${res.skipped}`, "success")

            setTimeout(() => router.push(returnTo), 2500)
        } catch (error: any) {
            console.error(error)
            showToast(error.message || "Krytyczny błąd podczas importu.", "error")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Toast */}
            {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

            {/* Header */}
            <div className="flex items-center gap-4 mb-2">
                <Link href={returnTo} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Silent Bank Import (PKO BP)</h1>
                    <p className="text-slate-500 mt-1">
                        Automatyczne parowanie kontrahentów i import transakcji do <strong>Poczekalni Rozliczeń</strong>.
                    </p>
                </div>
            </div>

            {/* Upload Area */}
            {!isParsing && transactions.length === 0 && (
                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-16 text-center bg-white hover:bg-slate-50 hover:border-slate-400 transition-all cursor-pointer shadow-sm">
                    <input
                        type="file"
                        accept=".csv,.xml"
                        id="file-upload"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={isParsing}
                    />
                    <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                        <div className="p-6 bg-blue-100 text-blue-600 rounded-2xl mb-6 transform transition-transform hover:scale-110">
                            <UploadCloud className="w-12 h-12" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-2">Wraj wyciąg bankowy</h3>
                        <p className="text-slate-500 max-w-lg mx-auto text-lg leading-relaxed">
                            System automatycznie rozpozna firmy, uzupełni dane z bazy (lub stworzy nowe) i przygotuje transakcje do rozliczenia.
                        </p>
                        <div className="mt-8 px-8 py-4 bg-slate-900 hover:bg-black text-white font-bold rounded-2xl transition-all shadow-lg active:scale-95 flex items-center gap-3">
                            <UploadCloud className="w-5 h-5" />
                            Wybierz plik XML / CSV
                        </div>
                        <p className="text-sm text-slate-400 mt-6">Obsługiwane formaty: camt.053 (XML) oraz natywny CSV z PKO BP.</p>
                    </label>
                </div>
            )}

            {isParsing && <LoadingOverlay />}

            {/* Preview Table */}
            {!isParsing && transactions.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-500">
                    <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-slate-50/50">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold text-slate-900">Podgląd Transakcji ({transactions.length})</h2>
                                <span className="px-3 py-1 bg-slate-200 text-slate-600 text-xs font-bold rounded-full">{fileName}</span>
                            </div>
                            <p className="text-sm text-slate-500 mt-1">Zweryfikuj poprawność danych przed importem. Nowi kontrahenci zostaną utworzeni automatycznie.</p>
                        </div>
                        <div className="flex items-center gap-4 w-full lg:w-auto">
                            <button
                                onClick={() => { setTransactions([]); setSelectedIds(new Set()) }}
                                className="flex-1 lg:flex-none px-6 py-3 text-sm font-bold border border-slate-200 rounded-xl text-slate-600 hover:bg-white transition-all shadow-sm"
                            >
                                Anuluj
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={isSaving || selectedIds.size === 0}
                                className="flex-1 lg:flex-none bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg shadow-blue-200 flex items-center justify-center gap-2 min-w-[200px]"
                            >
                                {isSaving
                                    ? <><Loader2 className="w-5 h-5 animate-spin" /> Importowanie...</>
                                    : `Importuj (${selectedIds.size})`}
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="p-4 border-b border-slate-200 w-12 text-center">
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            checked={selectedIds.size === transactions.length && transactions.length > 0}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedIds(new Set(transactions.map((t) => t.id)))
                                                else setSelectedIds(new Set())
                                            }}
                                        />
                                    </th>
                                    <th className="p-4 border-b border-slate-200 font-bold text-slate-600 text-sm">Data</th>
                                    <th className="p-4 border-b border-slate-200 font-bold text-slate-600 text-sm">Kontrahent</th>
                                    <th className="p-4 border-b border-slate-200 font-bold text-slate-600 text-sm">Tytuł przelewu</th>
                                    <th className="p-4 border-b border-slate-200 font-bold text-slate-600 text-sm text-right">Kwota</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {transactions.map((t) => {
                                    const isSelected = selectedIds.has(t.id)
                                    const amount = parseFloat(t.amount)
                                    const isNegative = amount < 0

                                    return (
                                        <tr
                                            key={t.id}
                                            onClick={() => toggleSelection(t.id)}
                                            className={`group cursor-pointer transition-all ${isSelected ? "bg-blue-50/50" : "hover:bg-slate-50"}`}
                                        >
                                            <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelection(t.id)}
                                                />
                                            </td>
                                            <td className="p-4 text-sm text-slate-500 whitespace-nowrap">
                                                {t.date.toLocaleDateString('pl-PL')}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-white transition-colors">
                                                        <Building2 className="w-4 h-4 text-slate-400" />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-900">{t.contractor.name}</div>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            {t.contractor.nip && (
                                                                <span className="text-[10px] font-black tracking-tighter bg-slate-900 text-white px-1.5 py-0.5 rounded">
                                                                    NIP: {t.contractor.nip}
                                                                </span>
                                                            )}
                                                            <span className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">{t.contractor.address}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <p className="text-sm text-slate-600 line-clamp-1 italic" title={t.description}>
                                                    {t.description}
                                                </p>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className={`text-sm font-black ${isNegative ? "text-rose-600" : "text-emerald-600"}`}>
                                                    {isNegative ? "" : "+"}{amount.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                    
                    <div className="p-6 bg-slate-900 text-white">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-white/10 rounded-lg">
                                        <Wallet className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Suma Wybranych</p>
                                        <p className="text-xl font-black">
                                            {transactions
                                                .filter(t => selectedIds.has(t.id))
                                                .reduce((sum, t) => sum + parseFloat(t.amount), 0)
                                                .toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Status Importu</p>
                                <p className="text-sm font-bold text-blue-400">GOTOWY DO PRZETWORZENIA</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Suspense Wrapper ────────────────────────────────────────────────────────
export default function ImportPreviewPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-slate-400 font-sans">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                <p className="text-lg font-bold">Inicjalizacja modułu...</p>
            </div>
        }>
            <ImportPreviewPageInner />
        </Suspense>
    )
}
