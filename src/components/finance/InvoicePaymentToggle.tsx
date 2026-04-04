"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { markInvoiceAsPaid, markInvoiceAsUnpaid } from "@/app/actions/invoices"
import { Loader2, CheckCircle2, XCircle, AlertTriangle, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

interface InvoicePaymentToggleProps {
    invoiceId: string;
    initialPaymentStatus: string;
    initialReconciliationStatus?: string;
    initialPaymentMethod?: string;
}

export function InvoicePaymentToggle({ 
    invoiceId, 
    initialPaymentStatus, 
    initialReconciliationStatus = 'PENDING',
    initialPaymentMethod = 'BANK_TRANSFER'
}: InvoicePaymentToggleProps) {
    const [status, setStatus] = useState(initialPaymentStatus)
    const [reconciliation, setReconciliation] = useState(initialReconciliationStatus)
    const [isLoading, setIsLoading] = useState(false)

    const isBankVerified = reconciliation === 'MATCHED';
    const isGap = reconciliation === 'GAP';
    const isManualPaid = status === 'PAID' && !isBankVerified;

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
                } else {
                    // If manually paid, it's pending bank verification by default
                    setReconciliation(method === 'BANK_TRANSFER' ? 'PENDING' : 'PENDING')
                }
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
