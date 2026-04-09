"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { Pencil, AlertTriangle } from "lucide-react"
import { updateProject } from "@/app/actions/projects"
import { toast } from "sonner"

interface EditProjectModalProps {
    project: {
        id: string
        name: string
        budgetEstimated: number
        retentionShortTermRate?: number
        retentionLongTermRate?: number
        estimatedCompletionDate?: string | Date
        warrantyPeriodYears?: number
        retentionBase?: 'NET' | 'GROSS'
    }
}

export function EditProjectModal({ project }: EditProjectModalProps) {
    const [open, setOpen] = useState(false)
    const [isPending, setIsPending] = useState(false)
    const [showForkDialog, setShowForkDialog] = useState(false)
    const router = useRouter()

    // UI Persistence Fix: Convert decimal rates (0.05) back to percentages (5%)
    const getRateAsPercent = (rate?: number) => {
        if (rate === undefined || rate === null) return "0"
        return (Number(rate) * 100).toFixed(1).replace(/\.0$/, "")
    }

    const [name, setName] = useState(project.name)
    const [budget, setBudget] = useState(project.budgetEstimated.toString())
    const [retShort, setRetShort] = useState(getRateAsPercent(project.retentionShortTermRate))
    const [retLong, setRetLong] = useState(getRateAsPercent(project.retentionLongTermRate))
    const [estCompletion, setEstCompletion] = useState("")
    const [warranty, setWarranty] = useState((project.warrantyPeriodYears || 0).toString())
    const [retBase, setRetBase] = useState(project.retentionBase || "GROSS")

    // Reset form when project prop changes or modal opens
    useEffect(() => {
        if (open) {
            setName(project.name)
            setBudget(project.budgetEstimated.toString())
            setRetShort(getRateAsPercent(project.retentionShortTermRate))
            setRetLong(getRateAsPercent(project.retentionLongTermRate))
            setWarranty((project.warrantyPeriodYears || 0).toString())
            setRetBase(project.retentionBase || "GROSS")

            if (project.estimatedCompletionDate) {
                const date = new Date(project.estimatedCompletionDate)
                setEstCompletion(date.toISOString().split('T')[0])
            } else {
                setEstCompletion("")
            }
        }
    }, [open, project])

    const ratesChanged = () => {
        const dbRetShort = getRateAsPercent(project.retentionShortTermRate);
        const dbRetLong = getRateAsPercent(project.retentionLongTermRate);
        const dbRetBase = project.retentionBase || "GROSS";
        return retShort !== dbRetShort || retLong !== dbRetLong || retBase !== dbRetBase;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()

        if (ratesChanged()) {
            setShowForkDialog(true)
            return
        }

        await executeUpdate('FUTURE')
    }

    async function executeUpdate(mode: 'FUTURE' | 'RETROACTIVE') {
        setIsPending(true)
        try {
            const res = await updateProject(project.id, {
                name,
                budgetEstimated: budget,
                retentionShortTermRate: retShort,
                retentionLongTermRate: retLong,
                estimatedCompletionDate: estCompletion,
                warrantyPeriodYears: warranty,
                retentionBase: retBase,
                mode
            })

            if (res.success) {
                toast.success(mode === 'RETROACTIVE' 
                    ? "Zaktualizowano projekt i przeliczono historię." 
                    : "Zaktualizowano projekt.")
                router.refresh()
                setOpen(false)
                setShowForkDialog(false)
            } else {
                toast.error(res.error || "Błąd podczas aktualizacji.")
            }
        } catch (error) {
            console.error(error)
            toast.error("Błąd krytyczny: " + (error as Error).message)
        } finally {
            setIsPending(false)
        }
    }

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        setOpen(true)
                    }}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-blue-600"
                    title="Edytuj projekt"
                >
                    <Pencil className="w-4 h-4" />
                </button>
                <DialogContent onClick={(e) => e.stopPropagation()}>
                    <DialogHeader>
                        <DialogTitle>Edytuj Projekt</DialogTitle>
                        <DialogDescription>
                            Zaktualizuj nazwę projektu lub skoryguj szacowany budżet (przychód).
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Nazwa Projektu *</Label>
                            <Input
                                id="edit-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                placeholder="np. Skrzynki rozdzielcze biurowca X"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-budget">Szacowany Budżet (Przychód PLN) *</Label>
                            <Input
                                id="edit-budget"
                                type="number"
                                step="0.01"
                                min="0"
                                value={budget}
                                onChange={(e) => setBudget(e.target.value)}
                                required
                                placeholder="np. 150000.00"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-ret-short">Kaucja Krótka (%)</Label>
                                <Input
                                    id="edit-ret-short"
                                    type="number"
                                    step="0.1"
                                    value={retShort}
                                    onChange={(e) => setRetShort(e.target.value)}
                                    className="font-bold border-blue-100"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-ret-long">Kaucja Długa (%)</Label>
                                <Input
                                    id="edit-ret-long"
                                    type="number"
                                    step="0.1"
                                    value={retLong}
                                    onChange={(e) => setRetLong(e.target.value)}
                                    className="font-bold border-blue-100"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-completion">Zakończenie (Estymacja)</Label>
                                <Input
                                    id="edit-completion"
                                    type="date"
                                    value={estCompletion}
                                    onChange={(e) => setEstCompletion(e.target.value)}
                                    className="font-bold"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-warranty">Gwarancja (Lata)</Label>
                                <Input
                                    id="edit-warranty"
                                    type="number"
                                    min="0"
                                    value={warranty}
                                    onChange={(e) => setWarranty(e.target.value)}
                                    className="font-bold"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5 pt-2 border-t border-slate-100 mt-2">
                            <Label className="text-[10px] font-black uppercase text-slate-500">Podstawa naliczania kaucji</Label>
                            <div className="flex gap-4 mt-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="edit-retentionBase" 
                                        value="GROSS" 
                                        checked={retBase === 'GROSS'} 
                                        onChange={() => setRetBase('GROSS')}
                                        className="w-4 h-4 text-blue-600" 
                                    />
                                    <span className="text-sm font-medium">BRUTTO</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="edit-retentionBase" 
                                        value="NET" 
                                        checked={retBase === 'NET'} 
                                        onChange={() => setRetBase('NET')}
                                        className="w-4 h-4 text-blue-600" 
                                    />
                                    <span className="text-sm font-medium">NETTO</span>
                                </label>
                            </div>
                        </div>

                        <DialogFooter className="gap-2 pt-4">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setOpen(false)}
                                disabled={isPending}
                            >
                                Anuluj
                            </Button>
                            <Button
                                type="submit"
                                disabled={isPending}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                {isPending ? "Zapisywanie..." : "Zapisz Zmiany"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* VECTOR 102.2: DECISION MODAL (RETENTION FORK) */}
            <Dialog open={showForkDialog} onOpenChange={(val) => !isPending && setShowForkDialog(val)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-blue-700">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            Rozwidlenie Kaucji (Fork)
                        </DialogTitle>
                        <DialogDescription className="text-slate-600 py-2">
                            Zmieniono stawki kaucji dla projektu. Jak chcesz zastosować nowe zasady?
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-3 py-4">
                        <button
                            onClick={() => executeUpdate('FUTURE')}
                            disabled={isPending}
                            className="text-left p-4 border rounded-xl hover:bg-slate-50 transition-colors group"
                        >
                            <p className="font-bold text-slate-900 group-hover:text-blue-700">Opcja A: Tylko do nowych faktur</p>
                            <p className="text-xs text-slate-500 mt-1">
                                Zostaw historię w spokoju. Nowe stawki będą obowiązywać dopiero od kolejnego wystawionego dokumentu.
                            </p>
                        </button>

                        <button
                            onClick={() => executeUpdate('RETROACTIVE')}
                            disabled={isPending}
                            className="text-left p-4 border-2 border-amber-100 rounded-xl hover:bg-amber-50 transition-colors group"
                        >
                            <p className="font-bold text-slate-900 group-hover:text-amber-700">Opcja B: Przelicz cały projekt wstecz</p>
                            <p className="text-xs text-slate-500 mt-1">
                                Zastosuj nowe stawki do wszystkich historycznych faktur w tym projekcie i zaktualizuj bilans Skarbca.
                            </p>
                            <div className="mt-3 flex gap-2 p-2 bg-amber-100/50 rounded-lg text-[10px] text-amber-800 font-medium">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span>⚠️ Uwaga: Przeliczenie wstecz może wymagać wystawienia faktur korygujących dla Inwestora.</span>
                            </div>
                        </button>
                    </div>

                    <DialogFooter>
                        <Button 
                            variant="ghost" 
                            onClick={() => setShowForkDialog(false)}
                            disabled={isPending}
                        >
                            Powrót do edycji
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
