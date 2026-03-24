"use client"

import { useState, useEffect } from "react"
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
import { Pencil } from "lucide-react"
import { updateProject } from "@/app/actions/projects"

interface EditProjectModalProps {
    project: {
        id: string
        name: string
        budgetEstimated: number
        retentionShortTermRate?: number
        retentionLongTermRate?: number
        estimatedCompletionDate?: string | Date
        warrantyPeriodYears?: number
    }
}

export function EditProjectModal({ project }: EditProjectModalProps) {
    const [open, setOpen] = useState(false)
    const [isPending, setIsPending] = useState(false)

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

    // UI Lock Mechanism: Fields are locked if they already have a value
    const [isRetShortLocked, setIsRetShortLocked] = useState(Number(project.retentionShortTermRate || 0) > 0)
    const [isRetLongLocked, setIsRetLongLocked] = useState(Number(project.retentionLongTermRate || 0) > 0)

    // Reset form when project prop changes or modal opens
    useEffect(() => {
        if (open) {
            setName(project.name)
            setBudget(project.budgetEstimated.toString())
            setRetShort(getRateAsPercent(project.retentionShortTermRate))
            setRetLong(getRateAsPercent(project.retentionLongTermRate))
            setWarranty((project.warrantyPeriodYears || 0).toString())

            // Set locking state based on database values
            setIsRetShortLocked(Number(project.retentionShortTermRate || 0) > 0)
            setIsRetLongLocked(Number(project.retentionLongTermRate || 0) > 0)

            if (project.estimatedCompletionDate) {
                const date = new Date(project.estimatedCompletionDate)
                setEstCompletion(date.toISOString().split('T')[0])
            } else {
                setEstCompletion("")
            }
        }
    }, [open, project])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()

        // Guardrail: Alert user if retention rates have changed from DB
        const newRetShort = Number(retShort)
        const newRetLong = Number(retLong)
        const dbRetShort = Number(getRateAsPercent(project.retentionShortTermRate))
        const dbRetLong = Number(getRateAsPercent(project.retentionLongTermRate))

        if (newRetShort !== dbRetShort || newRetLong !== dbRetLong) {
            const confirmed = window.confirm(
                `Uwaga: Twoja dotychczasowa kaucja dla tego projektu to ${dbRetShort}% (krótka) / ${dbRetLong}% (długa).\n\n` +
                `Czy na pewno chcesz ją zmienić na ${newRetShort}% / ${newRetLong}%?\n\n` +
                `Spowoduje to natychmiastowe przeliczenie kwot w Skarbcu.`
            )
            if (!confirmed) return
        }

        setIsPending(true)
        try {
            await updateProject(project.id, {
                name,
                budgetEstimated: budget,
                retentionShortTermRate: retShort,
                retentionLongTermRate: retLong,
                estimatedCompletionDate: estCompletion,
                warrantyPeriodYears: warranty
            })
            setOpen(false)
        } catch (error) {
            console.error(error)
            alert("Błąd podczas aktualizacji projektu: " + (error as Error).message)
        } finally {
            setIsPending(false)
        }
    }

    return (
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
                            <div className="flex justify-between items-center">
                                <Label htmlFor="edit-ret-short">Kaucja Krótka (%)</Label>
                                {isRetShortLocked && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (confirm("Czy na pewno chcesz zmienić kaucję? Spowoduje to przeliczenie kwot.")) {
                                                setIsRetShortLocked(false)
                                            }
                                        }}
                                        className="text-[10px] text-blue-600 font-bold hover:underline"
                                    >
                                        Zmień
                                    </button>
                                )}
                            </div>
                            <Input
                                id="edit-ret-short"
                                type="number"
                                step="0.1"
                                value={retShort}
                                onChange={(e) => setRetShort(e.target.value)}
                                className={`font-bold ${isRetShortLocked ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''}`}
                                readOnly={isRetShortLocked}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label htmlFor="edit-ret-long">Kaucja Długa (%)</Label>
                                {isRetLongLocked && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (confirm("Czy na pewno chcesz zmienić kaucję? Spowoduje to przeliczenie kwot.")) {
                                                setIsRetLongLocked(false)
                                            }
                                        }}
                                        className="text-[10px] text-blue-600 font-bold hover:underline"
                                    >
                                        Zmień
                                    </button>
                                )}
                            </div>
                            <Input
                                id="edit-ret-long"
                                type="number"
                                step="0.1"
                                value={retLong}
                                onChange={(e) => setRetLong(e.target.value)}
                                className={`font-bold ${isRetLongLocked ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''}`}
                                readOnly={isRetLongLocked}
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
    )
}
