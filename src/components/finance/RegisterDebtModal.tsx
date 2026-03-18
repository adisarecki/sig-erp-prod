"use client"

import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { History } from "lucide-react"
import { addLegacyDebt } from "@/app/actions/debts"

export function RegisterDebtModal() {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    async function handleSubmit(formData: FormData) {
        setIsLoading(true)
        try {
            const result = await addLegacyDebt(formData)
            if (result.success) {
                setOpen(false)
            }
        } catch (error) {
            alert(error instanceof Error ? error.message : "Błąd podczas dodawania długu.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="border-slate-800 bg-slate-900 text-rose-400 hover:bg-slate-800 hover:text-rose-300 gap-2 transition-all active:scale-95 shadow-lg border-2">
                    <History className="h-4 w-4" />
                    Harmonogram Długu
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px] rounded-2xl border-slate-800 bg-white shadow-2xl">
                <DialogHeader>
                    <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center mb-4 border border-rose-200">
                        <History className="w-6 h-6 text-rose-600" />
                    </div>
                    <DialogTitle className="text-2xl font-black text-slate-900">Zobowiązanie Historyczne</DialogTitle>
                    <DialogDescription className="text-slate-500 font-medium">
                        Wprowadź dług z przeszłości. System automatycznie rozbije go na równe raty.
                    </DialogDescription>
                </DialogHeader>

                <form action={handleSubmit} className="space-y-6 mt-4">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="creditor" className="text-sm font-bold text-slate-700 uppercase tracking-wider">Wierzyciel (Komu wisimy?)</Label>
                            <Input
                                id="creditor"
                                name="creditor"
                                placeholder="Np. Urząd Skarbowy, Bank X"
                                required
                                className="h-12 border-slate-200 focus:ring-rose-500 font-medium"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-sm font-bold text-slate-700 uppercase tracking-wider">Nazwa Zobowiązania</Label>
                            <Input
                                id="name"
                                name="name"
                                placeholder="Np. Pożyczka Inwestycyjna 2024"
                                required
                                className="h-12 border-slate-200 focus:ring-rose-500 font-medium"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="totalAmount" className="text-sm font-bold text-slate-700 uppercase tracking-wider">Kwota Całkowita</Label>
                                <Input
                                    id="totalAmount"
                                    name="totalAmount"
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    required
                                    className="h-12 border-slate-200 focus:ring-rose-500 font-mono text-lg"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="installmentsCount" className="text-sm font-bold text-slate-700 uppercase tracking-wider">Liczba Rat</Label>
                                <Input
                                    id="installmentsCount"
                                    name="installmentsCount"
                                    type="number"
                                    min="1"
                                    max="120"
                                    defaultValue="12"
                                    required
                                    className="h-12 border-slate-200 focus:ring-rose-500"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="startDate" className="text-sm font-bold text-slate-700 uppercase tracking-wider">Data Pierwszej Spłaty</Label>
                            <Input
                                id="startDate"
                                name="startDate"
                                type="date"
                                required
                                defaultValue={new Date().toISOString().split('T')[0]}
                                className="h-12 border-slate-200 focus:ring-rose-500"
                            />
                        </div>
                    </div>

                    <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                        <p className="text-[10px] text-rose-800 font-bold uppercase mb-1">Zasady Fort Knox:</p>
                        <ul className="text-[10px] text-rose-700 space-y-1 list-disc pl-4 font-medium opacity-80">
                            <li>Raty po zapłaceniu obniżają Globalny Bilans.</li>
                            <li>Dług nie obciąża marży Twoich obecnych projektów.</li>
                            <li>Każda rata to oddzielny koszt w Cash Flow.</li>
                        </ul>
                    </div>

                    <DialogFooter className="pt-2 flex gap-3">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setOpen(false)}
                            className="flex-1 min-h-[50px] text-slate-500 hover:bg-slate-100"
                        >
                            Anuluj
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 min-h-[50px] bg-slate-900 hover:bg-black text-rose-400 font-bold shadow-xl border border-slate-800"
                        >
                            {isLoading ? "Generowanie rat..." : "Aktywuj Plan Spłaty"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
