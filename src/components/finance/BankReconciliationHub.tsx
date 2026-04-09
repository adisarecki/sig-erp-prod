"use client"

import { useState } from "react"
import { Check, Link as LinkIcon, Plus, Loader2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay"
import { confirmAutoMatch, createOnTheFly } from "@/app/actions/finance-reconciliation"

interface StagingItem {
    id: string
    date: Date
    amount: number
    title: string | null
    counterpartyName: string
    status: string
    matchConfidence: number | null
    suggestionId: string | null
    suggestedCategory: string
}

interface BankReconciliationHubProps {
    items: StagingItem[]
}

export function BankReconciliationHub({ items }: BankReconciliationHubProps) {
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [expandedNoise, setExpandedNoise] = useState<string | null>(null)

    // Separate normal items from Noise
    const regularItems = items.filter(item => item.matchConfidence !== 0.2)
    const noiseItems = items.filter(item => item.matchConfidence === 0.2)

    // Group noise items by counterparty
    const noiseGroups = noiseItems.reduce((acc, item) => {
        const key = item.counterpartyName || "Nieznany"
        if (!acc[key]) {
            acc[key] = { items: [], total: 0 }
        }
        acc[key].items.push(item)
        acc[key].total += item.amount
        return acc
    }, {} as Record<string, { items: StagingItem[], total: number }>)

    const handleConfirm = async (item: StagingItem) => {
        if (!item.suggestionId) return;
        setProcessingId(item.id)
        const res = await confirmAutoMatch(item.id, item.suggestionId)
        if (!res.success) {
            alert("Błąd podczas parowania: " + res.error)
        }
        setProcessingId(null)
    }

    const handleCreateOnTheFly = async (item: StagingItem) => {
        setProcessingId(item.id)
        const res = await createOnTheFly(item.id, null, item.suggestedCategory, "DirectExpense")
        if (!res.success) {
            alert("Błąd podczas tworzenia: " + res.error)
        }
        setProcessingId(null)
    }

    if (items.length === 0) {
        return (
            <div className="text-center py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                <Check className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-900">Landing Zone Pusty</h3>
                <p className="text-slate-500">Wszystkie transakcje zostały poprawnie sklasyfikowane i rozliczone.</p>
            </div>
        )
    }

    return (
        <Card className="border-2 shadow-sm rounded-3xl overflow-hidden mt-8">
            <CardHeader className="bg-slate-50 border-b border-slate-100 p-6">
                <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 text-sm">
                        {items.length}
                    </span>
                    Triage UI (Staging Zone)
                </CardTitle>
                <CardDescription className="text-slate-600 font-medium">
                    Zarządzaj niewyjaśnionymi transakcjami z wyciągu bankowego
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-slate-100">
                {/* 1. Mniejsze wydatki (NOISE Filter) */}
                {Object.entries(noiseGroups).map(([counterparty, group]) => (
                    <div key={`noise-${counterparty}`} className="flex flex-col border-l-4 border-slate-300 bg-slate-50">
                        <div 
                            className="p-6 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={() => setExpandedNoise(expandedNoise === counterparty ? null : counterparty)}
                        >
                            <div className="flex items-center gap-3">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700">
                                    Koszty Drobne
                                </span>
                                <div>
                                    <p className="text-base font-bold text-slate-900">{counterparty} <span className="text-slate-500 font-normal text-sm">({group.items.length} operacji)</span></p>
                                    <p className="text-xs text-slate-500">Auto-kategoryzacja: KOSZTY_OGÓLNE</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className={`text-lg font-black ${group.total > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                    <CurrencyDisplay gross={group.total} />
                                </div>
                                <Button size="sm" variant="outline" className="border-slate-300 text-slate-600" onClick={(e) => { e.stopPropagation(); setExpandedNoise(expandedNoise === counterparty ? null : counterparty) }}>
                                    {expandedNoise === counterparty ? 'Zwiń' : 'Rozwiń'}
                                </Button>
                                {/* Bulk Action on Group can go here (e.g. approve all as Koszty Ogolne) */}
                            </div>
                        </div>
                        
                        {expandedNoise === counterparty && (
                            <div className="bg-slate-50 divide-y divide-slate-200 border-t border-slate-200">
                                {group.items.map(item => (
                                    <div key={item.id} className="p-4 pl-12 flex items-center justify-between hover:bg-slate-100/50">
                                        <div className="space-y-1">
                                            <span className="text-xs font-bold text-slate-400">{new Date(item.date).toLocaleDateString()}</span>
                                            <p className="text-sm font-medium text-slate-700">{item.title}</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={`text-md font-bold ${item.amount > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                                <CurrencyDisplay gross={item.amount} />
                                            </span>
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                className="h-8 text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                                onClick={() => handleCreateOnTheFly(item)}
                                                disabled={processingId === item.id}
                                            >
                                                {processingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
                                                On-the-fly
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}

                {/* 2. Regular Triage Items */}
                {regularItems.map((item) => (
                    <div key={item.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-50 transition-colors">
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${item.status === 'SUGGESTED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {item.status}
                                </span>
                                <span className="text-xs font-bold text-slate-400">
                                    {new Date(item.date).toLocaleDateString()}
                                </span>
                            </div>
                            <p className="text-base font-bold text-slate-900">{item.counterpartyName}</p>
                            <p className="text-sm text-slate-500 line-clamp-1">{item.title}</p>
                            
                            {item.status === 'SUGGESTED' && item.matchConfidence && (
                                <p className="text-xs font-bold text-emerald-600 mt-2">
                                    Wykryto dopasowanie ({item.matchConfidence.toFixed(0)}% pewności)
                                </p>
                            )}
                            {item.matchConfidence === 0.1 && (
                                <p className="text-xs font-bold text-indigo-600 mt-2">
                                    Prawdopodobnie koszt operacyjny (Shadow Cost)
                                </p>
                            )}
                        </div>
                        
                        <div className="flex flex-col md:items-end gap-4 min-w-[200px]">
                            <div className={`text-xl font-black ${item.amount > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                <CurrencyDisplay gross={item.amount} />
                            </div>
                            
                            <div className="flex flex-wrap gap-2 justify-end w-full">
                                {item.status === 'SUGGESTED' ? (
                                    <Button 
                                        size="sm" 
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                        onClick={() => handleConfirm(item)}
                                        disabled={processingId === item.id}
                                    >
                                        {processingId === item.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                                        Auto-Match
                                    </Button>
                                ) : (
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                        onClick={() => handleCreateOnTheFly(item)}
                                        disabled={processingId === item.id}
                                    >
                                        {processingId === item.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                                        Create On-the-fly
                                    </Button>
                                )}
                                <Button 
                                    size="sm" 
                                    variant="outline"
                                    className="font-bold border-slate-200"
                                    onClick={() => alert("Wkrótce: Wyszukaj i Powiąż Ręcznie")}
                                >
                                    <LinkIcon className="w-4 h-4 mr-1" /> Link
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}
