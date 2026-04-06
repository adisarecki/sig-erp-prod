"use client"

import { useState, useRef, useEffect } from "react"
import { ShieldCheck, ShieldAlert, DownloadCloud, Loader2, Landmark, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay"
import { verifyAndImportBankStatement } from "@/app/actions/finance-verify"
import { BankReconciliationHub } from "@/components/finance/BankReconciliationHub"

interface VerifyBalanceClientProps {
    stagingItems: any[]
    anchorBalance: any
}

export function VerifyBalanceClient({ stagingItems, anchorBalance }: VerifyBalanceClientProps) {
    const [isProcessing, setIsProcessing] = useState(false)
    const [result, setResult] = useState<any>(anchorBalance)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Check for auto-import from QuickActionsBar
    useEffect(() => {
        const pendingCsv = localStorage.getItem("pendingBankCsv")
        if (pendingCsv) {
            localStorage.removeItem("pendingBankCsv")
            setTimeout(() => processCsv(pendingCsv), 500)
        }
    }, [])

    const processCsv = async (content: string) => {
        setIsProcessing(true)
        setResult(null)
        try {
            const res = await verifyAndImportBankStatement(content)
            if (res.success) {
                setResult(res.data)
            } else {
                alert(res.error)
            }
        } catch (err: any) {
            alert("Błąd procesowania pliku.")
        } finally {
            setIsProcessing(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const content = await file.text()
        processCsv(content)
    }

    return (
        <div className="space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
                {/* Action Card: Upload */}
                <Card className="border-2 border-dashed border-indigo-100 bg-indigo-50/30 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                    <CardHeader className="p-8">
                        <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                            <DownloadCloud className="w-6 h-6" />
                        </div>
                        <CardTitle className="text-xl font-bold text-slate-900">Import Wyciągu PKO BP</CardTitle>
                        <CardDescription className="text-slate-600">
                            Wgraj plik CSV z IPKO, aby zsynchronizować księgi i zweryfikować **Kotwicę Salda**.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 pt-0">
                        <input 
                            type="file" 
                            ref={fileInputRef}
                            className="hidden" 
                            accept=".csv"
                            onChange={handleFileUpload}
                        />
                        <Button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isProcessing}
                            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 flex items-center gap-2 transition-all active:scale-95"
                        >
                            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <DownloadCloud className="w-5 h-5" />}
                            {isProcessing ? "Procesowanie..." : "Wybierz plik CSV"}
                        </Button>
                    </CardContent>
                </Card>

                {/* Info Card: Why it matters */}
                <Card className="border-slate-200 bg-white rounded-3xl shadow-sm border-2">
                    <CardHeader className="p-8">
                        <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center mb-4">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <CardTitle className="text-xl font-bold text-slate-900">Zasada Absolutnej Kotwicy</CardTitle>
                        <CardDescription className="text-slate-600">
                            Sytem Sig ERP traktuje saldo fizyczne z banku jako **jedyną prawdę**.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 pt-0 space-y-4">
                        <div className="flex gap-3 text-sm text-slate-600 leading-relaxed italic">
                            <div className="w-1 bg-indigo-100 rounded-full flex-shrink-0" />
                            <p>Import wyciągu automatycznie umieszcza transakcje na strefie zrzutu (Landing Zone). Brakujące operacje zostaną zasugerowane z High Confidence.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Results UI (Success/Discrepancy) */}
            {result && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Card className={`rounded-3xl border-2 shadow-xl ${result.status === 'VERIFIED_STABLE' ? 'border-emerald-100 bg-emerald-50/30' : 'border-rose-100 bg-rose-50/30'}`}>
                        <CardHeader className="p-8 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-2xl font-black italic tracking-tight flex items-center gap-4">
                                    {result.status === 'VERIFIED_STABLE' ? (
                                        <>
                                            <ShieldCheck className="w-8 h-8 text-emerald-600" />
                                            Integralność Potwierdzona
                                        </>
                                    ) : (
                                        <>
                                            <ShieldAlert className="w-8 h-8 text-rose-600" />
                                            Wykryto Rozbieżność!
                                        </>
                                    )}
                                </CardTitle>
                                <CardDescription className="text-slate-600 font-medium">
                                    Wynik porównania ksiąg systemowych z wyciągiem PKO BP.
                                </CardDescription>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Status Systemu</p>
                                <span className={`px-3 py-1 rounded-full text-xs font-black tracking-tight ${result.status === 'VERIFIED_STABLE' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                    {result.status === 'VERIFIED_STABLE' ? "VERIFIED_STABLE" : "DISCREPANCY_ALERT"}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 pt-0">
                            <div className="grid md:grid-cols-3 gap-6">
                                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-2">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Saldo w Systemie</p>
                                    <p className="text-2xl font-black text-slate-900 tracking-tighter">
                                        <CurrencyDisplay gross={result.ledgerSum} />
                                    </p>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-2">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Saldo Bankowe (Anchor)</p>
                                    <p className="text-2xl font-black text-slate-900 tracking-tighter">
                                        <CurrencyDisplay gross={result.physicalBalance} />
                                    </p>
                                </div>
                                <div className={`p-6 rounded-2xl border shadow-sm space-y-2 ${result.delta === 0 ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-rose-600 text-white border-rose-500'}`}>
                                    <p className="text-xs font-bold opacity-80 uppercase tracking-widest">Delta (Różnica)</p>
                                    <p className="text-2xl font-black tracking-tighter">
                                        <CurrencyDisplay gross={result.delta} />
                                    </p>
                                </div>
                            </div>

                            {result.status !== 'VERIFIED_STABLE' && (
                                <div className="mt-8 p-4 bg-rose-100 text-rose-800 rounded-2xl flex items-start gap-4">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-sm">Masz operacje do rozliczenia w Landing Zone.</p>
                                        <p className="text-xs opacity-90 leading-relaxed mt-1">Zakończ dopasowywanie (Auto-Match / Manual Link) w tabeli poniżej. Kiedy Landing Zone będzie pusty, Saldo powinno zostać potwierdzone.</p>
                                    </div>
                                </div>
                            )}

                            {result.status === 'VERIFIED_STABLE' && (
                                <div className="mt-8 p-4 bg-emerald-100 text-emerald-800 rounded-2xl flex items-start gap-4">
                                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-sm">System jest w pełni zsynchronizowany.</p>
                                        <p className="text-xs opacity-90 leading-relaxed mt-1">Status "VERIFIED_STABLE" gwarantuje, że każda złotówka na Ledgerze Systemowym ma swój odpowiednik na koncie fizycznym.</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* VECTOR 120 - TRIAGE UI */}
            <BankReconciliationHub items={stagingItems} />
        </div>
    )
}
