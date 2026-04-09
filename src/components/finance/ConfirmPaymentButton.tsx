"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { markInvoiceAsPaid } from "@/app/actions/invoices"
import { markInstallmentAsPaid } from "@/app/actions/debts"
import { CheckCircle2 } from "lucide-react"

interface ConfirmPaymentButtonProps {
    invoiceId?: string
    installmentId?: string
    invoiceNumber?: string
    amountGross: number
    isIncome: boolean
    isInstallment?: boolean
}

export function ConfirmPaymentButton({ 
    invoiceId, 
    installmentId, 
    invoiceNumber, 
    amountGross, 
    isIncome, 
    isInstallment 
}: ConfirmPaymentButtonProps) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
    const router = useRouter()

    async function handleConfirm() {
        setIsLoading(true)
        try {
            if (isInstallment && installmentId) {
                const result = await markInstallmentAsPaid(installmentId, paymentDate)
                if (result.success) setOpen(false)
            } else if (invoiceId) {
                const result = await markInvoiceAsPaid(invoiceId, paymentDate)
                if (result.success) {
                    router.refresh()
                    setOpen(false)
                }
            }
        } catch (error) {
            alert(error instanceof Error ? error.message : "Błąd podczas potwierdzania wpłaty.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button 
                    variant="outline"
                    size="sm" 
                    className={`${isIncome ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'border-rose-200 text-rose-700 hover:bg-rose-50'} inline-flex items-center gap-1.5 h-8 px-3 font-bold text-[11px] uppercase tracking-tight`}
                >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Potwierdź {isIncome ? 'wpływ' : 'wydatek'}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Potwierdzenie Płatności</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-2">
                        <div className="flex justify-between text-[10px] text-slate-400 uppercase font-black tracking-widest">
                            <span>{isInstallment ? 'Rata Długu' : 'Faktura'}</span>
                            <span>Kwota Brutto</span>
                        </div>
                        <div className="flex justify-between text-lg font-black text-slate-900 mt-1">
                            <span className="truncate mr-4">{invoiceNumber || (isInstallment ? 'RATA' : (invoiceId?.split('-')[0]))}</span>
                            <span className={isIncome ? 'text-emerald-700' : 'text-rose-700'}>
                                {new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amountGross)}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2 pt-2">
                        <Label htmlFor="paymentDate" className="font-bold text-slate-700 text-sm">Data faktycznego przelewu *</Label>
                        <Input 
                            id="paymentDate"
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            className="h-12 text-base border-slate-200 shadow-sm focus:ring-blue-500"
                        />
                        <p className="text-[10px] text-blue-600 bg-blue-50 p-2 rounded-md border border-blue-100 mt-2 font-medium">
                            <strong>Zasada Prawdy</strong>: Wybrana data określi, w którym miesiącu transakcja wpłynie na Twój Globalny Bilans gotówki.
                        </p>
                    </div>
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="ghost" onClick={() => setOpen(false)} disabled={isLoading} className="flex-1 h-12">Anuluj</Button>
                    <Button 
                        onClick={handleConfirm} 
                        disabled={isLoading}
                        className={`flex-1 h-12 font-bold ${isIncome ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'} text-white shadow-lg`}
                    >
                        {isLoading ? "Księguj..." : "Potwierdź Płatność"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
