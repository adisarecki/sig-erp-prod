"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog"
import { addProject } from "@/app/actions/projects"

interface AddProjectModalProps {
    contractors: { id: string, name: string }[]
}

export function AddProjectModal({ contractors }: AddProjectModalProps) {
    const [open, setOpen] = useState(false)
    const [isPending, setIsPending] = useState(false)
    const router = useRouter()

    async function handleSubmit(formData: FormData) {
        setIsPending(true)
        try {
            await addProject(formData)
            router.refresh()
            setOpen(false)
        } catch (error) {
            console.error(error)
            alert("Wystąpił błąd przy tworzeniu projektu: " + (error as Error).message)
        } finally {
            setIsPending(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
                    Nowy Projekt
                </button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Utwórz Nowy Projekt Inżynieryjny</DialogTitle>
                    <DialogDescription>
                        Dodaj projekt do systemu, przypisz mu głównego inwestora z bazy firm oraz określ początkowy szacowany budżet.
                    </DialogDescription>
                </DialogHeader>

                <form action={handleSubmit} className="space-y-4 mt-2">
                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1">Nazwa Projektu *</label>
                        <input
                            name="name"
                            required
                            className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="np. Skrzynki rozdzielcze biurowca X"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1">Inwestor / Generalny Wykonawca *</label>
                        <select
                            name="contractorId"
                            required
                            className="w-full border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="" disabled selected>-- Wybierz firmę z bazy --</option>
                            {contractors.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1">Krótki opis / Lokalizacja Obiektu</label>
                        <input
                            name="description"
                            className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Dla nowego obiektu powstanie oddzielny rekord lokalizacji"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-500">Kaucja Krótka (%)</label>
                            <input
                                name="retentionShortTermRate"
                                type="number"
                                step="0.1"
                                defaultValue="0"
                                className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                                placeholder="np. 5.0"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-500">Kaucja Długa (%)</label>
                            <input
                                name="retentionLongTermRate"
                                type="number"
                                step="0.1"
                                defaultValue="0"
                                className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                                placeholder="np. 3.0"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-500">Zakończenie (Estymacja)</label>
                            <input
                                name="estimatedCompletionDate"
                                type="date"
                                required
                                className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-500">Gwarancja (Lata)</label>
                            <input
                                name="warrantyPeriodYears"
                                type="number"
                                min="0"
                                defaultValue="3"
                                className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500">Budżet Szacowany (PLN)</label>
                        <input
                            name="budgetEstimated"
                            type="number"
                            step="0.01"
                            className="w-full border border-slate-300 rounded-md px-3 py-2 font-black text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0.00"
                        />
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-100 mt-2">
                        <label className="text-[10px] font-black uppercase text-slate-500">Podstawa naliczania kaucji</label>
                        <div className="flex gap-4 mt-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="retentionBase" value="GROSS" defaultChecked className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium">BRUTTO (Domyślne)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="retentionBase" value="NET" className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium">NETTO</span>
                            </label>
                        </div>
                    </div>

                    <DialogFooter>
                        <button
                            type="submit"
                            disabled={isPending || contractors.length === 0}
                            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
                        >
                            {isPending ? "Inicjowanie..." : "Dodaj Projekt"}
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
