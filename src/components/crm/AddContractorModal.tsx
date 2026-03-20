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
            setOpen(false)
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
                    Dodaj Firmę
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Nowy Partner Biznesowy</DialogTitle>
                    <DialogDescription>
                        Dodaj nową firmę do bazy. Będziesz mógł ją przypisać do projektów i faktur.
                    </DialogDescription>
                </DialogHeader>

                <form action={handleSubmit} className="space-y-4 mt-2">
                    <div>
                        <label className="text-sm font-semibold text-slate-700 block mb-1">Nazwa firmy *</label>
                        <input
                            name="name"
                            required
                            className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="np. Demetrix"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-slate-700 block mb-1">NIP (10 cyfr)</label>
                        <input
                            name="nip"
                            maxLength={10}
                            className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="5260001222"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-slate-700 block mb-1">Adres siedziby</label>
                        <input
                            name="address"
                            className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="ul. Słoneczna 1, Siemianowice"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-slate-700 block mb-1">Status Współpracy</label>
                        <select
                            name="status"
                            className="w-full border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="ACTIVE">Aktywny (Widoczny na listach)</option>
                            <option value="IN_REVIEW">Weryfikacja / Oferta w toku</option>
                            <option value="INACTIVE">Zablokowany / Archiwalny</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-slate-700 block mb-1">Typ Firmy (Klasyfikacja) *</label>
                        <select
                            name="type"
                            required
                            className="w-full border border-blue-200 bg-blue-50/30 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        >
                            <option value="INWESTOR">Inwestor (Siedziba Główna)</option>
                            <option value="DOSTAWCA">Dostawca / Podwykonawca (Magazyn)</option>
                            <option value="HURTOWNIA">Hurtownia / Sklep (Magazyn)</option>
                        </select>
                        <p className="text-[10px] text-blue-600 mt-1 italic font-medium">
                            * Wybór typu automatycznie nazwie pierwszy obiekt firmy.
                        </p>
                    </div>

                    <DialogFooter className="pt-2">
                        <button
                            type="submit"
                            disabled={isPending}
                            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50 font-medium"
                        >
                            {isPending ? "Zapisywanie..." : "Zapisz Firmę w Bazie"}
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}