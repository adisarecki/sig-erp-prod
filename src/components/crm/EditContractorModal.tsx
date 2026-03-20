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
import { updateContractor, updateObject } from "@/app/actions/crm"
import { Pencil, Store, MapPin } from "lucide-react"

interface Contractor {
    id: string
    name: string
    nip: string | null
    address: string | null
    type: string
    status: string
    objects: { id: string, name: string }[]
}

export function EditContractorModal({ contractor }: { contractor: Contractor }) {
    const [open, setOpen] = useState(false)
    const [isPending, setIsPending] = useState(false)
    const [editingObjectId, setEditingObjectId] = useState<string | null>(null)
    const [tempObjectName, setTempObjectName] = useState("")

    async function handleSubmit(formData: FormData) {
        setIsPending(true)
        try {
            await updateContractor(formData)
            setOpen(false)
        } catch (error) {
            console.error(error)
            alert("Błąd podczas aktualizacji danych firmy.")
        } finally {
            setIsPending(false)
        }
    }

    async function handleObjectUpdate(id: string) {
        setIsPending(true)
        const formData = new FormData()
        formData.append("id", id)
        formData.append("name", tempObjectName)
        
        try {
            await updateObject(formData)
            setEditingObjectId(null)
        } catch (error) {
            alert("Błąd podczas zmiany nazwy obiektu.")
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
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edytuj Dane Firmy</DialogTitle>
                    <DialogDescription>
                        Zarządzaj klasyfikacją i obiektami (magazynami) tej firmy.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                    <form action={handleSubmit} className="space-y-4 pb-6 border-b border-slate-100">
                        <input type="hidden" name="id" value={contractor.id} />
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nazwa firmy *</label>
                                <input
                                    name="name"
                                    required
                                    defaultValue={contractor.name}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">NIP</label>
                                <input
                                    name="nip"
                                    defaultValue={contractor.nip || ""}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Typ Biznesowy</label>
                                <select
                                    name="type"
                                    defaultValue={contractor.type}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 bg-blue-50/50 text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                                >
                                    <option value="INWESTOR">Inwestor</option>
                                    <option value="DOSTAWCA">Dostawca</option>
                                    <option value="HURTOWNIA">Hurtownia</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Adres siedziby</label>
                            <input
                                name="address"
                                defaultValue={contractor.address || ""}
                                className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div className="flex justify-between items-center gap-4">
                            <div className="flex-1">
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Status</label>
                                <select
                                    name="status"
                                    defaultValue={contractor.status}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="ACTIVE">Aktywny</option>
                                    <option value="IN_REVIEW">Wycena</option>
                                    <option value="INACTIVE">Zablokowany</option>
                                </select>
                            </div>
                            <div className="pt-5">
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className="bg-slate-900 text-white px-6 py-2 rounded-md hover:bg-slate-800 transition disabled:opacity-50 font-bold"
                                >
                                    {isPending ? "..." : "Zapisz Dane Główne"}
                                </button>
                            </div>
                        </div>
                    </form>

                    {/* SEKCJA OBIEKTÓW */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Store className="w-4 h-4 text-blue-600" />
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Obiekty / Lokalizacje (Magazyny)</h3>
                        </div>
                        
                        <div className="space-y-2">
                            {contractor.objects.map((obj) => (
                                <div key={obj.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 group">
                                    {editingObjectId === obj.id ? (
                                        <div className="flex items-center gap-2">
                                            <input 
                                                autoFocus
                                                value={tempObjectName}
                                                onChange={(e) => setTempObjectName(e.target.value)}
                                                className="flex-1 border border-blue-400 rounded px-2 py-1 text-sm bg-white"
                                            />
                                            <button 
                                                onClick={() => handleObjectUpdate(obj.id)}
                                                className="bg-blue-600 text-white text-xs px-2 py-1 rounded"
                                            >
                                                OK
                                            </button>
                                            <button 
                                                onClick={() => setEditingObjectId(null)}
                                                className="text-xs text-slate-500 px-1"
                                            >
                                                X
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-3 h-3 text-slate-400" />
                                                <span className="text-sm font-semibold text-slate-700">{obj.name}</span>
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    setEditingObjectId(obj.id)
                                                    setTempObjectName(obj.name)
                                                }}
                                                className="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-blue-600 uppercase transition-all px-2 py-1 border border-blue-200 rounded-lg hover:bg-blue-50 bg-white"
                                            >
                                                Zmień Nazwę
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <p className="text-[10px] text-slate-400 italic">
                            * Nazwy te pojawiają się w menu wyboru przy tworzeniu nowych Projektów.
                        </p>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="text-slate-500 hover:text-slate-800 font-medium text-sm"
                        >
                            Zamknij Panel
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
