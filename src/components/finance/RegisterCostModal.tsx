"use client"

import { useState, useEffect, useRef } from "react"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlusCircle, Building2 } from "lucide-react"
import { addCostInvoice } from "@/app/actions/invoices"
import type { SanitizedOcrDraft } from "@/lib/schemas/ocr-draft"

interface Project { id: string; name: string; contractorId?: string }
interface Contractor { id: string; name: string; nip?: string | null }

interface RegisterCostModalProps {
    projects: Project[]
    contractors: Contractor[]
    ocrData?: SanitizedOcrDraft
    lockedProjectId?: string
    trigger?: React.ReactNode
}

export function RegisterCostModal({ projects, contractors, ocrData, lockedProjectId, trigger }: RegisterCostModalProps) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    // Form State
    const [amountNet, setAmountNet] = useState("")
    const [taxRate, setTaxRate] = useState("0.23")
    const [amountVat, setAmountVat] = useState("")
    const [issueDate, setIssueDate] = useState("")
    const [dueDate, setDueDate] = useState("")
    const [selectedContractorId, setSelectedContractorId] = useState<string>("")
    const [selectedProjectId, setSelectedProjectId] = useState<string>(lockedProjectId || "NONE")
    const [description, setDescription] = useState("")
    const [retainedAmount, setRetainedAmount] = useState("")
    const [retentionReleaseDate, setRetentionReleaseDate] = useState("")

    // New Contractor State
    const [isNewContractor, setIsNewContractor] = useState(false)
    const [newContractorName, setNewContractorName] = useState("")
    const [newContractorNip, setNewContractorNip] = useState("")
    const [newContractorAddress, setNewContractorAddress] = useState("")

    const lastOcrRef = useRef<SanitizedOcrDraft | undefined>(undefined)

    useEffect(() => {
        if (lockedProjectId && projects.length > 0) {
            setSelectedProjectId(lockedProjectId)
            const project = projects.find(p => p.id === lockedProjectId)
            if (project?.contractorId) {
                setSelectedContractorId(project.contractorId)
            }
        }
    }, [lockedProjectId, projects])

    // --- LOGIKA OCR AUTO-FILL ---
    useEffect(() => {
        if (ocrData && ocrData !== lastOcrRef.current) {
            lastOcrRef.current = ocrData

            setAmountNet((ocrData.netAmountCents / 100).toFixed(2))
            setTaxRate(ocrData.vatRate || "0.23")
            setAmountVat((ocrData.vatAmountCents / 100).toFixed(2))
            if (ocrData.issueDate) setIssueDate(ocrData.issueDate)
            if (ocrData.dueDate) setDueDate(ocrData.dueDate)
            if (ocrData.invoiceNumber) setDescription(`Faktura nr ${ocrData.invoiceNumber}`)

            // Szukanie kontrahenta po NIP
            if (ocrData.nip) {
                const found = contractors.find(c => c.nip === ocrData.nip)
                if (found) {
                    setSelectedContractorId(found.id)
                    setIsNewContractor(false)
                } else {
                    setSelectedContractorId("")
                    setIsNewContractor(true)
                    setNewContractorName(ocrData.parsedName || "")
                    setNewContractorNip(ocrData.nip)
                    // @ts-ignore - address might not be in the type but could be in ocrData
                    setNewContractorAddress(ocrData.address || "")
                }
            }

            setOpen(true)
        }
    }, [ocrData, contractors])

    // --- MATH LOGIC ---
    useEffect(() => {
        if (amountNet) {
            const net = parseFloat(amountNet)
            const rate = parseFloat(taxRate)
            const vat = (net * rate).toFixed(2)
            setAmountVat(vat)
        }
    }, [amountNet, taxRate])

    const amountGross = (parseFloat(amountNet || "0") + parseFloat(amountVat || "0")).toFixed(2)

    // --- HANDLERS ---
    async function handleSubmit(formData: FormData) {
        setIsLoading(true)
        formData.set("amountGross", amountGross)
        
        if (isNewContractor) {
            formData.set("isNewContractor", "true")
            formData.set("newContractorName", newContractorName)
            formData.set("newContractorNip", newContractorNip)
            formData.set("newContractorAddress", newContractorAddress)
            formData.set("contractorId", "")
        } else {
            formData.set("isNewContractor", "false")
            formData.set("contractorId", selectedContractorId)
        }

        formData.set("projectId", selectedProjectId)
        formData.set("retainedAmount", retainedAmount)
        formData.set("retentionReleaseDate", retentionReleaseDate)

        try {
            const result = await addCostInvoice(formData)
            if (result.success) {
                setOpen(false)
                resetForm()
            }
        } catch (error) {
            alert(error instanceof Error ? error.message : "Błąd zapisu.")
        } finally {
            setIsLoading(false)
        }
    }

    const resetForm = () => {
        setAmountNet(""); setAmountVat(""); setSelectedContractorId(""); setDescription("")
        setIsNewContractor(false); setNewContractorName(""); setNewContractorNip(""); setNewContractorAddress("")
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button className="bg-orange-500 hover:bg-orange-600 text-white gap-2 shadow-lg active:scale-95">
                        <PlusCircle className="h-4 w-4" /> Dodaj Koszt
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[650px] rounded-2xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">Dodaj Koszt</DialogTitle>
                    <DialogDescription>Wpisz dane netto – VAT i brutto wyliczymy za Ciebie.</DialogDescription>
                </DialogHeader>

                <form action={handleSubmit} className="space-y-5">
                    <input type="hidden" name="type" value="KOSZT" />

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label className="text-slate-700 font-semibold text-xs uppercase">Netto</Label>
                                <Input type="number" step="0.01" name="amountNet" value={amountNet} onChange={(e) => setAmountNet(e.target.value)} required className="h-11 font-mono" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-700 font-semibold text-xs uppercase">VAT %</Label>
                                <Select name="taxRate" value={taxRate} onValueChange={(v) => setTaxRate(v || "0.23")}>
                                    <SelectTrigger className="h-11 bg-white"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0.23">23%</SelectItem>
                                        <SelectItem value="0.08">8%</SelectItem>
                                        <SelectItem value="0.00">0%</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-700 font-semibold text-xs uppercase text-slate-400">Kwota VAT</Label>
                                <Input value={amountVat} readOnly className="h-11 bg-transparent font-mono" />
                            </div>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-dashed">
                            <span className="text-sm font-medium text-slate-500 tracking-tight">DO ZAPŁATY (BRUTTO)</span>
                            <span className="text-2xl font-black text-rose-600 font-mono">{amountGross}</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {lockedProjectId ? (
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
                                <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
                                    <Building2 className="w-6 h-6 text-rose-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-[10px] font-bold text-rose-600 uppercase tracking-widest bg-rose-50 px-1.5 py-0.5 rounded">Projekt i Kontrahent</span>
                                    </div>
                                    <p className="text-base font-bold text-slate-900 truncate">
                                        {projects.find(p => p.id === lockedProjectId)?.name || "Projekt"}
                                    </p>
                                    <p className="text-sm text-slate-500 truncate font-medium">
                                        Firma: {contractors.find(c => c.id === (projects.find(p => p.id === lockedProjectId)?.contractorId || selectedContractorId))?.name || "Nieznany"}
                                    </p>
                                </div>
                                <input type="hidden" name="projectId" value={lockedProjectId} />
                                <input type="hidden" name="contractorId" value={projects.find(p => p.id === lockedProjectId)?.contractorId || selectedContractorId} />
                            </div>
                        ) : (
                            <>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="font-semibold">Sprzedawca / Dostawca *</Label>
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="sm" 
                                            className="text-xs text-blue-600 h-7"
                                            onClick={() => setIsNewContractor(!isNewContractor)}
                                        >
                                            {isNewContractor ? "Wybierz z listy" : "+ Dodaj nowego"}
                                        </Button>
                                    </div>

                                    {!isNewContractor ? (
                                        <Select name="contractorId" value={selectedContractorId} onValueChange={(v) => setSelectedContractorId(v || "")} required={!isNewContractor}>
                                            <SelectTrigger className="h-12 border-slate-200">
                                                <SelectValue placeholder="Wybierz firmę ze słownika" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {contractors.map((c) => (
                                                    <SelectItem key={c.id} value={c.id}>{c.name} {c.nip ? `(NIP: ${c.nip})` : ""}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <div className="space-y-3 p-4 bg-blue-50/50 border border-blue-100 rounded-xl animate-in fade-in slide-in-from-top-2">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] uppercase font-bold text-slate-500">Nazwa firmy *</Label>
                                                    <Input 
                                                        placeholder="np. Demetrix Sp. z o.o." 
                                                        value={newContractorName} 
                                                        onChange={(e) => setNewContractorName(e.target.value)}
                                                        className="bg-white"
                                                        required={isNewContractor}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] uppercase font-bold text-slate-500">NIP</Label>
                                                    <Input 
                                                        id="cost-new-contractor-nip"
                                                        name="newContractorNip"
                                                        autoComplete="off"
                                                        placeholder="10 cyfr" 
                                                        value={newContractorNip} 
                                                        onChange={(e) => setNewContractorNip(e.target.value)}
                                                        className="bg-white font-mono"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase font-bold text-slate-500">Adres (Ulica, Kod, Miasto)</Label>
                                                <Input
                                                    id="cost-new-contractor-address"
                                                    name="newContractorAddress"
                                                    autoComplete="off"
                                                    placeholder="ul. Słoneczna 1, 00-001 Warszawa" 
                                                    value={newContractorAddress} 
                                                    onChange={(e) => setNewContractorAddress(e.target.value)}
                                                    className="bg-white"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label>Projekt</Label>
                                    <Select 
                                        name="projectId" 
                                        value={selectedProjectId} 
                                        onValueChange={(v) => setSelectedProjectId(v || "NONE")}
                                    >
                                        <SelectTrigger className="h-12 border-slate-200">
                                            <SelectValue placeholder="Wybierz projekt" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="NONE">Brak</SelectItem>
                                            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Data Faktury</Label><Input type="date" name="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required /></div>
                            <div className="space-y-2"><Label>Termin Płatności</Label><Input type="date" name="dueDate" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required /></div>
                        </div>

                        <div className="space-y-2">
                            <Label>Kategoria</Label>
                            <Select name="category" defaultValue="MATERIAŁY">
                                <SelectTrigger className="h-12 border-slate-200">
                                    <SelectValue placeholder="Wybierz kategorię" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="MATERIAŁY">Materiały</SelectItem>
                                    <SelectItem value="ROBOCIZNA">Usługi obce</SelectItem>
                                    <SelectItem value="PALIWO">Paliwo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Opis / Nr Faktury</Label>
                            <Textarea name="description" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[60px]" />
                        </div>

                        {/* Kaucja Gwarancyjna section */}
                        <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                                <Label className="text-indigo-900 font-bold text-xs uppercase tracking-wider">Kaucja Gwarancyjna (Opcjonalnie)</Label>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="retainedAmount" className="text-[10px] text-indigo-700 font-bold">KWOTA KAUCJI (PLN)</Label>
                                    <Input
                                        id="retainedAmount"
                                        name="retainedAmount"
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={retainedAmount}
                                        onChange={(e) => setRetainedAmount(e.target.value)}
                                        className="h-9 border-indigo-200 focus:ring-indigo-500 bg-white/50 text-sm font-mono"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="retentionReleaseDate" className="text-[10px] text-indigo-700 font-bold">TERMIN ZWROTU</Label>
                                    <Input
                                        id="retentionReleaseDate"
                                        name="retentionReleaseDate"
                                        type="date"
                                        value={retentionReleaseDate}
                                        onChange={(e) => setRetentionReleaseDate(e.target.value)}
                                        className="h-9 border-indigo-200 focus:ring-indigo-500 bg-white/50 text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            <input type="checkbox" id="isPaidImmediately" name="isPaidImmediately" value="true" className="w-5 h-5 text-orange-500 rounded border-slate-300 focus:ring-orange-500 cursor-pointer" />
                            <Label htmlFor="isPaidImmediately" className="text-sm font-bold text-slate-800 cursor-pointer">
                                Opłacono natychmiast (Dodaje Cash Flow)
                            </Label>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="flex-1">Anuluj</Button>
                        <Button type="submit" disabled={isLoading || (!selectedContractorId && !isNewContractor)} className="flex-1 bg-slate-900 text-white">
                            {isLoading ? "Przetwarzanie..." : "Księguj Fakturę"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}