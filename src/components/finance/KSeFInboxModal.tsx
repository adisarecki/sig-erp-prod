"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
    X, 
    Check, 
    ShieldAlert, 
    Search, 
    Trash2, 
    ArrowUpRight, 
    Calendar, 
    ChevronRight,
    SearchCheck,
    Loader2,
    Database,
    ShieldCheck,
    Wallet
} from "lucide-react"
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay"
import { toast } from "sonner"

interface KSeFInboxModalProps {
    isOpen: boolean
    onClose: () => void
    onImportSuccess?: () => void
}

interface KSeFBufferRecord {
    id: string
    ksefNumber: string
    invoiceNumber: string
    issueDate: string
    counterpartyNip: string
    counterpartyName: string
    netAmount: number
    grossAmount: number
    status: "PENDING" | "ACCEPTED" | "REJECTED"
}

export function KSeFInboxModal({ isOpen, onClose, onImportSuccess }: KSeFInboxModalProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [isSettling, setIsSettling] = useState(false)
    const [invoices, setInvoices] = useState<KSeFBufferRecord[]>([])
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    
    // Filtering / Date Range
    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() - 30) // Default 30 days
        return d.toISOString().split('T')[0]
    })
    const [dateTo, setDateTo] = useState(() => {
        return new Date().toISOString().split('T')[0]
    })

    const fetchInbox = async () => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/ksef/sync?from=${dateFrom}&to=${dateTo}`)
            const data = await res.json()
            if (data.success) {
                setInvoices(data.invoices)
                // Default select all in Inbox
                setSelectedIds(new Set(data.invoices.map((inv: any) => inv.ksefNumber)))
            } else {
                toast.error("Błąd Bramki", { description: data.error })
            }
        } catch (err) {
            toast.error("Błąd sieci", { description: "Nie udało się skomunikować z Inboxem." })
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (isOpen) {
            fetchInbox()
        }
    }, [isOpen])

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setSelectedIds(newSet)
    }

    const toggleAll = () => {
        if (selectedIds.size === invoices.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(invoices.map(i => i.ksefNumber)))
        }
    }

    const handleSettle = async () => {
        if (selectedIds.size === 0) return
        
        setIsSettling(true)
        const toastId = toast.loading("Zaksięgowywanie dokumentów...", {
            description: `Przenoszenie ${selectedIds.size} faktur z Inboxa do Głównej Księgi.`
        })

        try {
            const res = await fetch("/api/ksef/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ksefIds: Array.from(selectedIds) })
            })
            const data = await res.json()

            if (data.success) {
                toast.success("Księgowanie zakończone", {
                    id: toastId,
                    description: data.message
                })
                
                onImportSuccess?.()
                onClose()
            } else {
                toast.error("Błąd Bramki (Settle)", {
                    id: toastId,
                    description: data.error
                })
            }
        } catch (err) {
            toast.error("Błąd krytyczny", {
                id: toastId,
                description: "Nie udało się przenieść dokumentów."
            })
        } finally {
            setIsSettling(false)
        }
    }

    const handleReject = async () => {
        if (selectedIds.size === 0) return
        
        if (!confirm(`Czy na pewno chcesz odrzucić ${selectedIds.size} faktur z Inboxa?`)) {
            return
        }

        try {
            const res = await fetch("/api/ksef/reject", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ksefIds: Array.from(selectedIds) })
            })
            const data = await res.json()
            if (data.success) {
                toast.success(data.message)
                fetchInbox()
            }
        } catch (err) {
            toast.error("Błąd przy odrzucaniu.")
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-5xl bg-white border-none p-0 overflow-hidden rounded-[40px] shadow-2xl">
                <div className="flex flex-col h-[90vh]">
                    {/* Header: Bramka KSeF */}
                    <div className="bg-slate-900 text-white p-10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none rotate-12">
                            <Database className="w-[200px] h-[200px]" />
                        </div>

                        <div className="relative z-10 flex justify-between items-start">
                            <div className="flex items-center gap-6">
                                <div className="p-4 bg-indigo-600 rounded-[28px] shadow-xl shadow-indigo-500/20">
                                    <ShieldCheck className="w-10 h-10 text-white" />
                                </div>
                                <div className="space-y-1">
                                    <h2 className="text-3xl font-black tracking-tighter italic">BRAMKA KSeF INBOX</h2>
                                    <p className="text-indigo-300 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                                        <ShieldCheck className="w-3 h-3" /> Vector 103: Strefa Buforowa Aktywna
                                    </p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-white/10 transition-all text-slate-400">
                                <X className="w-8 h-8" />
                            </Button>
                        </div>

                        <div className="mt-10 flex items-end gap-6 bg-white/5 p-6 rounded-[32px] border border-white/10">
                            <div className="space-y-2 flex-1">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 pl-1">Zakres Płytkiej Synchronizacji (Od)</label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                                    <Input 
                                        type="date" 
                                        value={dateFrom} 
                                        onChange={(e) => setDateFrom(e.target.value)}
                                        className="pl-12 h-14 bg-white/10 border-white/10 rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-white text-lg" 
                                    />
                                </div>
                            </div>
                            <div className="space-y-2 flex-1">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 pl-1">Zakres Płytkiej Synchronizacji (Do)</label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                                    <Input 
                                        type="date" 
                                        value={dateTo} 
                                        onChange={(e) => setDateTo(e.target.value)}
                                        className="pl-12 h-14 bg-white/10 border-white/10 rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-white text-lg" 
                                    />
                                </div>
                            </div>
                            <Button 
                                onClick={fetchInbox} 
                                disabled={isLoading}
                                className="h-14 px-10 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-xl shadow-indigo-600/30 transition-all active:scale-95 flex items-center gap-3"
                            >
                                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Search className="w-6 h-6" /> Sync Inbox</>}
                            </Button>
                        </div>
                    </div>

                    {/* Body: Buffer Records */}
                    <div className="flex-1 overflow-y-auto p-10 bg-slate-50/50 custom-scrollbar">
                        {isLoading ? (
                            <div className="h-full flex flex-col items-center justify-center gap-4 py-20">
                                <Loader2 className="w-16 h-16 text-indigo-500 animate-spin" />
                                <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-xs">Otwieranie bramki MF...</p>
                            </div>
                        ) : invoices.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center gap-6 py-20">
                                <div className="p-10 bg-white rounded-[48px] shadow-sm border border-slate-100">
                                    <ShieldCheck className="w-20 h-20 text-slate-100" />
                                </div>
                                <div className="text-center space-y-2">
                                    <p className="text-2xl font-black text-slate-900 tracking-tight">Bramka KSeF Czysta</p>
                                    <p className="text-sm font-bold text-slate-400 tracking-tight">Wszystkie dokumenty zostały przekierowane do księgi lub odrzucone.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between px-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                            Status PENDING: <span className="text-indigo-600 font-black">{invoices.length} Faktur</span>
                                        </p>
                                    </div>
                                    <button 
                                        onClick={toggleAll}
                                        className="text-xs font-black text-slate-500 hover:text-indigo-600 uppercase tracking-widest transition-colors flex items-center gap-3 group"
                                    >
                                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${selectedIds.size === invoices.length ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300 group-hover:border-indigo-400'}`}>
                                            {selectedIds.size === invoices.length && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                                        </div>
                                        Zaznacz Wszystkie
                                    </button>
                                </div>

                                <div className="grid gap-4">
                                    <AnimatePresence mode="popLayout">
                                        {invoices.map((inv) => (
                                            <motion.div
                                                layout
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                key={inv.ksefNumber}
                                                onClick={() => toggleSelect(inv.ksefNumber)}
                                                className={`group flex items-center gap-8 p-6 bg-white rounded-[32px] border-2 transition-all cursor-pointer select-none ${selectedIds.has(inv.ksefNumber) ? 'border-indigo-500 shadow-2xl shadow-indigo-100' : 'border-slate-50 hover:border-slate-200 shadow-sm'}`}
                                            >
                                                <div className={`w-8 h-8 rounded-[12px] border-2 flex items-center justify-center transition-all ${selectedIds.has(inv.ksefNumber) ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-200' : 'border-slate-200 group-hover:border-indigo-300'}`}>
                                                    {selectedIds.has(inv.ksefNumber) && <Check className="w-5 h-5 text-white" strokeWidth={4} />}
                                                </div>

                                                <div className="flex-1 grid grid-cols-12 gap-6 items-center">
                                                    <div className="col-span-2">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                                            <Calendar className="w-3 h-3" /> Data
                                                        </p>
                                                        <p className="text-base font-black text-slate-900">{new Date(inv.issueDate).toLocaleDateString('pl-PL')}</p>
                                                    </div>
                                                    
                                                    <div className="col-span-5 border-l border-slate-100 pl-6">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">Kontrahent (Dostawca)</p>
                                                        <p className="text-base font-black text-slate-900 truncate tracking-tight">{inv.counterpartyName}</p>
                                                        <p className="text-[11px] font-mono text-slate-500 font-bold bg-slate-50 px-2 py-0.5 rounded-full inline-block mt-1">NIP: {inv.counterpartyNip}</p>
                                                    </div>
 
                                                    <div className="col-span-3 border-l border-slate-100 pl-6">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">Nr Faktury</p>
                                                        <p className="text-base font-bold text-slate-700 truncate tracking-tight">{inv.invoiceNumber}</p>
                                                        <p className="text-[9px] font-mono text-slate-400 truncate tracking-tighter uppercase mt-1">KSeF: {inv.ksefNumber}</p>
                                                    </div>
 
                                                    <div className="col-span-2 text-right">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Brutto</p>
                                                        <p className="text-xl font-black text-slate-900 tracking-tighter">
                                                            {new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(inv.grossAmount)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer: Bramka Actions */}
                    <div className="bg-white p-10 border-t border-slate-100 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] flex items-center justify-between gap-8 rounded-b-[40px]">
                        <div className="flex items-center gap-8">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Oczekujące:</p>
                                <p className="text-3xl font-black text-indigo-600 tracking-tighter italic">{selectedIds.size}</p>
                            </div>
                            {selectedIds.size > 0 && (
                                <Button 
                                    variant="ghost" 
                                    onClick={handleReject}
                                    className="h-14 px-6 text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-black uppercase tracking-widest text-[10px] rounded-2xl"
                                >
                                    <Trash2 className="w-5 h-5 mr-2" />
                                    Odrzuć z Bramki
                                </Button>
                            )}
                        </div>

                        <div className="flex items-center gap-6">
                            <Button 
                                variant="outline" 
                                onClick={onClose}
                                className="h-16 px-10 border-slate-200 text-slate-500 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-50 transition-all"
                                disabled={isSettling}
                            >
                                Anuluj
                            </Button>
                            <Button 
                                onClick={handleSettle}
                                disabled={selectedIds.size === 0 || isSettling}
                                className="h-16 px-14 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-2xl shadow-indigo-600/30 disabled:opacity-50 transition-all active:scale-95 flex items-center gap-4"
                            >
                                {isSettling ? (
                                    <><Loader2 className="w-6 h-6 animate-spin" /> KSIĘGOWANIE...</>
                                ) : (
                                    <><ArrowUpRight className="w-6 h-6" /> Zaksięguj Wybrane</>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
