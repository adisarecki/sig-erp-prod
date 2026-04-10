"use client"

import { useState, Suspense, useEffect, useMemo } from "react"
import { parsePkoCsv, ParsedBankTransaction } from "@/lib/pko-parser"
import { parsePkoXml } from "@/lib/pko-xml-parser"
import { importBankStatementV2, importContractors } from "@/app/actions/import"
import { getBankAccounts } from "@/app/actions/bankAccounts"
import { analyzeImportMatches } from "@/app/actions/reconciliation"
import { 
    UploadCloud, CheckCircle2, ChevronLeft, AlertCircle, 
    Loader2, X, Wallet, Building2, Smartphone, 
    Database, CreditCard, ArrowRightLeft, Search, Check
} from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

// ─── Types ──────────────────────────────────────────────────────────────────
type ImportMode = "FINANCE" | "CRM"
type RowAction = "IMPORT_AND_PAY" | "IMPORT_ONLY" | "CREATE_AND_IMPORT" | "SKIP"

interface AnalysisResult {
    id: string
    contractor: { found: boolean, id: string | null, name: string | null, nip: string | null }
    reconciliation: { found: boolean, invoiceId: string | null, invoiceNumber: string | null, confidence: number }
    isNew: boolean
    defaultAction: RowAction
}

// ─── Toast State ────────────────────────────────────────────────────────────
type ToastType = "success" | "error" | "info"
interface Toast { message: string, type: ToastType }

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
function LoadingOverlay({ message }: { message: string }) {
    return (
        <div className="border-2 border-dashed border-blue-300 rounded-2xl p-16 text-center bg-blue-50 animate-pulse">
            <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-blue-100 rounded-full">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                </div>
                <div>
                    <p className="text-xl font-bold text-blue-900">{message}</p>
                    <p className="text-blue-600 text-sm mt-1">Trwa przetwarzanie danych...</p>
                </div>
            </div>
        </div>
    )
}

// ─── Main Component ──────────────────────────────────────────────────────────
function ImportPreviewPageInner() {
    const [importMode, setImportMode] = useState<ImportMode>("FINANCE")
    const [transactions, setTransactions] = useState<ParsedBankTransaction[]>([])
    const [analysis, setAnalysis] = useState<Record<string, AnalysisResult>>({})
    const [decisions, setDecisions] = useState<Record<string, RowAction>>({})
    
    const [isParsing, setIsParsing] = useState(false)
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [toast, setToast] = useState<Toast | null>(null)
    const [fileName, setFileName] = useState("")
    const [bankAccounts, setBankAccounts] = useState<any[]>([])
    const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>("")

    const router = useRouter()
    const searchParams = useSearchParams()
    const returnTo = searchParams.get("returnTo") || "/finanse/reconciliation"

    const showToast = (message: string, type: ToastType) => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 5000)
    }

    // Load bank accounts
    useEffect(() => {
        const fetchAccounts = async () => {
            const res = await getBankAccounts();
            if (res.success && res.data) {
                setBankAccounts(res.data);
                const def = res.data.find(a => a.isDefault) || res.data[0];
                if (def) setSelectedBankAccountId(def.id);
            }
        };
        fetchAccounts();
    }, []);

    // Perform analysis when transactions are loaded
    const performAnalysis = async (parsedTxs: ParsedBankTransaction[]) => {
        setIsAnalyzing(true)
        try {
            const results = await analyzeImportMatches(parsedTxs)
            const analysisMap: Record<string, AnalysisResult> = {}
            const decisionMap: Record<string, RowAction> = {}
            
            results.forEach((res: any) => {
                analysisMap[res.id] = res
                decisionMap[res.id] = res.defaultAction
            })
            
            setAnalysis(analysisMap)
            setDecisions(decisionMap)
        } catch (err) {
            console.error("Analysis failed", err)
            showToast("Błąd analizy dopasowań.", "error")
        } finally {
            setIsAnalyzing(false)
        }
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setFileName(file.name)
        setIsParsing(true)
        setToast(null)
        setTransactions([])

        const reader = new FileReader()
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string
                const isXml = file.name.toLowerCase().endsWith(".xml")
                const parsed = isXml ? parsePkoXml(text) : parsePkoCsv(text)

                if (parsed.length === 0) {
                    showToast("Nie wykryto transakcji w pliku.", "info")
                    setIsParsing(false)
                    return
                }

                setTransactions(parsed)
                await performAnalysis(parsed)
                showToast(`Wczytano ${parsed.length} pozycji.`, "success")
            } catch (err) {
                showToast("Błąd odczytu pliku.", "error")
            } finally {
                setIsParsing(false)
            }
        }
        const encoding = file.name.toLowerCase().endsWith(".xml") ? "UTF-8" : "windows-1250"
        reader.readAsText(file, encoding)
    }

    const handleImport = async () => {
        setIsSaving(true)
        try {
            if (importMode === "CRM") {
                const toSync = transactions
                    .filter(t => decisions[t.id] !== "SKIP")
                    .map(t => ({
                        name: t.contractor.name,
                        nip: t.contractor.nip || null,
                        address: t.contractor.address || null,
                        iban: t.iban || null
                    }))
                
                const res = await importContractors(toSync)
                showToast(`Zsynchronizowano ${res.added} kontrahentów.`, "success")
            } else {
                const payload = transactions.map(t => ({
                    tx: t,
                    action: decisions[t.id],
                    contractorId: analysis[t.id]?.contractor.id,
                    invoiceId: analysis[t.id]?.reconciliation.invoiceId
                }))
                
                const res = await importBankStatementV2(payload, selectedBankAccountId)
                if (res.success && res.results) {
                    showToast(`Zaimportowano: ${res.results.added} | Rozliczono: ${res.results.matched}`, "success")
                } else {
                    showToast(res.error || "Błąd importu.", "error")
                }
            }
            setTimeout(() => router.push(returnTo), 2000)
        } catch (error) {
            showToast("Krytyczny błąd zapisu.", "error")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto pb-20">
            {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

            {/* SubHeader & Control Panel */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                    <Link href={returnTo} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-slate-900">Smart Import Hub</h1>
                        <p className="text-slate-500 mt-1 font-medium italic">Inteligentny wybór: Baza Kontrahentów vs Finanse</p>
                    </div>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
                    <button
                        onClick={() => setImportMode("FINANCE")}
                        className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${importMode === "FINANCE" ? "bg-white text-blue-600 shadow-md" : "text-slate-500 hover:text-slate-700"}`}
                    >
                        <CreditCard className="w-4 h-4" /> Tryb: Finanse
                    </button>
                    <button
                        onClick={() => setImportMode("CRM")}
                        className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${importMode === "CRM" ? "bg-white text-emerald-600 shadow-md" : "text-slate-500 hover:text-slate-700"}`}
                    >
                        <Database className="w-4 h-4" /> Tryb: CRM
                    </button>
                </div>
            </div>

            {/* Status Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border-l-4 border-blue-500 shadow-sm">
                    <p className="text-[10px] font-black uppercase text-slate-400">Wybrany Tryb</p>
                    <p className="text-lg font-bold text-slate-900">{importMode === "FINANCE" ? "Pełne Rozliczenie Finansowe" : "Synchronizacja Bazy Kontrahentów"}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border-l-4 border-slate-900 shadow-sm">
                    <p className="text-[10px] font-black uppercase text-slate-400">Zidentyfikowane Pozycje</p>
                    <p className="text-lg font-bold text-slate-900">{transactions.length || "Oczekiwanie na plik..."}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border-l-4 border-emerald-500 shadow-sm">
                    <p className="text-[10px] font-black uppercase text-slate-400">Analiza AI/Baza</p>
                    <p className="text-lg font-bold text-slate-900">{isAnalyzing ? "W toku..." : fileName ? "Zakończona Sukcesem" : "Brak danych"}</p>
                </div>
            </div>

            {!isParsing && transactions.length === 0 && (
                <div className="border-2 border-dashed border-slate-300 rounded-3xl p-24 text-center bg-white hover:bg-slate-50 transition-all cursor-pointer group shadow-xl">
                    <input type="file" accept=".csv,.xml" id="file-upload" className="hidden" onChange={handleFileUpload} />
                    <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                        <div className="p-8 bg-blue-50 text-blue-600 rounded-3xl mb-8 group-hover:scale-110 transition-transform shadow-inner">
                            <UploadCloud className="w-16 h-16" />
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Wrzuć wyciąg bankowy</h3>
                        <p className="text-slate-500 max-w-xl mx-auto text-lg leading-relaxed font-medium">
                            System automatycznie wykryje firmy w bazie, dopasuje przelewy do otwartych faktur i oznaczy je jako opłacone.
                        </p>
                        <div className="mt-10 px-10 py-5 bg-slate-900 text-white font-black rounded-2xl shadow-2xl hover:bg-black transition-all flex items-center gap-3 active:scale-95">
                            Wybierz plik CSV / XML
                        </div>
                    </label>
                </div>
            )}

            {(isParsing || isAnalyzing) && <LoadingOverlay message={isParsing ? "Analizowanie formatu..." : "Szukanie dopasowań w bazie..."} />}

            {transactions.length > 0 && !isParsing && !isAnalyzing && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col min-h-[500px] animate-in slide-in-from-bottom-4 duration-500">
                    <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-slate-50/50">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                                <ArrowRightLeft className="w-6 h-6 text-slate-900" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 tracking-tight">Match Center & Decisions</h2>
                                <p className="text-sm text-slate-500 font-medium">Podejmij decyzję dla każdej zidentyfikowanej pozycji.</p>
                            </div>
                        </div>

                        {importMode === "FINANCE" && (
                            <div className="flex flex-col gap-1 min-w-[300px]">
                                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest ml-1">Konto docelowe</label>
                                <div className="relative">
                                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <select
                                        value={selectedBankAccountId}
                                        onChange={(e) => setSelectedBankAccountId(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-100 transition-all appearance-none shadow-sm cursor-pointer"
                                    >
                                        <option value="" disabled>Wybierz konto...</option>
                                        {bankAccounts.map(account => (
                                            <option key={account.id} value={account.id}>{account.bankName} (..{account.iban.slice(-4)})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-3 ml-auto">
                            <button onClick={() => setTransactions([])} className="px-6 py-3 font-bold text-sm text-slate-500 hover:text-slate-900 transition-colors">Reset</button>
                            <button
                                onClick={handleImport}
                                disabled={isSaving || (importMode === "FINANCE" && !selectedBankAccountId)}
                                className="bg-slate-900 hover:bg-black text-white px-10 py-4 rounded-xl font-black shadow-xl transition-all disabled:opacity-50 active:scale-95 flex items-center gap-2"
                            >
                                {isSaving ? <><Loader2 className="w-5 h-5 animate-spin" /> Przetwarzanie...</> : <><Check className="w-5 h-5" /> Potwierdź i Wykonaj</>}
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="p-5 border-b border-slate-200 font-black text-slate-400 text-[10px] uppercase tracking-widest">Informacje o przelewie</th>
                                    <th className="p-5 border-b border-slate-200 font-black text-slate-400 text-[10px] uppercase tracking-widest text-center">Status Bazy (CRM)</th>
                                    <th className="p-5 border-b border-slate-200 font-black text-slate-400 text-[10px] uppercase tracking-widest text-center">Analiza Rozliczeń</th>
                                    <th className="p-5 border-b border-slate-200 font-black text-slate-400 text-[10px] uppercase tracking-widest text-right">TWOJA DECYZJA</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {transactions.map((t) => {
                                    const res = analysis[t.id]
                                    const decision = decisions[t.id]
                                    const amount = parseFloat(t.amount)
                                    const isIncome = amount > 0

                                    return (
                                        <tr key={t.id} className={`group hover:bg-slate-50/80 transition-all ${decision === 'SKIP' ? 'opacity-40 grayscale-[0.5]' : ''}`}>
                                            <td className="p-5 max-w-[400px]">
                                                <div className="flex gap-4">
                                                    <div className={`w-1 shadow-inner rounded-full ${isIncome ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-black text-slate-900 text-base">{amount.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN</span>
                                                            <span className="text-[10px] font-bold text-slate-400">{t.date.toLocaleDateString('pl-PL')}</span>
                                                        </div>
                                                        <div className="font-bold text-slate-600 mt-1 uppercase text-[11px] tracking-tight line-clamp-1">{t.contractor.name}</div>
                                                        <div className="text-[10px] text-slate-400 mt-1 italic line-clamp-1 opacity-60 font-medium">{t.description}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="p-5 text-center">
                                                {res?.contractor.found ? (
                                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-black shadow-sm border border-emerald-100">
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> W BAZIE
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-700 rounded-full text-xs font-black shadow-sm border border-rose-100">
                                                        <AlertCircle className="w-3.5 h-3.5" /> NOWY
                                                    </div>
                                                )}
                                            </td>

                                            <td className="p-5 text-center">
                                                {res?.reconciliation.found ? (
                                                    <div className="flex flex-col items-center">
                                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-black shadow-sm border border-blue-100">
                                                            <Smartphone className="w-3.5 h-3.5" /> FAKTURA: {res.reconciliation.invoiceNumber}
                                                        </div>
                                                        <span className="text-[9px] font-bold text-blue-400 mt-1 uppercase tracking-tighter">Dopasowanie: {(res.reconciliation.confidence * 100).toFixed(0)}%</span>
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-500 rounded-full text-xs font-bold opacity-60">
                                                        BRAK FAKTURY
                                                    </div>
                                                )}
                                            </td>

                                            <td className="p-5 text-right">
                                                <select
                                                    value={decision}
                                                    onChange={(e) => setDecisions({ ...decisions, [t.id]: e.target.value as RowAction })}
                                                    className={`px-4 py-2 border rounded-xl text-xs font-black outline-none transition-all cursor-pointer shadow-sm ${
                                                        decision === 'IMPORT_AND_PAY' ? 'bg-blue-600 text-white border-blue-700' :
                                                        decision === 'CREATE_AND_IMPORT' ? 'bg-slate-900 text-white border-black' :
                                                        decision === 'SKIP' ? 'bg-slate-200 text-slate-500 border-slate-300' : 'bg-white text-slate-700 border-slate-200'
                                                    }`}
                                                >
                                                    {res?.reconciliation.found && <option value="IMPORT_AND_PAY">IMPORTUJ I OPŁAĆ</option>}
                                                    {res?.contractor.found && <option value="IMPORT_ONLY">TYLKO IMPORTUJ</option>}
                                                    {!res?.contractor.found && <option value="CREATE_AND_IMPORT">STWÓRZ I IMPORTUJ</option>}
                                                    <option value="SKIP">POMIŃ TEN PRZELEW</option>
                                                </select>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                    
                    <div className="p-8 bg-slate-900 text-white">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                            <div className="flex items-center gap-10">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-white/10 rounded-2xl">
                                        <Wallet className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Suma Wybranych</p>
                                        <p className="text-2xl font-black">
                                            {transactions
                                                .filter(t => decisions[t.id] !== 'SKIP')
                                                .reduce((sum, t) => sum + parseFloat(t.amount), 0)
                                                .toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN
                                        </p>
                                    </div>
                                </div>
                                <div className="h-10 w-px bg-slate-700 hidden md:block" />
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-white/10 rounded-2xl">
                                        <Smartphone className="w-6 h-6 text-emerald-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Auto-Rozliczenia (Faktury)</p>
                                        <p className="text-2xl font-black text-emerald-400">
                                            {transactions.filter(t => decisions[t.id] === 'IMPORT_AND_PAY').length}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center gap-3">
                                <AlertCircle className="w-5 h-5 text-blue-400" />
                                <p className="text-[11px] font-medium text-slate-300 max-w-[300px] leading-snug">
                                    Kliknięcie przycisku wykona seryjne zapisy w bazie SQL i Firestore zgodnie z Twoją decyzją.
                                </p>
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
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-slate-400">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                <p className="text-lg font-bold">Inicjalizacja Match Hub...</p>
            </div>
        }>
            <ImportPreviewPageInner />
        </Suspense>
    )
}
