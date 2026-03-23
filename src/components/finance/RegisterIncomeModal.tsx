"use client"

import { useState, useEffect, useRef } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { addIncomeInvoice } from "@/app/actions/invoices"
import { ContractorSearch } from "./ContractorSearch"
import type { SanitizedOcrDraft } from "@/lib/schemas/ocr-draft"
import { toast } from "sonner"
import { Loader2, TrendingUp, Building2 } from "lucide-react"

interface Project {
    id: string
    name: string
    contractorId?: string
}

interface Contractor {
    id: string
    name: string
    nip?: string | null
}

interface RegisterIncomeModalProps {
    projects: Project[]
    contractors: Contractor[]
    ocrData?: SanitizedOcrDraft
    lockedProjectId?: string
    trigger?: React.ReactNode
}

export function RegisterIncomeModal({ projects, contractors, ocrData, lockedProjectId, trigger }: RegisterIncomeModalProps) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    const [amountNet, setAmountNet] = useState("")
    const [taxRate, setTaxRate] = useState("0.23")
    const [amountVat, setAmountVat] = useState("")
    const [retainedAmount, setRetainedAmount] = useState("")
    const [retentionReleaseDate, setRetentionReleaseDate] = useState("")
    const [selectedProjectId, setSelectedProjectId] = useState<string>(lockedProjectId || "GENERAL")
    const [selectedContractorId, setSelectedContractorId] = useState<string>("")

    const [newContractorName, setNewContractorName] = useState("")
    const [isNewContractor, setIsNewContractor] = useState(false)
    const [newContractorNip, setNewContractorNip] = useState("")
    const [newContractorAddress, setNewContractorAddress] = useState("")
    const [category, setCategory] = useState("USŁUGA")

    // Track last OCR data to detect new scans
    const lastOcrRef = useRef<SanitizedOcrDraft | undefined>(undefined)

    // Auto-fill from OCR data when it arrives
    useEffect(() => {
        if (ocrData && ocrData !== lastOcrRef.current) {
            lastOcrRef.current = ocrData
            // Data from Master API is in cents, format back to string for input UI
            setAmountNet((ocrData.netAmountCents / 100).toFixed(2))
            setTaxRate(ocrData.vatRate || "0.23")
            setAmountVat((ocrData.vatAmountCents / 100).toFixed(2))
            if (ocrData.issueDate) setIssueDate(ocrData.issueDate)
            if (ocrData.dueDate) setDueDate(ocrData.dueDate)
            setOpen(true)
        }
    }, [ocrData])

    useEffect(() => {
        if (lockedProjectId) {
            setSelectedProjectId(lockedProjectId)
        }
    }, [lockedProjectId])

    useEffect(() => {
        if (amountNet) {
            const net = parseFloat(amountNet)
            const rate = parseFloat(taxRate)
            const vat = (net * rate).toFixed(2)
            setAmountVat(vat)
        } else {
            setAmountVat("")
        }
    }, [amountNet, taxRate])

    const amountGross = (parseFloat(amountNet || "0") + parseFloat(amountVat || "0")).toFixed(2)

    const [issueDate, setIssueDate] = useState("")
    const [dueDate, setDueDate] = useState("")

    // Initialize dates on client side to prevent hydration mismatch
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0]
        const d = new Date()
        d.setDate(d.getDate() + 14)
        const inTwoWeeks = d.toISOString().split('T')[0]
        
        setIssueDate(today)
        setDueDate(inTwoWeeks)
    }, [])

    useEffect(() => {
        if (issueDate) {
            const d = new Date(issueDate)
            d.setDate(d.getDate() + 14)
            setDueDate(d.toISOString().split('T')[0])
        }
    }, [issueDate])

    // Auto-fill contractor when project is locked
    useEffect(() => {
        if (lockedProjectId && projects.length > 0) {
            setSelectedProjectId(lockedProjectId)
            const project = projects.find(p => p.id === lockedProjectId)
            if (project?.contractorId) {
                setSelectedContractorId(project.contractorId)
            }
        }
    }, [lockedProjectId, projects])

    const resetForm = () => {
        setAmountNet("")
        setAmountVat("")
        setSelectedContractorId("")
        setSelectedProjectId(lockedProjectId || "GENERAL")
        setIsNewContractor(false)
        setNewContractorName("")
        setNewContractorNip("")
        setNewContractorAddress("")
    }

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

        try {
            const result = await addIncomeInvoice(formData)
            if (result.success) {
                toast.success("Przychód został pomyślnie dodany.")
                setOpen(false)
                resetForm()
            } else {
                toast.error(result.error || "Błąd podczas zapisywania przychodu.")
                console.error("[INCOME_SUBMIT_ERROR]", result.error)
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "Błąd połączenia."
            toast.error(msg)
            console.error("[CRITICAL_INCOME_ERROR]", error)
        } finally {
            setIsLoading(false)
        }
    }


    const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        
        if (!amountNet) { toast.error("Zanim zapiszesz, podaj kwotę netto."); return; }
        if (!issueDate || !dueDate) { toast.error("Daty są wymagane."); return; }
        
        if (!isNewContractor && !selectedContractorId) {
            toast.error("Wybierz kontrahenta z listy lub dodaj nowego.");
            return;
        }

        if (isNewContractor && !newContractorName) {
            toast.error("Podaj nazwę nowego kontrahenta.");
            return;
        }

        const formData = new FormData(e.currentTarget)
        handleSubmit(formData)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 transition-all active:scale-95">
                        <TrendingUp className="h-4 w-4" />
                        Dodaj Przychód
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent
                className="sm:max-w-[600px] rounded-2xl border-slate-200"
                onInteractOutside={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-slate-900">Dodaj Przychód</DialogTitle>
                    <DialogDescription className="text-slate-500">
                        Faktura sprzedażowa / Wpływ. Wpisz dane netto – system wyliczy VAT i brutto automatycznie.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleFormSubmit} className="space-y-5 mt-2">
                    <input type="hidden" name="type" value="PRZYCHÓD" />
                    
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="amountNet" className="text-slate-700 font-semibold">Kwota Netto *</Label>
                                <Input
                                    id="amountNet"
                                    name="amountNet"
                                    type="number"
                                    inputMode="decimal"
                                    step="0.01"
                                    placeholder="0.00"
                                    required
                                    value={amountNet}
                                    onChange={(e) => setAmountNet(e.target.value)}
                                    className="h-11 border-slate-200 focus:ring-green-500 font-mono text-base"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="taxRate" className="text-slate-700 font-semibold">Stawka VAT *</Label>
                                <Select name="taxRate" value={taxRate} onValueChange={(val) => { if (val) setTaxRate(val) }}>
                                    <SelectTrigger className="h-11 border-slate-200 bg-white" onPointerDown={(e) => e.stopPropagation()}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0.23">23%</SelectItem>
                                        <SelectItem value="0.08">8%</SelectItem>
                                        <SelectItem value="0.05">5%</SelectItem>
                                        <SelectItem value="0.00">0% (zw. / np.)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="amountVat" className="text-slate-700 font-semibold text-slate-500">Kwota VAT</Label>
                                <Input
                                    id="amountVat"
                                    name="amountVat"
                                    type="number"
                                    inputMode="decimal"
                                    step="0.01"
                                    value={amountVat}
                                    onChange={(e) => setAmountVat(e.target.value)}
                                    className="h-11 border-slate-200 bg-transparent text-slate-600 font-mono text-base"
                                />
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-3 border-t border-slate-200 border-dashed">
                            <span className="font-semibold text-slate-600">Suma Brutto (PLN):</span>
                            <span className="text-2xl font-black text-green-700 font-mono">{amountGross}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="date" className="text-slate-700 font-semibold">Data Wystawienia *</Label>
                            <Input
                                id="date"
                                name="date"
                                type="date"
                                value={issueDate}
                                onChange={(e) => setIssueDate(e.target.value)}
                                required
                                className="h-11 border-slate-200"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dueDate" className="text-slate-700 font-semibold">Termin Płatności *</Label>
                            <Input
                                id="dueDate"
                                name="dueDate"
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                required
                                className="h-11 border-slate-200"
                            />
                        </div>
                    </div>

                    <div className="grid gap-4">
                        {lockedProjectId ? (
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
                                <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
                                    <Building2 className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-1.5 py-0.5 rounded">Powiązany Projekt</span>
                                    </div>
                                    <p className="text-base font-bold text-slate-900 truncate">
                                        {projects.find(p => p.id === lockedProjectId)?.name || "Projekt"}
                                    </p>
                                    <p className="text-sm text-slate-500 truncate font-medium">
                                        Klient: {contractors.find(c => c.id === (projects.find(p => p.id === lockedProjectId)?.contractorId || selectedContractorId))?.name || "Nieznany"}
                                    </p>
                                </div>
                                <input type="hidden" name="projectId" value={lockedProjectId} />
                                <input type="hidden" name="contractorId" value={projects.find(p => p.id === lockedProjectId)?.contractorId || selectedContractorId} />
                            </div>
                        ) : (
                            <>
                                    <ContractorSearch 
                                        contractors={contractors}
                                        onSelect={(c) => {
                                            if (c) {
                                                setSelectedContractorId(c.id)
                                                setIsNewContractor(false)
                                            } else {
                                                setSelectedContractorId("")
                                            }
                                        }}
                                        onManualEntry={(name, nip, address) => {
                                            setIsNewContractor(true)
                                            setNewContractorName(name)
                                            setNewContractorNip(nip)
                                            setNewContractorAddress(address)
                                            setSelectedContractorId("")
                                        }}
                                        initialValue={isNewContractor ? newContractorName : ""}
                                        initialNip={isNewContractor ? newContractorNip : ""}
                                        initialAddress={isNewContractor ? newContractorAddress : ""}
                                    />
                                <div className="space-y-2">
                                    <Label htmlFor="projectId" className="text-slate-700 font-semibold">Projekt (Wymagane) *</Label>
                                    <Select 
                                        name="projectId" 
                                        value={selectedProjectId} 
                                        onValueChange={(v) => setSelectedProjectId(v || "GENERAL")} 
                                        required={false}
                                    >
                                        <SelectTrigger className="min-h-[50px] h-auto text-base border-slate-200" onPointerDown={(e) => e.stopPropagation()}>
                                            <SelectValue placeholder="Wybierz projekt" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="GENERAL" className="font-semibold text-blue-700 bg-blue-50 focus:bg-blue-100 mb-1">
                                                🏢 [Koszty Ogólne Firmy]
                                            </SelectItem>
                                            <SelectItem value="INTERNAL" className="font-semibold text-slate-700 bg-slate-100 focus:bg-slate-200 border-b border-slate-200 mb-2">
                                                🔒 [Koszty Własne]
                                            </SelectItem>
                                            {projects.map((p) => (
                                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="category" className="text-slate-700 font-semibold">Kategoria *</Label>
                        <Select name="category" value={category} onValueChange={(v) => setCategory(v || "USŁUGA")}>
                            <SelectTrigger className="min-h-[50px] h-auto text-base border-slate-200" onPointerDown={(e) => e.stopPropagation()}>
                                <SelectValue placeholder="Wybierz kategorię" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="USŁUGA">Usługa Inżynieryjna</SelectItem>
                                <SelectItem value="SPRZEDAŻ_TOWARU">Sprzedaż Towaru</SelectItem>
                                <SelectItem value="INWESTYCJA">Realizacja Inwestycji (Kaucjonowana)</SelectItem>
                                <SelectItem value="ZALICZKA">Zaliczka</SelectItem>
                                <SelectItem value="INNE">Inne zyski</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description" className="text-slate-700 font-semibold">Opis / Nr Faktury (Opcjonalnie)</Label>
                        <Textarea
                            id="description"
                            name="description"
                            placeholder="Np. FV 12/2026 za realizację etapu..."
                            className="min-h-[80px] border-slate-200"
                        />
                    </div>

                    {/* Kaucja Gwarancyjna (Conditional) */}
                    {(category === "INWESTYCJA") && (
                        <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                                <Label className="text-indigo-900 font-bold text-xs uppercase tracking-wider">Skarbiec Kaucji (Opcjonalnie)</Label>
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

                    <div className="flex items-center gap-2 pt-2">
                        <input type="checkbox" id="isPaidImmediately" name="isPaidImmediately" value="true" defaultChecked={true} className="w-5 h-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer" />
                        <Label htmlFor="isPaidImmediately" className="text-sm font-bold text-slate-800 cursor-pointer">
                            Opłacono natychmiast (Dodaje Cash Flow)
                        </Label>
                    </div>

                    <DialogFooter className="pt-4 border-t border-slate-100 flex gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            className="flex-1 min-h-[50px] text-base"
                        >
                            Anuluj
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11"
                        >
                            {isLoading ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Zapisywanie...
                                </div>
                            ) : (
                                "Dodaj Przychód"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
