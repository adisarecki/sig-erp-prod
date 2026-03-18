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
    }
}

export function EditProjectModal({ project }: EditProjectModalProps) {
    const [open, setOpen] = useState(false)
    const [isPending, setIsPending] = useState(false)
    const [name, setName] = useState(project.name)
    const [budget, setBudget] = useState(project.budgetEstimated.toString())

    // Reset form when project prop changes or modal opens
    useEffect(() => {
        if (open) {
            setName(project.name)
            setBudget(project.budgetEstimated.toString())
        }
    }, [open, project])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setIsPending(true)
        try {
            await updateProject(project.id, {
                name,
                budgetEstimated: budget
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
