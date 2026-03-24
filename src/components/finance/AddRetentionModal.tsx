"use client"

import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PlusCircle } from "lucide-react"
import { addRetention } from "@/app/actions/retentions"

interface AddRetentionModalProps {
    projects: { id: string, name: string }[]
    contractors: { id: string, name: string }[]
}

export function AddRetentionModal({ projects, contractors }: AddRetentionModalProps) {
    const [open, setOpen] = useState(false)
    const [isPending, setIsPending] = useState(false)

    async function handleSubmit(formData: FormData) {
        setIsPending(true)
        try {
            const res = await addRetention(formData)
            if (res.success) {
                setOpen(false)
            } else {
                alert("Błąd: " + res.error)
            }
        } catch (error) {
            console.error(error)
            alert("Wystąpił nieoczekiwany błąd.")
        } finally {
            setIsPending(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 border-dashed">
                    <PlusCircle className="w-4 h-4" />
                    Dodaj Ręcznie
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Dodaj Kaucję Gwarancyjną</DialogTitle>
                    <DialogDescription>
                        Wprowadź środki zamrożone u inwestora, które nie wynikają z automatycznej kaucji projektowej.
                    </DialogDescription>
                </DialogHeader>

                <form action={handleSubmit} className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="amount">Kwota (PLN)</Label>
                            <Input id="amount" name="amount" type="number" step="0.01" required placeholder="0.00" autoFocus />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="type">Typ Kaucji</Label>
                            <select
                                id="type"
                                name="type"
                                className="w-full flex h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                                required
                            >
                                <option value="SHORT_TERM">Krótkoterminowa</option>
                                <option value="LONG_TERM">Długoterminowa</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="expiryDate">Data Wygaśnięcia (Zwrotu)</Label>
                        <Input id="expiryDate" name="expiryDate" type="date" required />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="projectId">Projekt (Opcjonalnie)</Label>
                        <select
                            id="projectId"
                            name="projectId"
                            className="w-full flex h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                        >
                            <option value="">-- Brak powiązania --</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Opis / Uwagi</Label>
                        <Input id="description" name="description" placeholder="np. Kaucja przejęta z firmy XYZ" />
                    </div>

                    <input type="hidden" name="source" value="MANUAL" />

                    <DialogFooter className="pt-4">
                        <Button type="submit" disabled={isPending} className="w-full bg-blue-600 hover:bg-blue-700">
                            {isPending ? "Zapisywanie..." : "Zarejestruj Kaucję"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
