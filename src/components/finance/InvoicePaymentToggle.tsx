"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { markInvoiceAsPaid, markInvoiceAsUnpaid } from "@/app/actions/invoices"
import { Loader2, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Receipt, RotateCcw } from "lucide-react"
import { toast } from "sonner"

interface InvoicePaymentToggleProps {
    invoiceId: string;
    initialPaymentStatus: string;
    initialReconciliationStatus?: string;
    initialPaymentMethod?: string;
    /** Vector 160: If issueDate === dueDate, treat as auto-paid POS/Cash transaction */
    isPosPayment?: boolean;
}

export function InvoicePaymentToggle({ 
    invoiceId, 
    initialPaymentStatus, 
    initialReconciliationStatus = 'PENDING',
    initialPaymentMethod = 'BANK_TRANSFER',
    isPosPayment = false,
}: InvoicePaymentToggleProps) {
    const [status, setStatus] = useState(initialPaymentStatus)
    const [reconciliation, setReconciliation] = useState(initialReconciliationStatus)
    const [isLoading, setIsLoading] = useState(false)
    const [posReverted, setPosReverted] = useState(false)
    const router = useRouter()

    const isBankVerified = reconciliation === 'MATCHED';
    const isGap = reconciliation === 'GAP';
    const isManualPaid = status === 'PAID' && !isBankVerified && !isPosPayment;

    const handleToggle = async (targetStatus: 'PAID' | 'UNPAID', method: string = 'CARD') => {
        setIsLoading(true)
        try {
            let result;
            if (targetStatus === 'PAID') {
                result = await markInvoiceAsPaid(invoiceId, undefined, method)
            } else {
                result = await markInvoiceAsUnpaid(invoiceId)
            }

            if (result.success) {
                setStatus(targetStatus)
                if (targetStatus === 'UNPAID') {
                    setReconciliation('PENDING')
                    if (isPosPayment) setPosReverted(true)
                } else {
                    setReconciliation(method === 'BANK_TRANSFER' ? 'PENDING' : 'PENDING')
                }
                router.refresh()
                toast.success(targetStatus === 'PAID' ? "Oznaczono jako opłacone." : "Oznaczono jako do zapłaty.")
            } else {
                toast.error(result.error || "Wystąpił błąd.")
            }
        } catch (error) {
            toast.error("Błąd połączenia.")
        } finally {
            setIsLoading(false)
        }
    }

    // ─── BANK VERIFIED (highest authority) ──────────────────────────────────
    if (isBankVerified) {
        return (
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center gap-3">
                <div className="bg-emerald-500 p-1.5 rounded-full text-white">
                    <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="flex-1">
                    <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Bank Verified (Vector 104)</p>
                    <p className="text-xs text-emerald-600 font-medium whitespace-nowrap">Potwierdzone wyciągiem bankowym.</p>
                </div>
                <Button disabled size="sm" variant="ghost" className="text-emerald-700 opacity-50 font-bold text-[10px]">
                    ZABLOKOWANE
                </Button>
            </div>
        )
    }

    // ─── VECTOR 160: POS / CASH AUTO-PAY ────────────────────────────────────
    // Show as auto-paid if issueDate === dueDate AND not manually reverted AND invoice is PAID
    if (isPosPayment && status === 'PAID' && !posReverted) {
        return (
            <div className="space-y-2">
                <div className="bg-emerald-50 border border-emerald-300 p-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-1">
                    <div className="bg-emerald-500 p-1.5 rounded-full text-white shrink-0">
                        <Receipt className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                        <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">
                            ✅ OPŁACONE (POS / GOTÓWKA)
                        </p>
                        <p className="text-[11px] text-emerald-700 font-medium leading-tight">
                            Data wystawienia = data płatności. Zapłacono na kasie / kartą w punkcie sprzedaży.
                        </p>
                    </div>
                </div>
                {/* Manual revert (rare case) */}
                <button
                    type="button"
                    onClick={() => handleToggle('UNPAID')}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-dashed border-slate-200 hover:border-rose-200 transition-all disabled:opacity-50"
                >
                    {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                    Cofnij (oznacz jako do zapłaty)
                </button>
            </div>
        )
    }

    // ─── POS REVERTED or UNPAID POS ─────────────────────────────────────────
    // Show POS context but let user re-mark as paid
    if (isPosPayment && (status !== 'PAID' || posReverted)) {
        return (
            <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-lg flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-blue-500 shrink-0" />
                    <p className="text-[10px] font-semibold text-blue-700">
                        Transakcja POS/GOTÓWKA — data wyst. = termin. Zalecana ponowna aktywacja:
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        disabled={isLoading}
                        onClick={() => { handleToggle('PAID', 'CARD'); setPosReverted(false) }}
                        className="flex-1 h-10 font-bold uppercase tracking-tight bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                        Oznacz Opłacone (POS)
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={isLoading}
                        onClick={() => handleToggle('UNPAID')}
                        className="flex-1 h-10 font-bold uppercase tracking-tight text-slate-500"
                    >
                        <XCircle className="w-4 h-4 mr-2" /> Do Zapłaty
                    </Button>
                </div>
            </div>
        )
    }

    // ─── STANDARD TOGGLE (non-POS) ──────────────────────────────────────────
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Button 
                    size="sm"
                    variant={status === 'PAID' ? 'default' : 'outline'}
                    disabled={isLoading}
                    onClick={() => handleToggle('PAID', 'CARD')}
                    className={`flex-1 h-10 font-bold uppercase tracking-tight ${status === 'PAID' ? 'bg-slate-900' : 'bg-white text-slate-600'}`}
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Oznacz jako Zapłacone
                </Button>
                <Button 
                    size="sm"
                    variant={status === 'UNPAID' ? 'destructive' : 'outline'}
                    disabled={isLoading}
                    onClick={() => handleToggle('UNPAID')}
                    className="flex-1 h-10 font-bold uppercase tracking-tight"
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                    Do Zapłaty
                </Button>
            </div>

            {isManualPaid && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                    <div>
                        <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Oczekiwanie na Bank (Vector 118)</p>
                        <p className="text-[11px] text-amber-700 font-medium leading-tight">
                            Płatność zarejestrowana manualnie. System czeka na potwierdzenie z wyciągu bankowego.
                        </p>
                    </div>
                </div>
            )}

            {isGap && (
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-center gap-3 border-2 animate-pulse">
                    <XCircle className="w-6 h-6 text-rose-600 shrink-0" />
                    <div>
                        <p className="text-[10px] font-black text-rose-800 uppercase tracking-widest">RECONCILIATION_GAP ALERT</p>
                        <p className="text-[11px] text-rose-700 font-bold leading-tight">
                            KRYTYCZNE: Brak dopasowania w wyciągach bankowych pomimo oznaczenia jako opłacone!
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
