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
    Loader2
} from "lucide-react"
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
    DialogFooter
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

interface KSeFMetadata {
    ksefId: string
    invoiceNumber?: string
    issueDate: string
    nip: string
    name: string
    amountNet: number
    amountGross: number
    direction: "INCOME" | "EXPENSE"
}

export function KSeFInboxModal({ isOpen, onClose, onImportSuccess }: KSeFInboxModalProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [invoices, setInvoices] = useState<KSeFMetadata[]>([])
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

    const fetchInvoices = async () => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/ksef/sync?from=${dateFrom}&to=${dateTo}`)
            const data = await res.json()
            if (data.success) {
                setInvoices(data.invoices)
                // Default select all for "Visionary" flow
                setSelectedIds(new Set(data.invoices.map((inv: any) => inv.ksefId)))
            } else {
                toast.error("Błąd pobierania", { description: data.error })
            }
        } catch (err) {
            toast.error("Błąd sieci", { description: "Nie udało się pobrać listy faktur." })
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (isOpen) {
            fetchInvoices()
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
            setSelectedIds(new Set(invoices.map(i => i.ksefId)))
        }
    }

    const handleImport = async () => {
        if (selectedIds.size === 0) return
        
        setIsImporting(true)
        const toastId = toast.loading("Importowanie wybranych faktur...", {
            description: `Trwa procesowanie ${selectedIds.size} dokumentów.`
        })

        try {
            const toImport = invoices.filter(inv => selectedIds.has(inv.ksefId))
            const res = await fetch("/api/ksef/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ invoices: toImport })
            })
            const data = await res.json()

            if (data.success) {
                toast.success("Import zakończony", {
                    id: toastId,
                    description: data.message
                })
                onImportSuccess?.()
                onClose()
            } else {
                toast.error("Błąd importu", {
                    id: toastId,
                    description: data.error
                })
            }
        } catch (err) {
            toast.error("Błąd połączenia", {
                id: toastId,
                description: "Nie udało się zakończyć operacji importu."
            })
        } finally {
            setIsImporting(false)
        }
    }

    const handleReject = async () => {
        if (selectedIds.size === 0) return
        
        if (!confirm(`Czy na pewno chcesz odrzucić ${selectedIds.size} faktur? Nie pojawią się one w kolejnych wyszukiwaniach.`)) {
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
                fetchInvoices() // Refresh the list
            }
        } catch (err) {
            toast.error("Błąd przy odrzucaniu.")
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-5xl bg-slate-50 border-none p-0 overflow-hidden rounded-[32px] shadow-2xl">
                <div className="flex flex-col h-[85vh]">
                    {/* Header: Controls & Search */}
                    <div className="bg-white p-8 border-b border-slate-100 shadow-sm relative z-10">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                                    <SearchCheck className="w-8 h-8" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">KSeF Inbox (Bramka)</h2>
                                    <p className="text-sm font-medium text-slate-500">Decyduj, które koszty wchodzą do systemu.</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-100 transition-all">
                                <X className="w-6 h-6 text-slate-400" />
                            </Button>
                        </div>

                        <div className="flex flex-wrap items-end gap-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-1">Data Wystawienia (Od)</label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input 
                                        type="date" 
                                        value={dateFrom} 
                                        onChange={(e) => setDateFrom(e.target.value)}
                                        className="pl-12 h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700" 
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-1">Data Wystawienia (Do)</label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input 
                                        type="date" 
                                        value={dateTo} 
                                        onChange={(e) => setDateTo(e.target.value)}
                                        className="pl-12 h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700" 
                                    />
                                </div>
                            </div>
                            <Button 
                                onClick={fetchInvoices} 
                                disabled={isLoading}
                                className="h-12 px-8 bg-slate-900 hover:bg-black text-white font-black rounded-xl shadow-lg transition-all active:scale-95"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Search className="w-5 h-5 mr-2" /> Odśwież Metadane</>}
                            </Button>
                        </div>
                    </div>

                    {/* Body: Invoice Table */}
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        {isLoading ? (
                            <div className="h-full flex flex-col items-center justify-center gap-4 py-20">
                                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Pobieranie metadanych z MF...</p>
                            </div>
                        ) : invoices.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center gap-6 py-20">
                                <div className="p-8 bg-white rounded-[40px] shadow-sm border border-slate-100">
                                    <ShieldAlert className="w-16 h-16 text-slate-200" />
                                </div>
                                <div className="text-center">
                                    <p className="text-xl font-bold text-slate-900">Twój Inbox jest pusty</p>
                                    <p className="text-sm text-slate-500 mt-2">Wszystkie dokumenty z tego okresu są już w systemie lub zostały zignorowane.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-4 mb-4">
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                        Wykryto dokumenty: <span className="text-indigo-600">{invoices.length}</span>
                                    </p>
                                    <div className="flex items-center gap-4">
                                        <button 
                                            onClick={toggleAll}
                                            className="text-xs font-black text-slate-500 hover:text-indigo-600 uppercase tracking-widest transition-colors flex items-center gap-2"
                                        >
                                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${selectedIds.size === invoices.length ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                                                {selectedIds.size === invoices.length && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            Zaznacz Wszystkie
                                        </button>
                                    </div>
                                </div>

                                <div className="grid gap-3">
                                    <AnimatePresence mode="popLayout">
                                        {invoices.map((inv) => (
                                            <motion.div
                                                layout
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                key={inv.ksefId}
                                                onClick={() => toggleSelect(inv.ksefId)}
                                                className={`group flex items-center gap-6 p-5 bg-white rounded-[24px] border-2 transition-all cursor-pointer select-none ${selectedIds.has(inv.ksefId) ? 'border-indigo-500 ring-4 ring-indigo-50/50' : 'border-slate-100 hover:border-slate-200 shadow-sm'}`}
                                            >
                                                <div className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${selectedIds.has(inv.ksefId) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                                                    {selectedIds.has(inv.ksefId) && <Check className="w-5 h-5 text-white" strokeWidth={3} />}
                                                </div>

                                                <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                                                    <div className="col-span-2">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Data</p>
                                                        <p className="text-sm font-bold text-slate-900">{new Date(inv.issueDate).toLocaleDateString('pl-PL')}</p>
                                                    </div>
                                                    
                                                    <div className="col-span-5">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Kontrahent</p>
                                                        <p className="text-sm font-black text-slate-900 truncate">{inv.name}</p>
                                                        <p className="text-[10px] font-mono text-slate-500 font-bold">{inv.nip}</p>
                                                    </div>

                                                    <div className="col-span-3">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Numer Faktury</p>
                                                        <p className="text-sm font-bold text-slate-700 truncate">{inv.invoiceNumber || "OCZEKUJE"}</p>
                                                        <p className="text-[9px] font-mono text-slate-400 truncate tracking-tight">{inv.ksefId}</p>
                                                    </div>

                                                    <div className="col-span-2 text-right">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Kwota Brutto</p>
                                                        <CurrencyDisplay 
                                                            gross={inv.amountGross} 
                                                            net={inv.amountNet}
                                                            isIncome={inv.direction === "INCOME"}
                                                            className="text-base font-black text-slate-900" 
                                                        />
                                                    </div>
                                                </div>

                                                <div className="p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <ChevronRight className="w-5 h-5 text-slate-300" />
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer: Multi-Actions */}
                    <div className="bg-white p-8 border-t border-slate-100 flex items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <p className="text-sm font-bold text-slate-700">
                                Wybrano: <span className="text-xl font-black text-indigo-600 ml-1">{selectedIds.size}</span>
                            </p>
                            {selectedIds.size > 0 && (
                                <Button 
                                    variant="ghost" 
                                    onClick={handleReject}
                                    className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-black uppercase tracking-widest text-[10px]"
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Odrzuć i Ukryj
                                </Button>
                            )}
                        </div>

                        <div className="flex items-center gap-4">
                            <Button 
                                variant="outline" 
                                onClick={onClose}
                                className="h-14 px-8 border-slate-200 text-slate-500 font-black uppercase tracking-widest text-xs rounded-2xl"
                                disabled={isImporting}
                            >
                                Anuluj
                            </Button>
                            <Button 
                                onClick={handleImport}
                                disabled={selectedIds.size === 0 || isImporting}
                                className="h-14 px-12 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-indigo-100 disabled:opacity-50 transition-all active:scale-95"
                            >
                                {isImporting ? (
                                    <><Loader2 className="w-5 h-5 mr-3 animate-spin" /> Importowanie...</>
                                ) : (
                                    <><ArrowUpRight className="w-5 h-5 mr-3" /> Importuj Wybrane</>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
