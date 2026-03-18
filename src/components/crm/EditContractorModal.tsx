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
import { updateContractor } from "@/app/actions/crm"
import { Pencil } from "lucide-react"

interface Contractor {
    id: string
    name: string
    nip: string | null
    address: string | null
    status: string
}

export function EditContractorModal({ contractor }: { contractor: Contractor }) {
    const [open, setOpen] = useState(false)
    const [isPending, setIsPending] = useState(false)

    async function handleSubmit(formData: FormData) {
        setIsPending(true)
        try {
            await updateContractor(formData)
            setOpen(false) // Zamknij modal po sukcesie
        } catch (error) {
            console.error(error)
            alert("Wystąpił błąd podczas aktualizacji danych firmy.")
        } finally {
            setIsPending(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button className="text-slate-400 hover:text-blue-600 transition p-2 rounded-full hover:bg-blue-50">
                    <Pencil className="w-4 h-4" />
                </button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edytuj Dane Firmy</DialogTitle>
                    <DialogDescription>
                        Zmiany nazwy będą natychmiast widoczne w powiązanych z firmą projektach.
                    </DialogDescription>
                </DialogHeader>

                <form action={handleSubmit} className="space-y-4 mt-2">
                    <input type="hidden" name="id" value={contractor.id} />
                    
                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1">Nazwa firmy *</label>
                        <input
                            name="name"
                            required
                            defaultValue={contractor.name}
                            className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1">NIP (Opcjonalnie)</label>
                        <input
                            name="nip"
                            defaultValue={contractor.nip || ""}
                            className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1">Adres</label>
                        <input
                            name="address"
                            defaultValue={contractor.address || ""}
                            className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1">Status Relacji</label>
                        <select
                            name="status"
                            defaultValue={contractor.status}
                            className="w-full border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="ACTIVE">Aktywny (Standard)</option>
                            <option value="IN_REVIEW">Wycena / W sprawdzaniu (IN_REVIEW)</option>
                            <option value="INACTIVE">Zablokowany / Nieaktywny</option>
                        </select>
                    </div>

                    <DialogFooter>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-md transition"
                        >
                            Anuluj
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
                        >
                            {isPending ? "Zapisywanie..." : "Zapisz Zmiany"}
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
