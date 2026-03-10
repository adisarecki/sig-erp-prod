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
import { addContractor } from "@/app/actions/crm"

export function AddContractorModal() {
    const [open, setOpen] = useState(false)
    const [isPending, setIsPending] = useState(false)

    async function handleSubmit(formData: FormData) {
        setIsPending(true)
        try {
            await addContractor(formData)
            setOpen(false) // Zamknij modal po sukcesie
        } catch (error) {
            console.error(error)
            alert("Wystąpił błąd przy dodawaniu kontrahenta.")
        } finally {
            setIsPending(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
                    Dodaj Kontrahenta
                </button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Nowy Kontrahent</DialogTitle>
                    <DialogDescription>
                        Dodaj nową firmę do bazy wiedzy. Możesz powiązać z nią przyszłe projekty sprzedażowe i instalacyjne.
                    </DialogDescription>
                </DialogHeader>

                <form action={handleSubmit} className="space-y-4 mt-2">
                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1">Nazwa firmy *</label>
                        <input
                            name="name"
                            required
                            className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="np. Budimex S.A."
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1">NIP (Opcjonalnie)</label>
                        <input
                            name="nip"
                            className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0000000000"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1">Adres</label>
                        <input
                            name="address"
                            className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="ul. Długa 1, Warszawa"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1">Status Relacji</label>
                        <select
                            name="status"
                            className="w-full border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="ACTIVE">Aktywny (Standard)</option>
                            <option value="IN_REVIEW">Wycena / W sprawdzaniu (IN_REVIEW)</option>
                            <option value="INACTIVE">Zablokowany / Nieaktywny</option>
                        </select>
                    </div>

                    <DialogFooter>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
                        >
                            {isPending ? "Zapisywanie..." : "Zapisz Firmę"}
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
