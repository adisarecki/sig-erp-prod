"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { addCostInvoice } from "@/app/actions/invoices"
import { ContractorSearch } from "./ContractorSearch"
import type { SanitizedOcrDraft } from "@/lib/schemas/ocr-draft"
import { COST_CATEGORIES } from "@/lib/categories"
import { toast } from "sonner"
import { Loader2, PlusCircle, ScanText, AlertTriangle, FileCheck, ShieldAlert } from "lucide-react"
import { scanInvoiceAction } from "@/app/actions/ocr"
import { BankStatusBadge } from "@/components/ui/BankStatusBadge"
import { type Contractor, type BankAccountInfo, type Project, type Vehicle } from "@/lib/types/crm"

interface RegisterCostModalProps {
    projects: Project[]
    contractors: Contractor[]
    vehicles?: Vehicle[]
    ocrData?: SanitizedOcrDraft
    lockedProjectId?: string
    trigger?: React.ReactNode
}

export function RegisterCostModal({ projects, contractors, vehicles = [], ocrData, lockedProjectId, trigger }: RegisterCostModalProps) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    // Form State
    const [amountNet, setAmountNet] = useState("")
    const [taxRate, setTaxRate] = useState("0.23")
    const [amountVat, setAmountVat] = useState("")
    const [issueDate, setIssueDate] = useState("")
    const [dueDate, setDueDate] = useState("")
    const [selectedContractorId, setSelectedContractorId] = useState<string>("")
    const [selectedProjectId, setSelectedProjectId] = useState<string>(lockedProjectId || "GENERAL")
    const [description, setDescription] = useState("")
    const [retainedAmount, setRetainedAmount] = useState("")
    const [retentionReleaseDate, setRetentionReleaseDate] = useState("")
    const [category, setCategory] = useState("MATERIAŁY")
    const [isNewContractor, setIsNewContractor] = useState(false)
    const [bankAccountNumber, setBankAccountNumber] = useState("")
    const [isPaidImmediately, setIsPaidImmediately] = useState(true)
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>("NONE")
    const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER")

    const [newContractorName, setNewContractorName] = useState("")
    const [newContractorNip, setNewContractorNip] = useState("")
    const [newContractorAddress, setNewContractorAddress] = useState("")
    const [selectedContractorAccounts, setSelectedContractorAccounts] = useState<BankAccountInfo[]>([])
    const [verifiedAccounts, setVerifiedAccounts] = useState<string[]>([])

    // OCR & Duplicate States (DNA Vector 020)
    const [isScanning, setIsScanning] = useState(false)
    const [isDuplicate, setIsDuplicate] = useState(false)
    const [duplicateId, setDuplicateId] = useState<string | undefined>(undefined)
    const [invoiceNumber, setInvoiceNumber] = useState("")
    const fileInputRef = useRef<HTMLInputElement>(null)

    const lastOcrRef = useRef<SanitizedOcrDraft | undefined>(undefined)

    useEffect(() => {
        if (lockedProjectId && projects.length > 0) {
            setSelectedProjectId(lockedProjectId)
        }
    }, [lockedProjectId, projects])

    useEffect(() => {
        if (!selectedProjectId || selectedProjectId === "GENERAL" || selectedProjectId === "INTERNAL") {
            setCategory(COST_CATEGORIES.INDIRECT[0].value) // np. BIURO
        } else {
            setCategory(COST_CATEGORIES.DIRECT[0].value) // np. MATERIAŁY
        }
    }, [selectedProjectId])

    // Manual VAT and Retention Calculation
    useEffect(() => {
        if (amountNet) {
            const net = parseFloat(amountNet)
            const rate = parseFloat(taxRate)
            const vat = (net * rate).toFixed(2)
            setAmountVat(vat)

            // Vector 117: Auto-Retention Calculation (Subcontractors)
            const isSubcontractorCost = !["GENERAL", "INTERNAL"].includes(selectedProjectId);
            if (isSubcontractorCost && (category === "MONTAŻ" || category === "USŁUGA" || category === "PROJEKT")) {
                const project = projects.find(p => p.id === selectedProjectId)
                if (project) {
                    const shortRate = project.retentionShortTermRate ?? 0
                    const longRate = project.retentionLongTermRate ?? 0
                    const totalRate = shortRate + longRate
                    
                    const gross = net + parseFloat(vat)
                    const baseAmount = project.retentionBase === 'GROSS' ? gross : net
                    const calculatedRetention = (baseAmount * totalRate).toFixed(2)
                    setRetainedAmount(calculatedRetention)
                }
            }
        } else {
            setAmountVat("")
            setRetainedAmount("")
        }
    }, [amountNet, taxRate, selectedProjectId, category, projects])

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
            if (ocrData.bankAccountNumber) setBankAccountNumber(ocrData.bankAccountNumber)

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
                    setNewContractorAddress(ocrData.address || "")
                }
            }

            setOpen(true)
        }
    }, [ocrData, contractors])
    
    // --- VECTOR 160: AUTO-SUGGESTION FOR POS / RETAIL / CASH INVOICES ---
    // If issueDate === dueDate (or category implies immediate payment), auto-set as paid by card/cash
    useEffect(() => {
        // Categories that are always POS/cash transactions (no credit period)
        const POS_CATEGORIES = ["FLOTA", "PALIWO", "KOSZT_FIRMOWY", "PALIWO_PROJEKT", "BIURO", "KOSZTY_OGOLNE", "INNE"]
        
        const isPos = POS_CATEGORIES.includes(category)
        
        if (isPos && issueDate && !dueDate) {
            // Auto-fill dueDate = issueDate for POS categories (they're immediate by definition)
            setDueDate(issueDate)
        }

        if (issueDate && dueDate && issueDate === dueDate) {
            if (isPos || dueDate === issueDate) {
                setIsPaidImmediately(true)
                // Default to CARD for POS, CASH for fuel (covers both Orlen POS and manual receipts)
                if (paymentMethod === "BANK_TRANSFER") {
                    setPaymentMethod(category === "PALIWO" || category === "PALIWO_PROJEKT" ? "CASH" : "CARD")
                }
            }
        }
    }, [issueDate, dueDate, category])

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
    // --- OCR SCANNER ACTION (GEMINI 3 FLASH) ---
    const handleOcrClick = () => fileInputRef.current?.click()

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsScanning(true)
        setIsDuplicate(false)
        setDuplicateId(undefined)

        try {
            const reader = new FileReader()
            reader.readAsDataURL(file)
            reader.onload = async () => {
                const base64 = (reader.result as string).split(",")[1]
                const mimeType = file.type

                const result = await scanInvoiceAction(base64, mimeType)
                if (result.success && result.data) {
                    const d = result.data
                    setAmountNet(d.netAmount)
                    setAmountVat(d.vatAmount)
                    setTaxRate(d.vatRate || "0.23")
                    setIssueDate(d.issueDate)
                    setDueDate(d.dueDate)
                    setInvoiceNumber(d.invoiceNumber)
                    setDescription(`Faktura nr ${d.invoiceNumber}`)
                    if (d.bankAccountNumber) setBankAccountNumber(d.bankAccountNumber)

                    if (d.contractorId) {
                        setSelectedContractorId(d.contractorId)
                        setIsNewContractor(false)
                    } else if (d.nip) {
                        setIsNewContractor(true)
                        setNewContractorName(d.parsedName)
                        setNewContractorNip(d.nip)
                        setSelectedContractorId("")
                    }

                    if (d.isDuplicate) {
                        setIsDuplicate(true)
                        setDuplicateId(d.duplicateId)
                        toast.warning("Wykryto duplikat faktury!")
                    } else {
                        toast.success("Dokument przeanalizowany pomyślnie.")
                    }
                } else {
                    toast.error(result.error || "Nie udało się rozpoznać dokumentu.")
                }
                setIsScanning(false)
            }
        } catch (err) {
            console.error(err)
            toast.error("Błąd przesyłania pliku.")
            setIsScanning(false)
        }
    }

    async function handleSubmit(formData: FormData) {
        setIsLoading(true)
        formData.set("amountGross", amountGross)
        formData.set("externalId", invoiceNumber) // Sync with externalId

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

        if (verifiedAccounts.length > 0) {
            formData.set("verifiedAccounts", JSON.stringify(verifiedAccounts))
        }

        formData.set("projectId", selectedProjectId)
        formData.set("retainedAmount", retainedAmount)
        formData.set("retentionReleaseDate", retentionReleaseDate)
        formData.set("bankAccountNumber", bankAccountNumber)
        formData.set("isPaidImmediately", isPaidImmediately ? "true" : "false")
        formData.set("paymentMethod", paymentMethod)
        if (selectedVehicleId && selectedVehicleId !== "NONE") {
            formData.set("vehicleId", selectedVehicleId)
        }

        try {
            const result = await addCostInvoice(formData)
            if (result.success) {
                toast.success("Faktura została pomyślnie zaksięgowana.")
                router.refresh()
                setOpen(false)
                resetForm()
            } else {
                toast.error(result.error || "Wystąpił błąd podczas księgowania faktury.")
                console.error("[FORM_SUBMIT_ERROR]", result.error)
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Błąd krytyczny połączenia.")
            console.error("[CRITICAL_SUBMIT_ERROR]", error)
        } finally {
            setIsLoading(false)
        }
    }


    const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        
        // --- MANUALNA WALIDACJA UX ---
        if (!amountNet) { toast.error("Zanim zapiszesz, podaj kwotę netto."); return; }
        if (!issueDate || !dueDate) { toast.error("Daty faktury i płatności są wymagane."); return; }
        if (!selectedContractorId && !isNewContractor) { toast.error("Wybierz kontrahenta z listy lub dodaj nowego."); return; }
        if (isNewContractor && !newContractorName) { toast.error("Podaj nazwę nowego kontrahenta."); return; }
        if (isNewContractor && newContractorNip && newContractorNip.replace(/\D/g, '').length !== 10) { 
            toast.error("NIP musi składać się z dokładnie 10 cyfr."); 
            return; 
        }

        const formData = new FormData(e.currentTarget)
        handleSubmit(formData)
    }

    const resetForm = () => {
        setAmountNet(""); setAmountVat(""); setSelectedContractorId(""); setDescription("")
        setIsNewContractor(false); setNewContractorName(""); setNewContractorNip(""); setNewContractorAddress("")
        setCategory((!selectedProjectId || selectedProjectId === "GENERAL" || selectedProjectId === "INTERNAL") ? COST_CATEGORIES.INDIRECT[0].value : COST_CATEGORIES.DIRECT[0].value)
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
            <DialogContent className="max-w-none sm:max-w-[650px] rounded-2xl h-[92vh] sm:h-auto overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                    <div className="flex items-center justify-between pr-8">
                        <div>
                            <DialogTitle className="text-2xl font-bold">Dodaj Koszt</DialogTitle>
                            <DialogDescription>Wpisz dane netto – VAT i brutto wyliczymy za Ciebie.</DialogDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileChange} 
                                className="hidden" 
                                accept="image/*,application/pdf"
                            />
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={handleOcrClick}
                                disabled={isScanning}
                                className="bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-bold gap-2 animate-in fade-in"
                            >
                                {isScanning ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <ScanText className="h-4 w-4" />
                                )}
                                {isScanning ? "Skanowanie..." : "Skanuj Fakturę"}
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                {isDuplicate && (
                    <div className="bg-rose-50 border-2 border-rose-200 p-4 rounded-xl flex items-center gap-4 animate-in slide-in-from-top-4">
                        <div className="bg-rose-100 p-2 rounded-full text-rose-600">
                            <AlertTriangle className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-black text-rose-900 uppercase text-xs tracking-widest">KRYTYCZNY: Tarcza Anty-Duplikatowa</h4>
                            <p className="text-sm text-rose-700 font-medium">Faktura o numerze <b>{invoiceNumber}</b> od tego kontrahenta istnieje już w systemie (ID: {duplicateId}). Zapis zablokowany.</p>
                        </div>
                    </div>
                )}

                <form onSubmit={handleFormSubmit} className="space-y-5">
                    <input type="hidden" name="type" value="KOSZT" />

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label className="text-slate-700 font-semibold text-xs uppercase">Netto</Label>
                                <Input type="number" step="0.01" name="amountNet" value={amountNet} onChange={(e) => setAmountNet(e.target.value)} className="h-11 font-mono" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-700 font-semibold text-xs uppercase">VAT %</Label>
                                <Select name="taxRate" value={taxRate} onValueChange={(v) => setTaxRate(v || "0.23")}>
                                    <SelectTrigger className="h-11 bg-white" onPointerDown={(e) => e.stopPropagation()}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[70vh] overflow-y-auto">
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
                                    <ContractorSearch 
                                        contractors={contractors}
                                        onSelect={(c) => {
                                            if (c) {
                                                setSelectedContractorId(c.id)
                                                setIsNewContractor(false)
                                                const accounts = c.bankAccounts || []
                                                setSelectedContractorAccounts(accounts)
                                                
                                                // Auto-fill if exactly 1 account
                                                if (accounts.length === 1) {
                                                    const accNum = typeof accounts[0] === 'string' ? accounts[0] : accounts[0].accountNumber
                                                    setBankAccountNumber(accNum)
                                                }
                                            }
                                        }}
                                        onManualEntry={(name, nip, address, accounts) => {
                                            setIsNewContractor(true)
                                            setNewContractorName(name)
                                            setNewContractorNip(nip)
                                            setNewContractorAddress(address)
                                            setSelectedContractorId("")
                                            if (accounts) {
                                                setVerifiedAccounts(accounts)
                                                // Auto-fill if only 1
                                                if (accounts.length === 1) {
                                                    setBankAccountNumber(accounts[0])
                                                }
                                            } else {
                                                setVerifiedAccounts([])
                                            }
                                        }}
                                        initialValue={isNewContractor ? newContractorName : ""}
                                        initialNip={isNewContractor ? newContractorNip : ""}
                                        initialAddress={isNewContractor ? newContractorAddress : ""}
                                    />

                                {lockedProjectId ? (
                                    <input type="hidden" name="projectId" value={lockedProjectId} />
                                ) : (
                                    <div className="space-y-2">
                                        <Label>Projekt</Label>
                                        <Select
                                            name="projectId"
                                            value={selectedProjectId}
                                            onValueChange={(v) => setSelectedProjectId(v || "GENERAL")}
                                        >
                                            <SelectTrigger className="h-12 border-slate-200" onPointerDown={(e) => e.stopPropagation()}>
                                                <SelectValue placeholder="Wybierz projekt" />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-[70vh] overflow-y-auto">
                                                <SelectItem value="GENERAL" className="font-semibold text-blue-700 bg-blue-50 focus:bg-blue-100">
                                                    🏢 [Koszty Ogólne Firmy]
                                                </SelectItem>
                                                <SelectItem value="INTERNAL" className="font-semibold text-slate-700 bg-slate-100 focus:bg-slate-200 border-b border-slate-200 mb-1">
                                                    🔒 [Koszty Własne]
                                                </SelectItem>
                                                {projects
                                                    .filter(p => !lockedProjectId && p.status !== "CLOSED")
                                                    .map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label className="text-slate-700 font-bold flex items-center gap-2">
                                        🚗 Przypisany Pojazd / Maszyna
                                        <span className="text-[10px] text-slate-400 font-normal uppercase tracking-widest">(Opcjonalnie)</span>
                                    </Label>
                                    <Select
                                        name="vehicleId"
                                        value={selectedVehicleId}
                                        onValueChange={(v) => setSelectedVehicleId(v || "NONE")}
                                    >
                                        <SelectTrigger className="h-12 border-slate-200 bg-white" onPointerDown={(e) => e.stopPropagation()}>
                                            <SelectValue placeholder="Wybierz pojazd z floty" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[70vh] overflow-y-auto">
                                            <SelectItem value="NONE" className="text-slate-400 italic">Brak (Koszty ogólne)</SelectItem>
                                            {vehicles.map(v => (
                                                <SelectItem key={v.id} value={v.id}>
                                                    <span className="font-bold mr-2">[{v.plates}]</span> {v.make} {v.model}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Numer Faktury</Label>
                                <Input 
                                    name="invoiceNumber" 
                                    value={invoiceNumber} 
                                    onChange={(e) => {
                                        setInvoiceNumber(e.target.value)
                                        setDescription(`Faktura nr ${e.target.value}`)
                                    }} 
                                    placeholder="Np. 123/2026"
                                    className={isDuplicate ? "border-rose-500 bg-rose-50" : ""}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Data Faktury</Label>
                                <Input type="date" name="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-slate-700 font-semibold text-xs uppercase text-slate-400">Numer Konta Bankowego</Label>
                                {bankAccountNumber && selectedContractorAccounts.length > 0 && (
                                    <BankStatusBadge 
                                        isVerified={selectedContractorAccounts.some(acc => {
                                            const accNum = typeof acc === 'string' ? acc : acc.accountNumber;
                                            return accNum.replace(/\s/g, "") === bankAccountNumber.replace(/\s/g, "");
                                        })} 
                                        size="sm"
                                        showLabel={false}
                                    />
                                )}
                            </div>
                            
                            {(selectedContractorAccounts.length > 1 || verifiedAccounts.length > 1) ? (
                                <Select
                                    value={bankAccountNumber}
                                    onValueChange={(val) => setBankAccountNumber(val || "")}
                                >
                                    <SelectTrigger className="h-11 bg-white border-blue-200">
                                        <SelectValue placeholder="Wybierz konto z Wykazu MF" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(selectedContractorAccounts.length > 1 ? selectedContractorAccounts : verifiedAccounts.map(a => ({ accountNumber: a }))).map((acc: any) => {
                                            const accNum = typeof acc === 'string' ? acc : acc.accountNumber;
                                            return (
                                                <SelectItem key={accNum} value={accNum}>
                                                    {accNum.replace(/(.{2})/g, "$1 ")}
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <div className="relative">
                                    <Input 
                                        name="bankAccountNumber" 
                                        value={bankAccountNumber} 
                                        onChange={(e) => setBankAccountNumber(e.target.value)}
                                        placeholder="Wpisz lub wybierz numer konta"
                                        className="font-mono text-sm h-11 pr-10 bg-white"
                                    />
                                    {(selectedContractorAccounts.length > 0 || verifiedAccounts.length > 0) && (
                                        <div className="absolute right-3 top-3 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
                                            <span className="text-[9px] text-emerald-700 font-black tracking-tighter uppercase">MF OK</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {bankAccountNumber.replace(/\s/g, "").length > 10 && 
                             (selectedContractorAccounts.length > 0 || verifiedAccounts.length > 0) && 
                             ![...selectedContractorAccounts.map(a => a.accountNumber), ...verifiedAccounts].some(accNum => 
                                 accNum.replace(/\s/g, "") === bankAccountNumber.replace(/\s/g, "")
                             ) && (
                                <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1 animate-pulse">
                                    <ShieldAlert className="w-3 h-3" /> UWAGA: Tego konta brak na Białej Liście MF!
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Termin Płatności</Label>
                            <Input type="date" name="dueDate" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                        </div>

                        <div className="space-y-2">
                            <Label>Kategoria</Label>
                            <Select name="category" value={category} onValueChange={(v) => setCategory(v || COST_CATEGORIES.INDIRECT[0].value)}>
                                <SelectTrigger className="h-12 border-slate-200" onPointerDown={(e) => e.stopPropagation()}>
                                    <SelectValue placeholder="Wybierz kategorię" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[70vh] overflow-y-auto">
                                    {(!selectedProjectId || selectedProjectId === "GENERAL" || selectedProjectId === "INTERNAL")
                                        ? COST_CATEGORIES.INDIRECT.map(cat => (
                                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                        ))
                                        : COST_CATEGORIES.DIRECT.map(cat => (
                                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                        ))
                                    }
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-slate-700 font-bold">Opis / Tytuł wydatku</Label>
                            <Textarea name="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Np. Paliwo do busa, Zakup materiałów..." className="min-h-[60px] border-slate-300 shadow-sm" />
                        </div>

                        {/* Kaucja Gwarancyjna (Conditional) */}
                        {category === "INWESTYCJA" && (
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
                        )}

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="checkbox" 
                                        id="isPaidImmediately" 
                                        checked={isPaidImmediately} 
                                        onChange={(e) => setIsPaidImmediately(e.target.checked)}
                                        className="w-5 h-5 text-orange-500 rounded border-slate-300 focus:ring-orange-500 cursor-pointer" 
                                    />
                                    <Label htmlFor="isPaidImmediately" className="text-sm font-bold text-slate-800 cursor-pointer">
                                        {(issueDate === dueDate && ["FLOTA", "PALIWO", "KOSZT_FIRMOWY"].includes(category)) 
                                            ? "ZAPŁACONO GOTÓWKĄ/KARTĄ (RETAIL)" 
                                            : "Opłacono natychmiast (Cash Flow)"}
                                    </Label>
                                </div>
                                <div className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded">
                                    VECTOR 118.1 ACTIVE
                                </div>
                            </div>
                            
                            {isPaidImmediately && (
                                <div className="pt-2 border-t border-slate-200">
                                    <Label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block tracking-widest">Metoda Płatności</Label>
                                    <div className="flex gap-2">
                                        {['BANK_TRANSFER', 'CARD', 'CASH'].map((method) => (
                                            <Button
                                                key={method}
                                                type="button"
                                                variant={paymentMethod === method ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => setPaymentMethod(method)}
                                                className={`flex-1 text-[10px] font-bold h-8 ${paymentMethod === method ? 'bg-slate-900' : 'bg-white border-slate-200 text-slate-600'}`}
                                            >
                                                {method === 'BANK_TRANSFER' ? 'PRZELEW' : method === 'CARD' ? 'KARTA' : 'GOTÓWKA'}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="flex-1">Anuluj</Button>
                        <Button 
                            type="submit" 
                            disabled={isLoading || isScanning || isDuplicate || (!selectedContractorId && !isNewContractor)} 
                            className={`flex-1 font-bold h-11 ${isDuplicate ? 'bg-slate-300' : 'bg-slate-900 text-white'}`}
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Przetwarzanie...
                                </span>
                            ) : isDuplicate ? (
                                <span className="flex items-center gap-2">
                                    <FileCheck className="h-4 w-4" />
                                    Duplikat Zablokowany
                                </span>
                            ) : (
                                "Księguj Fakturę"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}