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
    const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({})

    const toggleNoiseDay = (dayKey: string) => {
        setExpandedDays(prev => ({ ...prev, [dayKey]: !prev[dayKey] }))
    }

    const handleConfirm = async (item: StagingItem) => {
        if (!item.suggestionId) return;
        setProcessingId(item.id)
        const res = await confirmAutoMatch(item.id, item.suggestionId)
        if (!res.success) alert("Błąd: " + res.error)
        setProcessingId(null)
    }

    const handleCreateOnTheFly = async (item: StagingItem) => {
        setProcessingId(item.id)
        const res = await createOnTheFly(item.id, null, item.suggestedCategory || "KOSZTY_OGÓLNE", "DirectExpense")
        if (!res.success) alert("Błąd: " + res.error)
        setProcessingId(null)
    }

    if (items.length === 0) {
        return (
            <div className="text-center mt-8 py-16 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200">
                <Check className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-900">Brak Nowych Operacji</h3>
                <p className="text-slate-500">Wszystko jest rozliczone.</p>
            </div>
        )
    }

    // 1. Group by Chronological Date
    const groupedByDate: Record<string, {
        priority: StagingItem[], 
        noise: { items: StagingItem[], total: number }
    }> = {};

    // Sort items chronologically first (newest to oldest)
    const sortedItems = [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const getDayLabel = (d: Date) => {
        const today = new Date();
        const yest = new Date(today); yest.setDate(yest.getDate() - 1);
        const dayStr = d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' });
        
        if (d.toDateString() === today.toDateString()) return "Dzisiaj";
        if (d.toDateString() === yest.toDateString()) return "Wczoraj";
        return dayStr;
    }

    sortedItems.forEach(item => {
        const d = new Date(item.date);
        const dayKey = getDayLabel(d);

        if (!groupedByDate[dayKey]) {
            groupedByDate[dayKey] = { priority: [], noise: { items: [], total: 0 } };
        }

        // Noise definition: < 200 PLN && 20% confidence
        const isNoise = Math.abs(item.amount) < 200 && (item.matchConfidence === null || item.matchConfidence <= 0.2);

        if (isNoise) {
            groupedByDate[dayKey].noise.items.push(item);
            groupedByDate[dayKey].noise.total += item.amount;
        } else {
            groupedByDate[dayKey].priority.push(item);
        }
    });

    const getStatusTag = (item: StagingItem) => {
        if (item.status === 'SUGGESTED') return <span className="bg-emerald-400/10 text-emerald-500 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase border border-emerald-500/20">AUTO_MATCHED</span>;
        return <span className="bg-amber-400/10 text-amber-600 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase border border-amber-500/20">REQUIRES_ACTION</span>;
    }

    return (
        <Card className="border-0 shadow-lg shadow-slate-200/50 rounded-[32px] overflow-hidden mt-8 bg-white">
            <CardHeader className="bg-white border-b border-slate-100 p-8 pb-6">
                <CardTitle className="text-2xl font-black text-slate-900 tracking-tight">Nowe operacje</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                {Object.entries(groupedByDate).map(([dayKey, data]) => (
                    <div key={dayKey} className="border-b border-slate-50 last:border-0 pb-2">
                        {/* Date Header */}
                        <div className="px-8 py-3 bg-slate-50/50">
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{dayKey}</p>
                        </div>

                        {/* Priority Items */}
                        <div className="divide-y divide-slate-100/50">
                            {data.priority.map(item => (
                                <div key={item.id} className="p-4 px-8 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                                    <div className="flex flex-col gap-1 max-w-[60%]">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-base font-bold text-slate-900 truncate leading-none">{item.counterpartyName}</p>
                                            {getStatusTag(item)}
                                        </div>
                                        <p className="text-xs text-slate-400 font-medium truncate flex items-center gap-1">
                                            {new Date(item.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            <span className="text-slate-300">•</span>
                                            {item.title}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-5">
                                        <div className="text-lg font-black tracking-tight">
                                            <CurrencyDisplay gross={item.amount} />
                                        </div>
                                        {item.status === 'SUGGESTED' ? (
                                            <Button size="icon" className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 shadow-md text-white transition-all active:scale-95" disabled={processingId === item.id} onClick={() => handleConfirm(item)}>
                                                {processingId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-5 h-5" />}
                                            </Button>
                                        ) : (
                                            <Button size="icon" className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700" disabled={processingId === item.id} onClick={() => handleCreateOnTheFly(item)}>
                                                {processingId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-5 h-5" />}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Noise Group (Koszty drobne) */}
                        {data.noise.items.length > 0 && (
                            <div className="bg-slate-50 border-t border-b border-slate-100/50">
                                <div 
                                    className="p-4 px-8 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => toggleNoiseDay(dayKey)}
                                >
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-base font-bold text-slate-600">Koszty drobne</p>
                                            <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase">KOSZT DROBNY</span>
                                        </div>
                                        <p className="text-xs text-slate-500 font-medium">Auto-grupowanie: {data.noise.items.length} operacji</p>
                                    </div>
                                    <div className="flex items-center gap-5">
                                        <div className="text-lg font-black tracking-tight">
                                            <CurrencyDisplay gross={data.noise.total} />
                                        </div>
                                        <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full text-slate-400">
                                            <ArrowRight className={`w-5 h-5 transition-transform ${expandedDays[dayKey] ? 'rotate-90' : ''}`} />
                                        </Button>
                                    </div>
                                </div>

                                {expandedDays[dayKey] && (
                                    <div className="divide-y divide-slate-100/50 bg-white border-t border-slate-100">
                                        {data.noise.items.map(item => (
                                            <div key={item.id} className="p-3 px-8 pl-12 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                                <div className="flex flex-col max-w-[60%]">
                                                    <p className="text-sm font-bold text-slate-700 truncate">{item.counterpartyName}</p>
                                                    <p className="text-[10px] text-slate-400 truncate">{item.title}</p>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-sm font-bold">
                                                        <CurrencyDisplay gross={item.amount} />
                                                    </div>
                                                    <Button size="icon" variant="ghost" className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-600" disabled={processingId === item.id} onClick={() => handleCreateOnTheFly(item)}>
                                                        {processingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-4 h-4" />}
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}
