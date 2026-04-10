"use client"

import { Trash2, ArrowUpRight, ArrowDownRight, Link as LinkIcon, Loader2, X, AlertTriangle, FileText, Calendar, Building2, Briefcase, Info, Sparkles, CheckCircle } from "lucide-react"
import { HelpLink } from "@/components/ui/HelpLink"
import { assignTransactionToProject, deleteTransaction } from "../../app/actions/transactions"
import { assignInvoiceToProject, deleteInvoice, markInvoiceAsPaid } from "../../app/actions/invoices"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { InvoicePaymentToggle } from "./InvoicePaymentToggle"
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { mapFinancialValues, FinancialType } from "@/lib/utils/financeMapper"

interface HistoryItem {
    id: string;
    isInvoice: boolean;
    type: string;           // INCOME or EXPENSE
    title: string;          // Main clean title
    documentNumber?: string | null;
    date: string;
    issueDate?: string | null;  // Vector 160: needed for POS detection
    dueDate?: string | null;
    amount: number;
    amountNet?: number;
    projectId?: string | null;
    classification?: string;
    statusBadge: string;
    statusColor: string;
    contractorId?: string;
    contractorName?: string;
    nip?: string | null;
    counterpartyRaw?: string | null;
    matchedContractorId?: string | null;
    tags?: string | null;
    paymentMethod?: string | null;
    reconciliationStatus?: string | null;
}

interface TransactionHistoryProps {
    transactions: HistoryItem[];
    projectsMap?: Record<string, string>;
    allProjects?: { id: string, name: string }[];
}

export function TransactionHistory({ 
    transactions: initialTransactions,
    projectsMap = {},
    allProjects = []
}: TransactionHistoryProps) {
    const [assigningId, setAssigningId] = useState<string | null>(null)
    const [deleteConfirmItem, setDeleteConfirmItem] = useState<HistoryItem | null>(null)
    const [viewingItem, setViewingItem] = useState<HistoryItem | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [payingId, setPayingId] = useState<string | null>(null)
    const router = useRouter()

    const handleQuickPay = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        setPayingId(id)
        try {
            const result = await markInvoiceAsPaid(id)
            if (result.success) {
                router.refresh()
            } else {
                alert(result.error || "Błąd podczas opłacania.")
            }
        } catch (err: any) {
            alert(err.message || "Błąd sieci.")
        } finally {
            setPayingId(null)
        }
    }

    const handleDelete = async () => {
        if (!deleteConfirmItem) return
        
        setIsDeleting(true)
        try {
            let result;
            if (deleteConfirmItem.isInvoice) {
                result = await deleteInvoice(deleteConfirmItem.id)
            } else {
                result = await deleteTransaction(deleteConfirmItem.id)
            }

            if (result.success) {
                setDeleteConfirmItem(null)
                router.refresh()
            } else {
                alert(result.error || "Błąd podczas usuwania.")
            }
        } catch (err: any) {
            alert(err.message || "Błąd sieci.")
        } finally {
            setIsDeleting(false)
        }
    }

    const handleAssign = async (itemId: string, projectId: string, isInvoice: boolean) => {
        if (!projectId) return
        
        setAssigningId(itemId)
        try {
            const result = isInvoice 
                ? await assignInvoiceToProject(itemId, projectId)
                : await assignTransactionToProject(itemId, projectId)

            if (result.success) {
                router.refresh()
            } else {
                alert(result.error || "Błąd podczas przypisywania do projektu.")
            }
        } catch (err: any) {
            alert(err.message || "Błąd sieci.")
        } finally {
            setAssigningId(null)
        }
    }

    if (initialTransactions.length === 0) {
        return (
            <div className="p-8 text-center text-slate-500">
                Historia transakcji jest pusta. Dodaj swój pierwszy koszt lub przychód firmowy.
            </div>
        )
    }

    return (
        <div className="divide-y divide-slate-100">
            {initialTransactions.map((t) => {
                const isIncome = t.type === 'INCOME' || t.type === 'PRZYCHÓD' || t.type === 'SPRZEDAŻ' || t.type === 'REVENUE';
                const dynamicTitle = t.isInvoice 
                    ? (isIncome ? 'Faktura Sprzedaży' : 'Faktura Zakupu')
                    : (t.contractorName || t.title);

                return (
                    <div 
                        key={t.id} 
                        className="p-4 sm:p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                        onClick={() => setViewingItem(t)}
                    >
                        {(() => {
                            const { signedNet, signedGross, netColor, grossColor } = mapFinancialValues(
                                t.amountNet || 0, 
                                (t.amount || 0) - (t.amountNet || 0), 
                                t.type as FinancialType
                            );
                            
                            return (
                                <>
                        <div className="flex gap-4 items-center flex-1 min-w-0 pointer-events-none">
                            <div className={`p-3 rounded-xl flex items-center justify-center shrink-0 ${isIncome ? 'bg-green-100 text-green-600' : 'bg-rose-100 text-rose-600'}`}>
                                {isIncome ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-bold text-slate-900 text-lg truncate uppercase tracking-tight">
                                        {dynamicTitle}
                                    </p>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-black tracking-tighter shrink-0 ${t.statusColor}`}>
                                        {t.statusBadge}
                                    </span>
                                    {t.tags?.split(',').map(tag => (
                                        <Badge key={tag} variant="outline" className="text-[10px] font-black tracking-tighter shrink-0 bg-blue-50 text-blue-700 border-blue-200">
                                            {tag.trim()}
                                        </Badge>
                                    ))}
                                    {t.classification === 'INTERNAL_COST' ? (
                                        <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded uppercase font-black tracking-tighter shrink-0 border border-slate-200">
                                            🔒 [Koszty Własne]
                                        </span>
                                    ) : (t.classification === 'GENERAL_COST' || !t.projectId) && (
                                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase font-black tracking-tighter shrink-0 border border-amber-200">
                                            🏢 [Koszty Ogólne Firmy]
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 mt-0.5">
                                    {t.counterpartyRaw && (
                                        <div className="flex items-center gap-1.5">
                                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                            <span className="font-semibold text-slate-700 truncate max-w-[200px]">
                                                {t.contractorName || t.counterpartyRaw}
                                            </span>
                                        </div>
                                    )}
                                    {t.documentNumber && (
                                        <span className="font-mono text-[11px] text-slate-400 font-medium whitespace-nowrap">
                                            Dok: {t.documentNumber}
                                        </span>
                                    )}
                                    <span className="font-medium px-2 py-0.5 rounded-md bg-slate-100 whitespace-nowrap">
                                        {new Date(t.date).toLocaleDateString('pl-PL')}
                                    </span>
                                    <span className="hidden sm:inline text-slate-300">•</span>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="shrink-0">Projekt:</span>
                                        {t.projectId ? (
                                            <span className="font-medium text-slate-700 truncate">{projectsMap[t.projectId] || t.projectId}</span>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <span className="italic text-slate-400 shrink-0">Brak przypisania</span>
                                                <div className="pointer-events-auto">
                                                    {assigningId === t.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                                    ) : (
                                                        <select 
                                                            className="text-xs bg-white border border-slate-200 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:border-blue-300 transition-colors"
                                                            onChange={(e) => {
                                                                e.stopPropagation();
                                                                handleAssign(t.id, e.target.value, t.isInvoice);
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                            defaultValue=""
                                                        >
                                                            <option value="" disabled>Przypisz Projekt...</option>
                                                            {allProjects.map(p => (
                                                                <option key={p.id} value={p.id}>{p.name}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-6 mt-4 lg:mt-0 ml-14 lg:ml-0 pointer-events-none">
                            <CurrencyDisplay 
                                gross={signedGross.toNumber()}
                                net={signedNet.toNumber()}
                                isIncome={isIncome}
                                className={`text-xl font-bold whitespace-nowrap ${grossColor}`}
                            />
                            <div className="pointer-events-auto flex items-center gap-1">
                                {t.isInvoice && t.statusBadge !== "OPŁACONA" && (
                                    <button
                                        onClick={(e) => handleQuickPay(e, t.id)}
                                        disabled={payingId === t.id}
                                        className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all hover:scale-110 disabled:opacity-50"
                                        title="Oznacz jako opłacone"
                                    >
                                        {payingId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                    </button>
                                )}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteConfirmItem(t);
                                    }}
                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-100 rounded-lg transition-all hover:scale-110"
                                    title="Usuń dokument"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                                </>
                            );
                        })()}
                    </div>
                );
            })}

            {/* GRAND TOTAL SUMMARY FOOTER */}
            <div className="bg-slate-900 text-white p-6 sm:px-10 flex flex-col md:flex-row justify-between items-center gap-6 border-t border-slate-800 shadow-2xl relative z-10">
                <div className="flex flex-col sm:flex-row gap-6 sm:gap-12 w-full md:w-auto">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Suma Przychodów (INCOME)</p>
                        <div className="flex items-baseline gap-2">
                            <CurrencyDisplay 
                                gross={initialTransactions.reduce((acc, t) => (t.type === 'INCOME' || t.type === 'PRZYCHÓD' || t.type === 'SPRZEDAŻ' || t.type === 'REVENUE') ? acc + t.amount : acc, 0)} 
                                isIncome={true} 
                                className="text-xl font-black text-green-400" 
                            />
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                Netto: {initialTransactions.reduce((acc, t) => (t.type === 'INCOME' || t.type === 'PRZYCHÓD' || t.type === 'SPRZEDAŻ' || t.type === 'REVENUE') ? acc + (t.amountNet || 0) : acc, 0).toFixed(2)}
                            </p>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Suma Kosztów (EXPENSE)</p>
                        <div className="flex items-baseline gap-2">
                            <CurrencyDisplay 
                                gross={initialTransactions.reduce((acc, t) => (t.type === 'EXPENSE' || t.type === 'KOSZT') ? acc + t.amount : acc, 0)} 
                                isIncome={false} 
                                className="text-xl font-black text-rose-400" 
                            />
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                Netto: {initialTransactions.reduce((acc, t) => (t.type === 'EXPENSE' || t.type === 'KOSZT') ? acc + (t.amountNet || 0) : acc, 0).toFixed(2)}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800/50 p-4 px-6 rounded-2xl border border-white/5 flex flex-col items-center sm:items-end w-full md:w-auto">
                    <p className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em] mb-1">Saldo Końcowe (Safe to Spend)</p>
                    <div className="flex items-baseline gap-3">
                        <CurrencyDisplay 
                            gross={initialTransactions.reduce((acc, t) => (t.type === 'INCOME' || t.type === 'PRZYCHÓD' || t.type === 'SPRZEDAŻ' || t.type === 'REVENUE') ? acc + t.amount : acc - t.amount, 0)} 
                            isIncome={initialTransactions.reduce((acc, t) => (t.type === 'INCOME' || t.type === 'PRZYCHÓD' || t.type === 'SPRZEDAŻ' || t.type === 'REVENUE') ? acc + t.amount : acc - t.amount, 0) >= 0}
                            className={`text-3xl font-black tracking-tighter ${
                                initialTransactions.reduce((acc, t) => (t.type === 'INCOME' || t.type === 'PRZYCHÓD' || t.type === 'SPRZEDAŻ' || t.type === 'REVENUE') ? acc + t.amount : acc - t.amount, 0) >= 0 
                                ? 'text-white' 
                                : 'text-rose-400'
                            }`} 
                        />
                    </div>
                    <p className="text-[11px] text-slate-400 font-bold mt-1">
                        Zysk Netto: {initialTransactions.reduce((acc, t) => (t.type === 'INCOME' || t.type === 'PRZYCHÓD' || t.type === 'SPRZEDAŻ' || t.type === 'REVENUE') ? acc + (t.amountNet || 0) : acc - (t.amountNet || 0), 0).toFixed(2)} PLN
                    </p>
                </div>
            </div>

            {/* SAFE DELETE MODAL ... existing Dialogs ... */}
            <Dialog open={!!deleteConfirmItem} onOpenChange={(open) => !open && setDeleteConfirmItem(null)}>
                <DialogContent className="sm:max-w-[425px] border-rose-100">
                    <DialogHeader className="space-y-3">
                        <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mb-2">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <DialogTitle className="text-xl font-bold text-slate-900">
                            Bezpieczne Usuwanie (Safe Delete)
                        </DialogTitle>
                        <DialogDescription className="text-slate-600 font-medium text-base">
                            Czy na pewno chcesz usunąć dokument <span className="text-rose-600 font-bold">{deleteConfirmItem?.title}</span>?
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4 bg-rose-50 p-4 rounded-xl border border-rose-100 text-sm text-rose-800 leading-relaxed">
                        <p className="font-bold flex items-center gap-2 mb-1">
                            <Info className="w-4 h-4" /> OSTRZEŻENIE:
                        </p>
                        Tej operacji nie można cofnąć, a statystyki finansowe zostaną natychmiast zaktualizowane. 
                        Wszystkie powiązane zapisy księgowe zostaną usunięte z bazy danych.
                    </div>

                    <DialogFooter className="mt-6 flex gap-2">
                        <Button variant="outline" onClick={() => setDeleteConfirmItem(null)} className="flex-1">
                            Anuluj
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={handleDelete} 
                            disabled={isDeleting}
                            className="flex-1 font-bold shadow-lg shadow-rose-200"
                        >
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                            USUŃ NA ZAWSZE
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!viewingItem} onOpenChange={(open) => !open && setViewingItem(null)}>
                <DialogContent className="sm:max-w-[550px] overflow-hidden p-0 rounded-2xl border-none shadow-2xl">
                    <div className={`h-2 ${viewingItem && (viewingItem.type === 'INCOME' || viewingItem.type === 'PRZYCHÓD' || viewingItem.type === 'SPRZEDAŻ' || viewingItem.type === 'REVENUE') ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    
                    <div className="p-6 pt-8 space-y-6">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <Badge variant="outline" className={`uppercase font-black text-[10px] tracking-widest ${viewingItem?.statusColor} border-none px-0`}>
                                    {viewingItem?.statusBadge}
                                </Badge>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight uppercase">
                                    {(viewingItem?.isInvoice ? ( (viewingItem.type === 'INCOME' || viewingItem.type === 'PRZYCHÓD' || viewingItem.type === 'SPRZEDAŻ' || viewingItem.type === 'REVENUE') ? 'Faktura Sprzedaży' : 'Faktura Zakupu') : (viewingItem?.title))}
                                </h3>
                                <p className="text-slate-500 font-mono text-xs">
                                    ID: {viewingItem?.id}
                                </p>
                            </div>
                            <div className="text-right">
                                <CurrencyDisplay 
                                    gross={(() => {
                                        const m = mapFinancialValues(viewingItem?.amountNet || 0, (viewingItem?.amount || 0) - (viewingItem?.amountNet || 0), viewingItem?.type as FinancialType);
                                        return m.signedGross.toNumber();
                                    })()}
                                    net={(() => {
                                        const m = mapFinancialValues(viewingItem?.amountNet || 0, (viewingItem?.amount || 0) - (viewingItem?.amountNet || 0), viewingItem?.type as FinancialType);
                                        return m.signedNet.toNumber();
                                    })()}
                                    isIncome={viewingItem && (viewingItem.type === 'INCOME' || viewingItem.type === 'PRZYCHÓD' || viewingItem.type === 'SPRZEDAŻ' || viewingItem.type === 'REVENUE') ? true : false}
                                    className={`text-2xl font-black ${(() => {
                                        const m = mapFinancialValues(viewingItem?.amountNet || 0, (viewingItem?.amount || 0) - (viewingItem?.amountNet || 0), viewingItem?.type as FinancialType);
                                        return m.grossColor;
                                    })()}`}
                                />
                                {viewingItem?.amountNet && (
                                    <p className="text-xs text-slate-400 font-medium">Baza netto: {viewingItem.amountNet.toFixed(2)} PLN</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-4 rounded-xl space-y-1 border border-slate-100">
                                <Label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5 grayscale opacity-70">
                                    <Building2 className="w-3 h-3" /> Kontrahent
                                </Label>
                                <p className="font-bold text-slate-800 text-sm truncate">{viewingItem?.contractorName || viewingItem?.counterpartyRaw || 'Brak danych'}</p>
                                {viewingItem?.nip && (
                                    <p className="font-mono text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border self-start inline-block">NIP: {viewingItem.nip}</p>
                                )}
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl space-y-1 border border-slate-100">
                                <Label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5 grayscale opacity-70">
                                    <Calendar className="w-3 h-3" /> Daty Dokumentu
                                </Label>
                                <div className="space-y-0.5">
                                    <p className="text-xs font-medium text-slate-700">Wystawiono: {viewingItem?.date ? new Date(viewingItem.date).toLocaleDateString('pl-PL') : '-'}</p>
                                    {viewingItem?.dueDate && (
                                        <p className="text-xs font-bold text-rose-600">Termin: {new Date(viewingItem.dueDate).toLocaleDateString('pl-PL')}</p>
                                    )}
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl space-y-1 border border-slate-100 col-span-2">
                                <Label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5 grayscale opacity-70">
                                    <Briefcase className="w-3 h-3" /> Projekt i Klasyfikacja
                                </Label>
                                <div className="flex items-center gap-2">
                                    <p className="font-bold text-slate-800 text-sm">
                                        {viewingItem?.projectId ? (projectsMap[viewingItem.projectId] || viewingItem.projectId) : 'KOSZTY OGÓLNE FIRMY'}
                                    </p>
                                    {viewingItem?.projectId && (
                                        <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 text-[9px] font-bold">PROJEKTOWY</Badge>
                                    )}
                                </div>
                            </div>
                        </div>

                        {viewingItem?.documentNumber && (
                            <div className="flex items-center gap-3 p-4 border-2 border-dashed border-slate-100 rounded-xl bg-white shadow-sm">
                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] uppercase font-bold text-slate-400">Numer Dokumentu</p>
                                    <p className="font-mono font-bold text-slate-800">{viewingItem.documentNumber}</p>
                                </div>
                                <Sparkles className="w-5 h-5 text-emerald-500 opacity-20" />
                            </div>
                        )}

                {viewingItem?.isInvoice && (
                    <div className="pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-2 mb-3">
                            <Label className="text-[10px] uppercase font-bold text-slate-400">
                                Kontrola Płatności (Bank Authority)
                            </Label>
                            <HelpLink helpId="invoice-status" tooltip="Jak działają statusy płatności i weryfikacja bankowa?" size="xs" />
                        </div>
                        <InvoicePaymentToggle 
                            invoiceId={viewingItem.id}
                            initialPaymentStatus={viewingItem.statusBadge === 'OPŁACONA' ? 'PAID' : 'UNPAID'}
                            initialReconciliationStatus={viewingItem.reconciliationStatus || 'PENDING'}
                            initialPaymentMethod={viewingItem.paymentMethod || 'BANK_TRANSFER'}
                            isPosPayment={
                                // Vector 160: detect POS — issueDate === dueDate
                                !!(viewingItem.issueDate && viewingItem.dueDate &&
                                    viewingItem.issueDate.split('T')[0] === viewingItem.dueDate.split('T')[0])
                            }
                        />
                    </div>
                )}
                    </div>

                    <DialogFooter className="bg-slate-50 p-4 mt-0 border-t">
                        <Button onClick={() => setViewingItem(null)} variant="secondary" className="w-full font-bold uppercase tracking-tight">
                            Zamknij Podgląd
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
