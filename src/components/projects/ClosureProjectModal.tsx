"use client"

import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle2, AlertTriangle, Info } from "lucide-react"
import { closeProject } from "@/app/actions/projects"

interface ClosureProjectModalProps {
    projectId: string
    projectName: string
    budgetEstimated: number
    totalInvoicedNet: number
}

export function ClosureProjectModal({ 
    projectId, 
    projectName, 
    budgetEstimated, 
    totalInvoicedNet 
}: ClosureProjectModalProps) {
    const [open, setOpen] = useState(false)
    const [isPending, setIsPending] = useState(false)
    const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0])

    const remainingNet = budgetEstimated - totalInvoicedNet
    const isFullyInvoiced = remainingNet <= 0

    async function handleClose(e: React.FormEvent) {
        e.preventDefault()
        setIsPending(true)
        try {
            const result = await closeProject(projectId, receiptDate)
            if (result.success) {
                setOpen(false)
            } else {
                alert(result.error)
            }
        } catch (error) {
            console.error(error)
            alert("Błąd podczas zamykania projektu.")
        } finally {
            setIsPending(false)
        }
    }

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                onClick={(e) => {
                    e.stopPropagation()
                    setOpen(true)
                }}
                title="Zakończ Inwestycję"
            >
                <CheckCircle2 className="h-4 w-4" />
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent onClick={(e) => e.stopPropagation()} className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            Zakończ Inwestycję
                        </DialogTitle>
                        <DialogDescription>
                            Zatwierdź protokół odbioru dla projektu: <span className="font-bold text-slate-900">{projectName}</span>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* Financial Summary */}
                        <div className={`p-4 rounded-2xl border ${isFullyInvoiced ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                            <div className="flex items-start gap-3">
                                {isFullyInvoiced ? (
                                    <Info className="w-5 h-5 text-emerald-600 mt-0.5" />
                                ) : (
                                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                                )}
                                <div>
                                    <p className="text-sm font-bold text-slate-900">Podsumowanie finansowe</p>
                                    <p className="text-xs text-slate-600 mt-1">
                                        Do zafakturowania pozostało: <span className={`font-black ${isFullyInvoiced ? 'text-emerald-700' : 'text-amber-700'}`}>
                                            {remainingNet.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })} Netto
                                        </span>
                                    </p>
                                    {!isFullyInvoiced && (
                                        <p className="text-[10px] text-amber-600 font-medium mt-2 leading-relaxed">
                                            Uwaga: System wyśle powiadomienie o konieczności wystawienia faktury końcowej.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Receipt Date Input */}
                        <div className="space-y-2">
                            <Label htmlFor="receipt-date">Data Odbioru Końcowego *</Label>
                            <Input
                                id="receipt-date"
                                type="date"
                                value={receiptDate}
                                onChange={(e) => setReceiptDate(e.target.value)}
                                required
                                className="font-bold"
                            />
                            <p className="text-[10px] text-slate-500 italic">
                                Data ta zostanie użyta do automatycznego przeliczenia terminów zwrotu kaucji gwarancyjnych.
                            </p>
                        </div>

                        {/* Locking Warning */}
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <p className="text-[10px] text-slate-600 leading-normal">
                                <span className="font-bold">Blokada Projektu:</span> Zamknięcie projektu uniemożliwi przypisywanie nowych kosztów (faktur) do tego zlecenia. Będziesz mógł go odblokować w ustawieniach projektu.
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setOpen(false)}
                            disabled={isPending}
                        >
                            Anuluj
                        </Button>
                        <Button
                            onClick={handleClose}
                            disabled={isPending}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        >
                            {isPending ? "Zamykanie..." : "Zatwierdź Odbiór i Zamknij"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
