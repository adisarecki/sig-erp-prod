"use client"

import { useState } from "react"
import { CheckCircle, Search, Split, ArrowRight, X, Save } from "lucide-react"
import Decimal from "decimal.js"
import { reconcileBankTransaction, searchUnpaidInvoices } from "@/app/actions/reconciliation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

interface Suggestion {
    invoiceId: string
    invoiceNumber?: string
    contractorName: string
    amount: string | number | Decimal
    confidence: number
    reason: string
}

interface ReconciliationItem {
    bankTransaction: {
        id: string
        description: string
        rawAmount: string | number | Decimal
        bookingDate: Date
    }
    suggestions: Suggestion[]
}

interface UnpaidInvoice {
    id: string
    externalId: string | null
    amountGross: Decimal | string | number
    contractor: {
        name: string
    }
}

interface ReconciliationWorkbenchProps {
    initialData: ReconciliationItem[]
}

export function ReconciliationWorkbench({ initialData }: ReconciliationWorkbenchProps) {
    const [items, setItems] = useState(initialData)
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [splitModeId, setSplitModeId] = useState<string | null>(null)
    
    // Split State
    const [activeSplits, setActiveSplits] = useState<{ invoiceId: string, name: string, amount: string }[]>([])
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<UnpaidInvoice[]>([])

    const formatCurrency = (val: string | number | Decimal) => {
        const num = new Decimal(String(val)).toNumber()
        return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(num)
    }

    async function handleApprove(itemId: string, invoiceId: string, amount: string) {
        setProcessingId(itemId)
        try {
            await reconcileBankTransaction(itemId, [{ invoiceId, amount }])
            setItems(prev => prev.filter(i => i.bankTransaction.id !== itemId))
        } catch (error) {
            alert(error instanceof Error ? error.message : "Błąd podczas rozliczania.")
        } finally {
            setProcessingId(null)
        }
    }

    async function handleSplitSubmit(itemId: string) {
        setProcessingId(itemId)
        try {
            await reconcileBankTransaction(itemId, activeSplits.map(s => ({ invoiceId: s.invoiceId, amount: s.amount })))
            setItems(prev => prev.filter(i => i.bankTransaction.id !== itemId))
            setSplitModeId(null)
            setActiveSplits([])
        } catch (error) {
            alert(error instanceof Error ? error.message : "Błąd podczas rozliczania.")
        } finally {
            setProcessingId(null)
        }
    }

    async function handleSearch(q: string) {
        setSearchQuery(q)
        if (q.length > 2) {
            const results = await searchUnpaidInvoices(q)
            setSearchResults(results as unknown as UnpaidInvoice[])
        } else {
            setSearchResults([])
        }
    }

    function addToSplit(invoice: UnpaidInvoice) {
        if (activeSplits.some(s => s.invoiceId === invoice.id)) return
        setActiveSplits([...activeSplits, { 
            invoiceId: invoice.id, 
            name: `${invoice.contractor.name} (${invoice.externalId || 'Faktura'})`,
            amount: "0.00" 
        }])
        setSearchResults([])
        setSearchQuery("")
    }

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-20 bg-slate-50 border border-dashed border-slate-200 rounded-3xl text-slate-500">
                <CheckCircle className="w-16 h-16 text-emerald-400 mb-4 opacity-20" />
                <p className="text-xl font-medium">Brak transakcji do rozliczenia.</p>
                <p className="text-sm">Wszystkie wpływy i wydatki są bezpiecznie przypięte w Ledgerze.</p>
            </div>
        )
    }

    return (
        <div className="grid gap-6">
            {items.map((item) => {
                const bt = item.bankTransaction
                const btAmount = new Decimal(String(bt.rawAmount))
                const isIncome = btAmount.gt(0)
                const isSplit = splitModeId === bt.id

                const currentSplitSum = activeSplits.reduce((acc, s) => acc.plus(new Decimal(s.amount || 0)), new Decimal(0))
                const remaining = btAmount.abs().minus(currentSplitSum)

                return (
                    <Card key={bt.id} className={`overflow-hidden transition-all duration-300 rounded-2xl ${isSplit ? 'ring-2 ring-blue-500 shadow-xl' : 'border-slate-200 shadow-sm hover:shadow-md'}`}>
                        <div className="flex flex-col lg:flex-row">
                            {/* BANK SIDE */}
                            <div className={`lg:w-1/3 p-6 border-r border-slate-100 transition-colors ${isSplit ? 'bg-blue-50/50' : 'bg-slate-50'}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <Badge variant="outline" className="bg-white text-slate-500 border-slate-200 uppercase text-[10px] tracking-wider">
                                        Wyciąg Bankowy
                                    </Badge>
                                    {isSplit && (
                                        <Button variant="ghost" size="sm" onClick={() => { setSplitModeId(null); setActiveSplits([]); }} className="h-8 px-2 text-slate-400 hover:text-slate-600">
                                            <X className="w-4 h-4" /> Anuluj
                                        </Button>
                                    )}
                                </div>
                                <p className="text-lg font-bold text-slate-900 leading-tight mb-2">
                                    {bt.description}
                                </p>
                                <div className="flex items-baseline gap-2">
                                    <span className={`text-2xl font-black ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {formatCurrency(bt.rawAmount)}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-4 flex items-center gap-1">
                                    <ArrowRight className="w-3 h-3" /> 
                                    Data księgowania: {new Date(bt.bookingDate).toLocaleDateString('pl-PL')}
                                </p>

                                {isSplit && (
                                    <div className="mt-8 p-4 bg-white border border-blue-100 rounded-xl shadow-inner">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Status Rozliczenia</p>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span>Suma splitów:</span>
                                            <span className="font-mono font-bold">{formatCurrency(currentSplitSum)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-100 text-blue-600">
                                            <span>Pozostało:</span>
                                            <span className="font-mono">{formatCurrency(remaining)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* RECONCILIATION SIDE */}
                            <div className="flex-1 p-6 flex flex-col justify-center bg-white">
                                {!isSplit ? (
                                    <>
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <Split className="w-4 h-4" /> Sugerowane Dopasowania
                                            </h3>
                                            <Button variant="ghost" size="sm" onClick={() => { setSplitModeId(bt.id); setActiveSplits([]); }} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1 font-bold">
                                                <Split className="w-3 h-3" /> Tryb Multi-Split
                                            </Button>
                                        </div>

                                        <div className="space-y-3">
                                            {item.suggestions.length > 0 ? (
                                                item.suggestions.map((s) => (
                                                    <div key={s.invoiceId} className="group relative flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:border-blue-300 hover:bg-blue-50/10 transition-all shadow-sm">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-bold text-slate-900">{s.contractorName}</span>
                                                                {s.confidence >= 0.8 ? (
                                                                    <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200 border font-bold">
                                                                        {Math.round(s.confidence * 100)}% Pewność
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge className="bg-amber-500/10 text-amber-700 border-amber-200 border font-bold">
                                                                        {Math.round(s.confidence * 100)}% Pewność
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-slate-500 mt-1">
                                                                {s.invoiceNumber ? `Faktura nr ${s.invoiceNumber}` : 'Brak nr faktury'} • {s.reason}
                                                            </p>
                                                        </div>
                                                        <div className="text-right mr-6">
                                                            <p className="font-bold text-slate-900">{formatCurrency(s.amount)}</p>
                                                        </div>
                                                        <Button 
                                                            onClick={() => handleApprove(bt.id, s.invoiceId, String(bt.rawAmount))}
                                                            disabled={processingId === bt.id}
                                                            className="bg-slate-900 hover:bg-blue-600 text-white rounded-lg px-4 h-10 transition-colors shadow-lg shadow-slate-100"
                                                        >
                                                            {processingId === bt.id ? "..." : "Zatwierdź"}
                                                        </Button>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-10 border-2 border-dashed border-slate-100 rounded-xl flex flex-col items-center justify-center text-slate-400 gap-3">
                                                    <Search className="w-8 h-8 opacity-20" />
                                                    <p className="text-sm italic">System nie odnalazł pasującej faktury.</p>
                                                    <Button variant="outline" onClick={() => setSplitModeId(bt.id)} className="border-slate-200 text-slate-600">Szukaj ręcznie...</Button>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-bold text-slate-900">Konfiguracja Multi-Split</h3>
                                            <div className="relative w-64">
                                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                                <Input 
                                                    placeholder="Szukaj faktury..." 
                                                    value={searchQuery}
                                                    onChange={(e) => handleSearch(e.target.value)}
                                                    className="pl-9 h-10 border-slate-200 rounded-lg focus:ring-blue-500"
                                                />
                                                {searchResults.length > 0 && (
                                                    <div className="absolute top-11 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto">
                                                        {searchResults.map((inv) => (
                                                            <button 
                                                                key={inv.id} 
                                                                onClick={() => addToSplit(inv)}
                                                                className="w-full text-left p-3 hover:bg-slate-50 border-b border-slate-50 last:border-none flex justify-between items-center"
                                                            >
                                                                <div>
                                                                    <p className="font-bold text-sm text-slate-900">{inv.contractor.name}</p>
                                                                    <p className="text-xs text-slate-500">{inv.externalId}</p>
                                                                </div>
                                                                <p className="font-mono text-xs font-bold">{formatCurrency(inv.amountGross)}</p>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-3 min-h-[100px]">
                                            {activeSplits.length === 0 && <p className="text-center py-8 text-slate-400 italic text-sm">Dodaj fakturę używając wyszukiwarki lub wybierz z sugestii.</p>}
                                            {activeSplits.map((split, idx) => (
                                                <div key={split.invoiceId} className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                                                    <div className="flex-1">
                                                        <p className="font-bold text-slate-900 leading-none">{split.name}</p>
                                                    </div>
                                                    <div className="w-32">
                                                        <Input 
                                                            type="number" 
                                                            step="0.01" 
                                                            value={split.amount}
                                                            onChange={(e) => {
                                                                const newSplits = [...activeSplits]
                                                                newSplits[idx].amount = e.target.value
                                                                setActiveSplits(newSplits)
                                                            }}
                                                            className="h-10 text-right font-mono font-bold"
                                                        />
                                                    </div>
                                                    <Button variant="ghost" size="sm" onClick={() => setActiveSplits(activeSplits.filter(s => s.invoiceId !== split.invoiceId))} className="text-rose-400 hover:text-rose-600">
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
                                            <Button 
                                                onClick={() => handleSplitSubmit(bt.id)}
                                                disabled={processingId === bt.id || activeSplits.length === 0 || !remaining.isZero()}
                                                className="bg-blue-600 hover:bg-blue-700 text-white gap-2 rounded-xl h-12 px-6 shadow-lg shadow-blue-100"
                                            >
                                                <Save className="w-4 h-4" /> 
                                                {processingId === bt.id ? "Przetwarzanie..." : "Zatwierdź Rozliczenie"}
                                            </Button>
                                        </div>
                                        {!remaining.isZero() && activeSplits.length > 0 && (
                                            <p className="text-right text-xs text-rose-500 font-bold">Wymagane rozliczenie pełnej kwoty ({formatCurrency(btAmount.abs())})</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                )
            })}
        </div>
    )
}

