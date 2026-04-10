import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from "@/components/ui/dialog"
import { updateContractor, updateObject } from "@/app/actions/crm"
import { getGusDataByNip } from "@/app/actions/gus"
import { Pencil, Store, MapPin, Check, X, Loader2, Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface ObjectItem {
    id: string
    name: string
}

interface Contractor {
    id: string
    name: string
    nip: string | null
    address: string | null
    type: string
    status: string
    objects: ObjectItem[]
}

export function EditContractorModal({ contractor }: { contractor: Contractor }) {
    const [open, setOpen] = useState(false)
    const [isPending, setIsPending] = useState(false)
    
    // Inline Edit State
    const [editingObjectId, setEditingObjectId] = useState<string | null>(null)
    const [tempObjectName, setTempObjectName] = useState("")
    const [localObjects, setLocalObjects] = useState<ObjectItem[]>(contractor.objects)
    const [isUpdatingObject, setIsUpdatingObject] = useState<string | null>(null)
    const [gusLoading, setGusLoading] = useState(false)
    const [successFlash, setSuccessFlash] = useState(false)

    // Form State (Controlled)
    const [editFormData, setEditFormData] = useState({
        name: contractor.name,
        nip: contractor.nip || "",
        address: contractor.address || "",
        status: contractor.status,
        type: contractor.type
    })

    // Sync local objects when prop changes (e.g. after full refresh)
    useEffect(() => {
        setLocalObjects(contractor.objects)
        setEditFormData({
            name: contractor.name,
            nip: contractor.nip || "",
            address: contractor.address || "",
            status: contractor.status,
            type: contractor.type
        })
    }, [contractor])

    async function handleGusFetch() {
        if (editFormData.nip.length !== 10) return

        setGusLoading(true)
        try {
            const res = await getGusDataByNip(editFormData.nip)
            if (res.success && res.data) {
                setEditFormData(prev => ({
                    ...prev,
                    name: res.data.name,
                    address: res.data.address
                }))
                setSuccessFlash(true)
                setTimeout(() => setSuccessFlash(false), 2000)
            }
        } catch (error) {
            console.error("GUS Fetch Error:", error)
        } finally {
            setGusLoading(false)
        }
    }

    const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        const newVal = name === "nip" ? value.replace(/[^0-9]/g, "").slice(0, 10) : value
        
        setEditFormData(prev => ({
            ...prev,
            [name]: newVal
        }))

        // Auto-fetch logic for Edit modal too
        if (name === "nip" && newVal.length === 10) {
            // We can't call handleGusFetch directly here easily with the latest state, 
            // but we can use an effect.
        }
    }

    // Auto-trigger GUS fetch on 10th digit
    useEffect(() => {
        if (editFormData.nip.length === 10 && editFormData.nip !== contractor.nip) {
            handleGusFetch()
        }
    }, [editFormData.nip])

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setIsPending(true)
        
        const formData = new FormData()
        formData.append("id", contractor.id)
        formData.append("name", editFormData.name)
        formData.append("nip", editFormData.nip)
        formData.append("address", editFormData.address)
        formData.append("status", editFormData.status)
        formData.append("type", editFormData.type)

        try {
            const res = await updateContractor(formData)
            if (res?.error) {
                alert(res.error)
            } else {
                setOpen(false)
            }
        } catch (error) {
            console.error(error)
            alert("Wystąpił nieoczekiwany błąd komunikacji.")
        } finally {
            setIsPending(false)
        }
    }

    async function handleObjectUpdate(id: string) {
        if (!tempObjectName.trim()) return
        
        const originalObjects = [...localObjects]
        const oldName = originalObjects.find(o => o.id === id)?.name || ""

        // Optimistic UI Update
        setLocalObjects(prev => prev.map(obj => 
            obj.id === id ? { ...obj, name: tempObjectName } : obj
        ))
        setEditingObjectId(null)
        setIsUpdatingObject(id)

        const formData = new FormData()
        formData.append("id", id)
        formData.append("name", tempObjectName)
        
        try {
            const res = await updateObject(formData)
            if (res?.error) {
                setLocalObjects(originalObjects)
                alert(res.error)
            }
        } catch (error) {
            // Rollback on failure
            setLocalObjects(originalObjects)
            console.error("Critical object update error:", error)
        } finally {
            setIsUpdatingObject(null)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
        if (e.key === 'Enter') {
            handleObjectUpdate(id)
        } else if (e.key === 'Escape') {
            setEditingObjectId(null)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button className="text-slate-400 hover:text-blue-600 transition p-2 rounded-full hover:bg-blue-50">
                    <Pencil className="w-4 h-4" />
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto border-none shadow-2xl rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black text-slate-900 uppercase tracking-tight">Edytuj Dane Firmy</DialogTitle>
                    <DialogDescription className="text-slate-500 font-medium">
                        Zarządzaj klasyfikacją i lokalizacjami tej firmy.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                    <form onSubmit={handleSubmit} className="space-y-4 pb-6 border-b border-slate-100">
                        <input type="hidden" name="id" value={contractor.id} />
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Nazwa firmy *</label>
                                <input
                                    name="name"
                                    required
                                    value={editFormData.name}
                                    onChange={handleEditChange}
                                    className={cn(
                                        "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all bg-slate-50/50",
                                        successFlash && "bg-green-50 ring-2 ring-green-400 border-green-500"
                                    )}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">NIP</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            id={`edit-nip-${contractor.id}`}
                                            name="nip"
                                            value={editFormData.nip}
                                            onChange={handleEditChange}
                                            autoComplete="off"
                                            maxLength={10}
                                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono transition-all bg-slate-50/50 pr-10"
                                        />
                                        {gusLoading && (
                                            <div className="absolute right-3 top-2.5">
                                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleGusFetch()}
                                        disabled={gusLoading || editFormData.nip.length < 10}
                                        className="bg-slate-100 p-2 rounded-xl border border-slate-200 hover:bg-slate-200 transition disabled:opacity-50"
                                        title="Pobierz dane z GUS"
                                    >
                                        <Search className="w-5 h-5 text-slate-600" />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Typ Biznesowy</label>
                                <select
                                    name="type"
                                    value={editFormData.type}
                                    onChange={handleEditChange}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 bg-blue-50 text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-black uppercase text-xs transition-all"
                                >
                                    <option value="INWESTOR">Inwestor</option>
                                    <option value="DOSTAWCA">Dostawca</option>
                                    <option value="HURTOWNIA">Hurtownia</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Adres siedziby</label>
                            <input
                                id={`edit-address-${contractor.id}`}
                                name="address"
                                value={editFormData.address}
                                onChange={handleEditChange}
                                autoComplete="off"
                                className={cn(
                                    "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all bg-slate-50/50",
                                    successFlash && "bg-green-50 ring-2 ring-green-400 border-green-500"
                                )}
                            />
                        </div>

                        <div className="flex justify-between items-center gap-4 pt-2">
                            <div className="flex-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Status</label>
                                <select
                                    name="status"
                                    value={editFormData.status}
                                    onChange={handleEditChange}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm transition-all"
                                >
                                    <option value="ACTIVE">Aktywny</option>
                                    <option value="IN_REVIEW">Wycena</option>
                                    <option value="INACTIVE">Zablokowany</option>
                                </select>
                            </div>
                            <div className="pt-5 pb-1">
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className="bg-slate-900 text-white px-8 py-2.5 rounded-xl hover:bg-blue-600 transition-all disabled:opacity-50 font-black uppercase text-xs tracking-widest shadow-lg shadow-slate-200 active:scale-95"
                                >
                                    {isPending ? "Zapis..." : "Zapisz Dane Grupy"}
                                </button>
                            </div>
                        </div>
                    </form>

                    {/* SEKCJA OBIEKTÓW */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 bg-blue-100 rounded-lg">
                                <Store className="w-4 h-4 text-blue-600" />
                            </div>
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.15em]">Obiekty / Lokalizacje</h3>
                        </div>
                        
                        <div className="space-y-2">
                            {localObjects.map((obj) => (
                                <div key={obj.id} className="bg-white border border-slate-100 rounded-2xl p-4 group transition-all hover:border-blue-200 hover:shadow-md relative overflow-hidden">
                                    {isUpdatingObject === obj.id && (
                                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10">
                                            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                                        </div>
                                    )}

                                    {editingObjectId === obj.id ? (
                                        <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-200">
                                            <div className="flex-1 relative">
                                                <input 
                                                    autoFocus
                                                    value={tempObjectName}
                                                    onKeyDown={(e) => handleKeyDown(e, obj.id)}
                                                    onChange={(e) => setTempObjectName(e.target.value)}
                                                    className="w-full border-2 border-blue-400 rounded-xl px-3 py-1.5 text-sm font-bold bg-white text-slate-800 focus:outline-none shadow-inner"
                                                />
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <button 
                                                    onClick={() => handleObjectUpdate(obj.id)}
                                                    className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                                    title="Zatwierdź (Enter)"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => setEditingObjectId(null)}
                                                    className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                                                    title="Anuluj (Esc)"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-center">
                                            <div 
                                                className="flex items-center gap-3 cursor-pointer group/item flex-1"
                                                onClick={() => {
                                                    setEditingObjectId(obj.id)
                                                    setTempObjectName(obj.name)
                                                }}
                                            >
                                                <div className="p-2 bg-slate-50 rounded-lg group-hover/item:bg-blue-50 transition-colors">
                                                    <MapPin className="w-4 h-4 text-slate-400 group-hover/item:text-blue-500" />
                                                </div>
                                                <span className="text-sm font-bold text-slate-700 group-hover/item:text-blue-600 transition-colors">
                                                    {obj.name}
                                                </span>
                                                <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover/item:opacity-100 transition-all ml-1" />
                                            </div>
                                            
                                            <button 
                                                onClick={() => {
                                                    setEditingObjectId(obj.id)
                                                    setTempObjectName(obj.name)
                                                }}
                                                className="opacity-0 group-hover:opacity-100 text-[10px] font-black text-blue-600 uppercase tracking-widest transition-all px-3 py-1.5 border border-blue-100 rounded-xl hover:bg-blue-600 hover:text-white bg-slate-50 shadow-sm"
                                            >
                                                Edytuj
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-2">
                            * Nazwy obiektów są kluczowe przy tworzeniu budżetów projektowych.
                        </p>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="text-slate-400 hover:text-slate-800 font-black text-[10px] uppercase tracking-[0.2em] transition-colors"
                        >
                            Zamknij Panel
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
