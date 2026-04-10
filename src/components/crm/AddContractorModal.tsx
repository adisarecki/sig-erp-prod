"use client"

import { useState, useEffect } from "react"
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
import { fetchGusData } from "@/app/actions/gus"
import { Loader2, Search, ShieldCheck, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { VatStatusBadge } from "@/components/ui/VatStatusBadge"
import { BankStatusBadge } from "@/components/ui/BankStatusBadge"
import type { VatStatus } from "@/app/actions/vat"

export function AddContractorModal() {
    const [open, setOpen] = useState(false)
    const [isPending, setIsPending] = useState(false)
    const [gusLoading, setGusLoading] = useState(false)
    const [successFlash, setSuccessFlash] = useState(false)
    const [lastFetchedNip, setLastFetchedNip] = useState<string | null>(null)
    const [vatStatus, setVatStatus] = useState<VatStatus | null>(null)
    const [accountNumbers, setAccountNumbers] = useState<string[]>([])

    // Form State (Controlled)
    const [formDataObj, setFormDataObj] = useState({
        name: "",
        nip: "",
        address: "",
        bankAccount: "",
        status: "ACTIVE",
        type: "INWESTOR"
    })

    // Auto-trigger GUS fetch on 10th digit
    useEffect(() => {
        const cleanNip = formDataObj.nip.replace(/[^0-9]/g, "")
        if (cleanNip.length === 10) {
            handleGusFetch(cleanNip)
        }
    }, [formDataObj.nip])

    async function handleGusFetch(targetNip?: string) {
        const nipToFetch = targetNip || formDataObj.nip.replace(/[^0-9]/g, "")
        if (nipToFetch.length !== 10) return

        setGusLoading(true)
        try {
            const res = await fetchGusData(nipToFetch)
            if (res.success && res.data) {
                setFormDataObj(prev => ({
                    ...prev,
                    name: res.data.name,
                    address: res.data.address,
                    bankAccount: (res.data.accountNumbers && res.data.accountNumbers.length === 1) ? res.data.accountNumbers[0] : prev.bankAccount
                }))
                setLastFetchedNip(nipToFetch)
                setVatStatus(res.data.vatStatus ?? null)
                setAccountNumbers(res.data.accountNumbers ?? [])
                setSuccessFlash(true)
                setTimeout(() => setSuccessFlash(false), 2000)
            }
        } catch (error) {
            console.error("GUS Fetch Error:", error)
        } finally {
            setGusLoading(false)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        
        if (name === "nip") {
            const cleanVal = value.replace(/[^0-9]/g, "")
            // If NIP is changing and it differs from the one we just fetched, clear the name/address
            if (lastFetchedNip && cleanVal !== lastFetchedNip) {
                setFormDataObj(prev => ({
                    ...prev,
                    nip: cleanVal,
                    name: "",
                    address: "",
                    bankAccount: ""
                }))
                setLastFetchedNip(null)
                setVatStatus(null)
                setAccountNumbers([])
                return
            }
            
            setFormDataObj(prev => ({
                ...prev,
                nip: cleanVal
            }))
            return
        }

        setFormDataObj(prev => ({
            ...prev,
            [name]: value
        }))
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setIsPending(true)
        
        const formData = new FormData()
        formData.append("name", formDataObj.name)
        formData.append("nip", formDataObj.nip)
        formData.append("address", formDataObj.address)
        formData.append("bankAccount", formDataObj.bankAccount)
        formData.append("status", formDataObj.status)
        formData.append("type", formDataObj.type)

        try {
            const res = await addContractor(formData)
            if (res?.error) {
                alert(res.error)
            } else {
                setOpen(false)
                // Reset form
                setFormDataObj({
                    name: "",
                    nip: "",
                    address: "",
                    bankAccount: "",
                    status: "ACTIVE",
                    type: "INWESTOR"
                })
            }
        } catch (error) {
            console.error(error)
            alert("Wystąpił nieoczekiwany błąd przy dodawaniu kontrahenta.")
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

                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="relative">
                        <label className="text-sm font-semibold text-slate-700 block mb-1">NIP (10 cyfr)</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input
                                    id="contractor-nip-add"
                                    name="nip"
                                    value={formDataObj.nip}
                                    onChange={handleChange}
                                    maxLength={10}
                                    autoComplete="off"
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                                    placeholder="5260001222"
                                />
                                {gusLoading && (
                                    <div className="absolute right-3 top-2.5">
                                        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                                    </div>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => handleGusFetch()}
                                disabled={gusLoading || formDataObj.nip.length < 10}
                                className="bg-slate-100 p-2 rounded-md border border-slate-300 hover:bg-slate-200 transition disabled:opacity-50"
                                title="Pobierz dane z GUS"
                            >
                                <Search className="w-5 h-5 text-slate-600" />
                            </button>
                        </div>
                    </div>

                    {/* VAT Status Badge */}
                    {vatStatus && (
                        <div className="flex items-center gap-2 px-1">
                            <VatStatusBadge status={vatStatus} size="md" />
                            {accountNumbers.length > 0 && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                    {accountNumbers.length} konto{accountNumbers.length !== 1 ? "a" : ""} w Wykazie MF
                                </span>
                            )}
                            {accountNumbers.length === 0 && vatStatus === "Czynny" && (
                                <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
                                    <ShieldAlert className="w-3 h-3" /> Brak kont w Wykazie MF
                                </span>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="text-sm font-semibold text-slate-700 block mb-1">Nazwa firmy *</label>
                        {gusLoading ? (
                            <div className="w-full h-10 bg-slate-100 animate-pulse rounded-md border border-slate-200" />
                        ) : (
                            <input
                                name="name"
                                value={formDataObj.name}
                                onChange={handleChange}
                                required
                                className={cn(
                                    "w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-500",
                                    successFlash && "bg-green-50 ring-2 ring-green-400 border-green-500"
                                )}
                                placeholder="np. Demetrix"
                            />
                        )}
                    </div>

                    <div>
                        <label className="text-sm font-semibold text-slate-700 block mb-1">Adres siedziby</label>
                        {gusLoading ? (
                            <div className="w-full h-10 bg-slate-100 animate-pulse rounded-md border border-slate-200" />
                        ) : (
                            <input
                                id="contractor-address-add"
                                name="address"
                                value={formDataObj.address}
                                onChange={handleChange}
                                autoComplete="off"
                                className={cn(
                                    "w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-500",
                                    successFlash && "bg-green-50 ring-2 ring-green-400 border-green-500"
                                )}
                                placeholder="ul. Słoneczna 1, Siemianowice"
                            />
                        )}
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-sm font-semibold text-slate-700 block">Numer konta bankowego</label>
                            {accountNumbers.length > 0 && (
                                <BankStatusBadge 
                                    isVerified={accountNumbers.includes(formDataObj.bankAccount.replace(/\s/g, ""))} 
                                    showLabel={false} 
                                />
                            )}
                        </div>
                        {gusLoading ? (
                            <div className="w-full h-10 bg-slate-100 animate-pulse rounded-md border border-slate-200" />
                        ) : accountNumbers.length > 1 ? (
                            <select
                                name="bankAccount"
                                value={formDataObj.bankAccount}
                                onChange={handleChange}
                                className="w-full border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">-- Wybierz konto z Wykazu MF --</option>
                                {accountNumbers.map(acc => (
                                    <option key={acc} value={acc}>{acc.replace(/(.{2})/g, "$1 ")}</option>
                                ))}
                            </select>
                        ) : (
                            <div className="space-y-1.5">
                                <input
                                    name="bankAccount"
                                    value={formDataObj.bankAccount}
                                    onChange={handleChange}
                                    className={cn(
                                        "w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-500",
                                        successFlash && accountNumbers.length === 1 && "bg-green-50 ring-2 ring-green-400 border-green-500"
                                    )}
                                    placeholder="00 0000 0000 0000 0000 0000 0000"
                                />
                                {!accountNumbers.includes(formDataObj.bankAccount.replace(/\s/g, "")) && formDataObj.bankAccount.length > 10 && (
                                    <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1 animate-pulse">
                                        <ShieldAlert className="w-3 h-3" /> UWAGA: Tego konta brak na Białej Liście MF!
                                    </p>
                                )}
                            </div>
                        )}
                        {!gusLoading && accountNumbers.length > 0 && (
                            <p className="text-[10px] text-slate-500 mt-1 italic">
                                {accountNumbers.length === 1 
                                    ? "Konto automatycznie pobrane i zweryfikowane w Wykazie MF." 
                                    : "Wykryto wiele kont. Wybierz właściwe z listy powyżej."}
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="text-sm font-semibold text-slate-700 block mb-1">Status Współpracy</label>
                        <select
                            name="status"
                            value={formDataObj.status}
                            onChange={handleChange}
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
                            value={formDataObj.type}
                            onChange={handleChange}
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