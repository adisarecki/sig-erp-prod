"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
    ScanLine, Upload, AlertTriangle, Loader2, Sparkles, 
    Save, Trash2, Edit3, CheckCircle2, XCircle, Archive, History
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { OcrInvoiceData } from "@/lib/ocr/types"
import { getAutoMatchData, addCostInvoice, addIncomeInvoice, checkDuplicateInvoice, bulkCommitToAudit } from "@/app/actions/invoices"
import { getProjects } from "@/app/actions/projects"
import { getContractors, autoCreateContractorWithGus } from "@/app/actions/crm"
import { COST_CATEGORIES } from "@/lib/categories"
import { calculateReconciledTotals, mapToFinancialItem } from "@/lib/finance/coreMath"

interface QueueItem extends OcrInvoiceData {
    id: string
    status: "PENDING" | "VALIDATING" | "VALID" | "ERROR" | "SAVING" | "SUCCESS"
    validationError?: string
    projectId: string
    category: string
    autoMatched?: {
        project?: boolean
        category?: boolean
    }
    // Quick Add Phase 10
    isNewProject?: boolean
    newProjectName?: string
    isNewContractorOverride?: boolean
    newContractorNameOverride?: string
    contractorId?: string | null
    vehicleId?: string | null
    duplicateId?: string
}
import type { Vehicle } from "@/lib/types/crm"

export function InvoiceScanner({ vehicles = [] }: { vehicles?: Vehicle[] }) {
    const [open, setOpen] = useState(false)
    const [dragActive, setDragActive] = useState(false)
    const [files, setFiles] = useState<File[]>([])
    const [scannerState, setScannerState] = useState<"IDLE" | "OCR_PROCESSING" | "INBOX" | "ERROR">("IDLE")
    const [error, setError] = useState<string | null>(null)
    const [queue, setQueue] = useState<QueueItem[]>([])
    const [editingIndex, setEditingIndex] = useState<number | null>(null)
    const [projects, setProjects] = useState<{ id: string, name: string }[]>([])
    const [contractors, setContractors] = useState<{ id: string, name: string, nip: string | null }[]>([])
    const [loadingProjects, setLoadingProjects] = useState(false)
    const [loadingContractors, setLoadingContractors] = useState(false)
    
    const inputRef = useRef<HTMLInputElement>(null)

    const resetState = useCallback(() => {
        setFiles([]); setScannerState("IDLE"); setError(null); setQueue([]); setEditingIndex(null); setDragActive(false)
    }, [])

    useEffect(() => {
        if (open && projects.length === 0 && !loadingProjects) {
            setLoadingProjects(true)
            getProjects().then(res => {
                setProjects(res.map(p => ({ id: p.id, name: p.name })))
                setLoadingProjects(false)
            }).catch(() => setLoadingProjects(false))
        }
        if (open && contractors.length === 0 && !loadingContractors) {
            setLoadingContractors(true)
            getContractors().then((res: any[]) => {
                setContractors(res.map((c: any) => ({ id: c.id, name: c.name, nip: c.nip ?? null })))
                setLoadingContractors(false)
            }).catch(() => setLoadingContractors(false))
        }
    }, [open, projects.length, contractors.length, loadingProjects, loadingContractors])

    const handleFileDetection = useCallback((newFiles: FileList | null) => {
        if (!newFiles) return
        const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
        const validFiles: File[] = []
        let hasInvalid = false

        Array.from(newFiles).forEach(f => {
            if (allowed.includes(f.type)) {
                validFiles.push(f)
            } else {
                hasInvalid = true
            }
        })

        if (hasInvalid && validFiles.length === 0) {
            setError("Dozwolone formaty: JPEG, PNG, PDF"); setScannerState("ERROR"); return
        }
        
        setError(null)
        setFiles(prev => [...prev, ...validFiles].slice(0, 5))
        setScannerState("IDLE")
    }, [])

    const handleScan = async () => {
        if (files.length === 0) return
        setScannerState("OCR_PROCESSING"); setError(null)
        const allItems: QueueItem[] = []
        try {
            for (const f of files) {
                const formData = new FormData(); formData.append("file", f)
                const response = await fetch("/api/ocr/scan", { method: "POST", body: formData })
                const text = await response.text()
                let result: { success: boolean, data?: OcrInvoiceData[], error?: string }; 
                try { result = JSON.parse(text) } catch { throw new Error("Błąd serwera (HTML)") }
                if (!response.ok || !result.success) throw new Error(result.error || `Błąd OCR dla pliku ${f.name}`)
                
                if (Array.isArray(result.data)) {
                    for (const data of result.data) {
                        const id = Math.random().toString(36).substring(7)
                        const isAutoPaid = data.isPaid || (data.issueDate === data.dueDate && data.dueDate !== null)

                        const item: QueueItem = {
                            ...data,
                            id,
                            status: isAutoPaid ? "VALID" : "PENDING",
                            projectId: "GENERAL",
                            category: data.type === "INCOME" ? "SPRZEDAŻ_TOWARU" : "KOSZT_FIRMOWY"
                        }

                        // Auto-Match logic
                        if (data.nip) {
                            const match = await getAutoMatchData(data.nip)
                            if (match) {
                                item.projectId = match.lastProjectId || "GENERAL"
                                item.contractorId = match.contractorId || ""
                                item.category = match.lastCategory || (data.type === "INCOME" ? "SPRZEDAŻ_TOWARU" : "KOSZT_FIRMOWY")
                                item.autoMatched = {
                                    project: !!match.lastProjectId,
                                    category: !!match.lastCategory
                                }
                            }
                            if (!item.contractorId) {
                                const newContractorId = await autoCreateContractorWithGus(data.nip)
                                if (newContractorId) {
                                    item.contractorId = newContractorId
                                }
                            }
                        }
                        // Asset Linking Integration (Vehicles/Keywords)
                        let vehicleId = null
                        if (data.licensePlate) {
                            const vMatch = vehicles.find(v => v.plates.replace(/\s/g, '').toUpperCase() === data.licensePlate?.replace(/\s/g, '').toUpperCase())
                            if (vMatch) vehicleId = vMatch.id
                        }
                        item.vehicleId = vehicleId

                        // Duplicate Check Pre-Save
                        if (data.invoiceNumber && data.nip) {
                            const dupCheck = await checkDuplicateInvoice(data.invoiceNumber, data.nip, data.grossAmount)
                            if (dupCheck.isDuplicate) {
                                item.isDuplicate = true
                                item.duplicateId = dupCheck.duplicateId
                            }
                        }

                        // Vector 180.11: "Pewniak" Auto-Verification Logic
                        const isKnownEntity = !!item.contractorId
                        const isAnchorBuyer = item.type === "COST"
                        const isVehicleMatched = !!item.vehicleId
                        if (isKnownEntity && isAnchorBuyer && isVehicleMatched && !item.isDuplicate) {
                            item.status = "VALID"
                        }

                        allItems.push(item)
                    }
                    setQueue(prev => [...prev, ...allItems])
                    setScannerState("INBOX")
                }
            }
        } catch (err: any) {
            setError(err.message)
            setScannerState("ERROR")
        }
    }

    const validateQueue = async (items: QueueItem[]) => {
        const updated = [...items]
        for (let i = 0; i < updated.length; i++) {
            const item = updated[i]
            const payload = {
                ...item,
                dueDate: item.dueDate || "",
                nip: item.nip?.replace(/\D/g, "") || null
            }
            try {
                const response = await fetch("/api/intake/ocr-draft", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                })
                const result = await response.json()
                if (response.ok) {
                    updated[i].status = "VALID"
                    updated[i].validationError = undefined
                } else {
                    updated[i].status = "ERROR"
                    updated[i].validationError = result.details ? result.details.map((d: { message: string }) => d.message).join(", ") : result.error
                }
            } catch {
                updated[i].status = "ERROR"
                updated[i].validationError = "Błąd komunikacji z walidatorem"
            }
        }
        setQueue([...updated])
    }

    const handleBulkApprove = async () => {
        const validItems = queue.filter(item => item.status === "VALID")
        if (validItems.length === 0) return
        
        setError(null)
        let successCount = 0
        const updatedQueue = [...queue]

        for (const item of validItems) {
            const idx = updatedQueue.findIndex(q => q.id === item.id)
            updatedQueue[idx].status = "SAVING"
            setQueue([...updatedQueue])

            const formData = new FormData()
            formData.append("amountNet", item.netAmount)
            formData.append("amountGross", item.grossAmount)
            formData.append("taxRate", item.vatRate)
            formData.append("date", item.issueDate)
            formData.append("dueDate", item.dueDate || item.issueDate)
            formData.append("category", item.category)
            formData.append("projectId", item.projectId)
            formData.append("description", item.invoiceNumber || "Skan OCR")
            
            // Seamless Save Phase 10
            if (item.isNewProject && item.newProjectName) {
                formData.append("isNewProject", "true")
                formData.append("newProjectName", item.newProjectName)
            }

            if (item.isNewContractorOverride || !item.contractorId) {
                formData.append("isNewContractor", "true") 
                formData.append("newContractorName", item.newContractorNameOverride || item.parsedName)
                formData.append("newContractorNip", item.nip)
            } else {
                formData.append("isNewContractor", "false")
                formData.append("contractorId", item.contractorId)
            }
            
            // Zero-Day Auto-Pay Logic
            const isAutoPaid = item.isPaid || (item.issueDate === item.dueDate && item.issueDate !== null)
            formData.append("isPaidImmediately", isAutoPaid ? "true" : "false")
            if (item.vehicleId) {
                formData.append("vehicleId", item.vehicleId)
            }
            if (item.rawOcrData) {
                formData.append("rawOcrData", JSON.stringify(item.rawOcrData))
            }

            // Vector 180.9: 2025 Audit Shield
            if (item.issueDate?.startsWith('2025')) {
                formData.append("isAudit", "true")
            }

            const action = item.type === "INCOME" ? addIncomeInvoice : addCostInvoice
            try {
                const result = await action(formData)
                if (result.success) {
                    updatedQueue[idx].status = "SUCCESS"
                    successCount++
                } else {
                    updatedQueue[idx].status = "ERROR"
                    updatedQueue[idx].validationError = result.error
                }
            } catch (err: unknown) {
                updatedQueue[idx].status = "ERROR"
                updatedQueue[idx].validationError = err instanceof Error ? err.message : "Błąd zapisu"
            }
            setQueue([...updatedQueue])
        }

        if (successCount === validItems.length) {
            setTimeout(() => {
                setOpen(false)
                resetState()
            }, 1500)
        }
    }

    const handleVaultToAudit = async (index: number) => {
        const item = queue[index];
        const updated = [...queue];
        updated[index].status = "SAVING";
        setQueue([...updated]);

        try {
            // Vector 180.9: 2025 Audit Shield
            const payload = {...item};
            if (item.issueDate?.startsWith('2025')) {
                (payload as any).isAudit = true;
            }
            const res = await bulkCommitToAudit([payload]);
            if (res.success) {
                updated[index].status = "SUCCESS";
                // Auto-remove after short delay
                setTimeout(() => {
                    setQueue(prev => prev.filter(q => q.id !== item.id));
                }, 2000);
            } else {
                updated[index].status = "ERROR";
                updated[index].validationError = res.error || "Błąd zapisu do Audytu";
            }
        } catch (err) {
            updated[index].status = "ERROR";
            updated[index].validationError = "Błąd komunikacji z serwerem";
        }
        setQueue([...updated]);
    }

    const updateItem = (index: number, data: Partial<QueueItem>) => {
        setQueue(prev => {
            const next = [...prev]
            next[index] = { ...next[index], ...data, status: "PENDING" }
            return next
        })
    }

    const removeItem = (index: number) => {
        setQueue(prev => prev.filter((_, i) => i !== index))
    }

    const currentEditingItem = editingIndex !== null ? queue[editingIndex] : null
    const someValid = queue.some(i => i.status === "VALID")

    // ─── VECTOR 200.25: HARDENED SIGNED MATH SUMMARY ──────────────────────────
    const liveSummary = useMemo(() => {
        if (queue.length === 0) return { vatSaldo: 0, citEstimate: 0, totalNet: 0 };
        
        // Vector 200: Use central mapping to ensure signed symmetry
        const signedItems = queue.map(item => mapToFinancialItem(
            item.type as any,
            item.netAmount,
            item.vatAmount,
            item.grossAmount
        ));
        
        const totals = calculateReconciledTotals(signedItems);
        
        return {
            vatSaldo: totals.totalVat,
            citEstimate: totals.estimatedCit,
            totalNet: totals.totalNet
        };
    }, [queue]);

    const { vatSaldo, citEstimate } = liveSummary;
    const isVatAsset = vatSaldo > 0; 

    return (
        <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetState(); }}>
            <DialogTrigger asChild>
                <Button className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2 shadow-lg active:scale-95 h-12 px-6 font-black uppercase tracking-wider rounded-xl">
                    <ScanLine className="h-5 w-5" /> Szybki Skan / Ingestion
                </Button>
            </DialogTrigger>
            <DialogContent className={`${scannerState === "INBOX" ? 'sm:max-w-[1000px]' : 'sm:max-w-[600px]'} max-h-[90vh] overflow-hidden flex flex-col p-0`}>
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="text-2xl font-bold flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <ScanLine className="text-cyan-600" /> 
                            {scannerState === "INBOX" ? `Kolejka Skanów (${queue.length})` : "Szybki Skan / Ingestion"}
                        </span>
                        {scannerState === "INBOX" && (
                                <div className={`flex flex-col items-end px-4 py-1.5 rounded-lg border ${vatSaldo > 0 ? 'bg-cyan-50 border-cyan-200' : 'bg-rose-50 border-rose-200'}`}>
                                    <span className={`text-[10px] font-bold uppercase tracking-tighter ${vatSaldo > 0 ? 'text-cyan-700' : 'text-rose-700'}`}>
                                        {vatSaldo > 0 ? 'NADPŁATA / ZWROT (Tarcza Fiskalna 🛡️)' : 'DO ZAPŁATY (Zobowiązanie 🔴)'}
                                    </span>
                                    <div className="text-lg font-black leading-tight">
                                        <CurrencyDisplay gross={vatSaldo} net={vatSaldo} intent={vatSaldo > 0 ? "tax-shield" : "cost"} hideSign={false} />
                                    </div>
                                </div>
                        )}
                        {scannerState === "INBOX" && (
                                <div className="flex flex-col gap-1">
                                    <Button variant="outline" size="sm" onClick={() => validateQueue(queue)} className="text-[9px] h-7 uppercase font-bold tracking-tight">
                                        Re-Waliduj
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setQueue(q => q.map(i => ({...i, status: 'VALID'})))} className="text-[9px] h-7 uppercase font-bold tracking-tight border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                                        Zatwierdź Wszystkie
                                    </Button>
                                </div>
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {scannerState === "INBOX" ? "Zweryfikuj wykryte dokumenty. Pola oznaczone gwiazdką zostały dopasowane automatycznie." : "Wgraj do 5 plików (PDF/JPG). Gemini wyodrębni dane z każdego wykrytego dokumentu."}
                    </DialogDescription>
                </DialogHeader>

                {scannerState === "INBOX" && queue.length > 0 && (
                    <div className="bg-slate-50 border-y border-slate-100 px-6 py-3 flex gap-6 items-center justify-between sticky top-0 z-10 shadow-sm">
                        <div className="flex gap-6">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">VAT Saldo</p>
                                <div className="text-sm font-black">
                                    <CurrencyDisplay 
                                        gross={vatSaldo} 
                                        net={vatSaldo} 
                                        intent={vatSaldo > 0 ? "tax-shield" : "cost"} 
                                        className="text-sm"
                                    />
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estymowany CIT (9%)</p>
                                <div className="text-sm font-black">
                                    <CurrencyDisplay 
                                        gross={citEstimate} 
                                        net={citEstimate} 
                                        intent={citEstimate > 0 ? "cost" : "tax-shield"} 
                                        className="text-sm"
                                    />
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Liczba Faktur</p>
                                <p className="text-sm font-black text-slate-700">{queue.length}</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setQueue([])} className="text-xs text-rose-500 hover:text-rose-600 font-bold uppercase tracking-tighter h-8">Wyczyść sesję</Button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-6 pt-2">
                    {scannerState === "IDLE" && (
                        <div
                            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${dragActive ? "border-cyan-400 bg-cyan-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100"}`}
                            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                            onDragLeave={() => setDragActive(false)}
                            onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFileDetection(e.dataTransfer.files); }}
                            onClick={() => inputRef.current?.click()}
                        >
                            <input ref={inputRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => handleFileDetection(e.target.files)} />
                            <Upload className="mx-auto w-8 h-8 text-cyan-600 mb-2" />
                            <p className="text-sm font-semibold">Kliknij lub przeciągnij pliki faktur</p>
                            <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG (max 5 plików)</p>
                            {files.length > 0 && (
                                <div className="mt-4 flex flex-wrap justify-center gap-2">
                                    {files.map((f, i) => (
                                        <span key={i} className="px-2 py-1 bg-cyan-100 text-cyan-700 rounded text-[10px] font-bold uppercase">{f.name}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {scannerState === "OCR_PROCESSING" && (
                        <div className="flex flex-col items-center py-10 gap-3">
                            <Loader2 className="animate-spin text-cyan-600 w-10 h-10" />
                            <p className="font-semibold text-slate-700 italic">Gemini analizuje dokumenty i dopasowuje kontrahentów...</p>
                        </div>
                    )}

                    {scannerState === "INBOX" && editingIndex === null && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {queue.map((item, idx) => (
                                <div key={item.id} className={`group relative p-4 rounded-2xl border-2 transition-all hover:shadow-md ${
                                    item.isDuplicate ? 'border-amber-400 bg-amber-50/30' :
                                    item.status === "ERROR" ? 'border-rose-200 bg-rose-50/30' : 
                                    item.status === "SUCCESS" ? 'border-emerald-200 bg-emerald-50/30' : 
                                    (item.autoMatched?.category || item.autoMatched?.project) ? 'border-emerald-100 bg-emerald-50/10 shadow-sm' : 
                                    'border-slate-100 bg-white'
                                }`}>
                                    <div className="absolute -top-2 -right-2 flex gap-1">
                                        {item.isDuplicate && (
                                            <div className="group/dup relative">
                                                <Badge className="bg-orange-500 text-white border-none text-[9px] font-bold shadow-sm cursor-help">🚨 POTENCJALNY DUPLIKAT</Badge>
                                                {item.duplicateId && (
                                                    <div className="absolute right-0 top-6 hidden group-hover/dup:block bg-slate-800 text-white text-[10px] p-2 rounded shadow-xl w-48 z-10 font-mono">
                                                        ID: {item.duplicateId}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {item.status === "VALID" && (item.issueDate === item.dueDate || item.isPaid) && (
                                            <Badge className="bg-emerald-500 text-white border-none text-[9px] font-bold">ZAPŁACONO (AUTO)</Badge>
                                        )}
                                        {item.status === "SUCCESS" && <CheckCircle2 className="w-5 h-5 text-emerald-500 bg-white rounded-full" />}
                                        {item.status === "ERROR" && (
                                            <div className="group/err relative">
                                                <XCircle className="w-5 h-5 text-red-500 bg-white rounded-full cursor-help" />
                                                <div className="absolute right-6 top-0 hidden group-hover/err:block bg-red-600 text-white text-[10px] p-2 rounded shadow-xl w-40 z-10">
                                                    {item.validationError}
                                                </div>
                                            </div>
                                        )}
                                        {item.type === "UNRECOGNIZED_ENTITY" && (
                                            <Badge className="bg-amber-500 text-white border-none text-[9px] font-bold shadow-sm">⚠️ NIEZIDENTYFIKOWANY</Badge>
                                        )}
                                        {item.licensePlate && (
                                            <Badge className="bg-slate-700 text-white border-none text-[9px] font-bold shadow-sm">🚗 {item.licensePlate}</Badge>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div className="flex flex-col max-w-[70%]">
                                                <span className="font-bold text-sm truncate">{item.parsedName}</span>
                                                <span className="text-[10px] text-slate-400 font-mono">{item.nip}</span>
                                            </div>
                                            <div className="text-right">
                                                <CurrencyDisplay 
                                                    gross={item.grossAmount} 
                                                    net={item.netAmount} 
                                                    intent={item.type === "INCOME" ? "income" : "cost"} 
                                                    className="text-lg"
                                                />
                                                <div className="text-[9px] text-slate-400 mt-1 uppercase tracking-tighter">{item.issueDate}</div>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 items-center text-[10px] font-bold uppercase tracking-wider mt-2">
                                            <button 
                                                onClick={() => updateItem(idx, { type: item.type === "INCOME" ? "COST" : "INCOME" })}
                                                className={`px-2 py-0.5 rounded border transition-colors hover:opacity-80 active:scale-95 ${item.type === "INCOME" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : item.type === "COST" ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-amber-100 text-amber-700 border-amber-200"}`}
                                            >
                                                {item.type === "INCOME" ? "+ SPRZEDAŻ" : item.type === "COST" ? "- KOSZT" : "⚠️ KIERUNEK?"}
                                            </button>
                                            {(item.isDuplicate || item.type === "UNRECOGNIZED_ENTITY") && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    onClick={() => handleVaultToAudit(idx)}
                                                    className="h-6 px-2 text-[8px] bg-slate-800 text-white hover:bg-black font-black uppercase tracking-tighter rounded-md flex items-center gap-1"
                                                >
                                                    <Archive className="w-3 h-3" /> Audit Vault
                                                </Button>
                                            )}
                                            {item.autoMatched?.category ? (
                                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded border border-emerald-200 flex items-center gap-1 ml-auto">
                                                    <Sparkles className="w-3 h-3" /> Pewniak: {item.category}
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200 ml-auto">
                                                    {item.category}
                                                </span>
                                            )}
                                        </div>

                                        <div className="pt-2 border-t border-slate-100 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                onClick={() => updateItem(idx, { status: "VALID" })}
                                                className="h-7 px-2 text-emerald-600 hover:bg-emerald-50 font-bold uppercase tracking-tighter text-[10px] gap-1"
                                            >
                                                <CheckCircle2 className="w-4 h-4" /> Zatwierdź
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                onClick={() => setEditingIndex(idx)}
                                                className="h-7 px-2 text-blue-600 hover:bg-blue-50 font-bold uppercase tracking-tighter text-[10px] gap-1"
                                            >
                                                <Edit3 className="w-4 h-4" /> Edytuj
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => removeItem(idx)} className="h-7 text-[10px] text-red-400 hover:text-red-600 hover:bg-red-50 font-bold uppercase">
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {scannerState === "INBOX" && editingIndex !== null && currentEditingItem && (
                        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between">
                                <Button variant="ghost" size="sm" onClick={() => { setEditingIndex(null); validateQueue(queue); }} className="text-slate-400 hover:text-slate-600">
                                    Powrót do listy
                                </Button>
                                <span className="text-xs font-bold uppercase text-slate-400 tracking-widest">Edycja Dokumentu {editingIndex + 1}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 shadow-inner">
                                <div className="col-span-2 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[10px] uppercase font-bold text-slate-500">Kontrahent</Label>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => updateItem(editingIndex, { isNewContractorOverride: !currentEditingItem.isNewContractorOverride })}
                                            className={`h-5 px-1 ${currentEditingItem.isNewContractorOverride ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}
                                        >
                                            <Badge variant="outline" className="text-[9px] h-4">NOWY +</Badge>
                                        </Button>
                                    </div>
                                    {currentEditingItem.isNewContractorOverride ? (
                                        <div className="grid grid-cols-1 gap-2">
                                            <Input 
                                                placeholder="Nazwa nowej firmy..." 
                                                value={currentEditingItem.newContractorNameOverride || currentEditingItem.parsedName} 
                                                onChange={(e) => updateItem(editingIndex, { newContractorNameOverride: e.target.value })}
                                                className="bg-white border-blue-300 focus:ring-blue-500"
                                            />
                                            <div className="text-[9px] text-slate-400 px-1 italic">Zostanie utworzony nowy kontrahent z tym NIP-em</div>
                                        </div>
                                    ) : (
                                        <Select 
                                            value={currentEditingItem.contractorId || ""} 
                                            onValueChange={(val) => { if (editingIndex !== null) updateItem(editingIndex, { contractorId: val, isNewContractorOverride: false }) }}
                                        >
                                            <SelectTrigger className="bg-white">
                                                <SelectValue placeholder="Wybierz kontrahenta lub kliknij +" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {contractors.map(c => (
                                                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.nip || 'Brak NIP'})</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-slate-500">NIP</Label>
                                    <Input value={currentEditingItem.nip || ""} onChange={(e) => updateItem(editingIndex, { nip: e.target.value })} className="bg-white font-mono" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-slate-500">Nr Faktury</Label>
                                    <Input value={currentEditingItem.invoiceNumber || ""} onChange={(e) => updateItem(editingIndex, { invoiceNumber: e.target.value })} className="bg-white" />
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase font-bold text-slate-500">Netto</Label>
                                        <Input value={currentEditingItem.netAmount} onChange={(e) => updateItem(editingIndex, { netAmount: e.target.value })} className="bg-white font-bold text-blue-700" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase font-bold text-slate-500">VAT</Label>
                                        <Input value={currentEditingItem.vatAmount} onChange={(e) => updateItem(editingIndex, { vatAmount: e.target.value })} className="bg-white" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase font-bold text-slate-500">Brutto</Label>
                                        <Input value={currentEditingItem.grossAmount} onChange={(e) => updateItem(editingIndex, { grossAmount: e.target.value })} className="bg-white" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-slate-500">Data</Label>
                                    <Input type="date" value={currentEditingItem.issueDate} onChange={(e) => updateItem(editingIndex, { issueDate: e.target.value })} className="bg-white" />
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                                            Projekt {currentEditingItem.autoMatched?.project && <Sparkles className="w-3 h-3 text-emerald-500" />}
                                        </Label>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => updateItem(editingIndex, { isNewProject: !currentEditingItem.isNewProject })}
                                            className={`h-5 px-1 ${currentEditingItem.isNewProject ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400'}`}
                                        >
                                            <Badge className="text-[9px] h-4">NOWY +</Badge>
                                        </Button>
                                    </div>
                                    {currentEditingItem.isNewProject ? (
                                        <Input 
                                            placeholder="Nazwa nowego projektu..." 
                                            value={currentEditingItem.newProjectName || ""} 
                                            onChange={(e) => updateItem(editingIndex, { newProjectName: e.target.value })}
                                            className="bg-white border-emerald-300 focus:ring-emerald-500"
                                        />
                                    ) : (
                                        <Select 
                                            value={currentEditingItem.projectId as string} 
                                            onValueChange={(val) => { if (editingIndex !== null && val) updateItem(editingIndex, { projectId: val as string }) }}
                                        >
                                            <SelectTrigger className={`bg-white ${currentEditingItem.autoMatched?.project ? 'border-emerald-500 focus:ring-emerald-500' : ''}`}>
                                                <SelectValue placeholder="Wybierz projekt" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="GENERAL" className="font-bold text-slate-500">KOSZTY OGÓLNE (Bez projektu)</SelectItem>
                                                {projects.map(p => (
                                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                                        Kategoria {currentEditingItem.autoMatched?.category && <Sparkles className="w-3 h-3 text-emerald-500" />}
                                    </Label>
                                    <Select 
                                        value={currentEditingItem.category as string} 
                                        onValueChange={(val) => { if (editingIndex !== null && val) updateItem(editingIndex, { category: val as string }) }}
                                    >
                                        <SelectTrigger className={`bg-white ${currentEditingItem.autoMatched?.category ? 'border-emerald-500 focus:ring-emerald-500' : ''}`}>
                                            <SelectValue placeholder="Kategoria" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="KOSZT_FIRMOWY" className="font-bold">DOMYŚLNA (Inne koszty)</SelectItem>
                                            {currentEditingItem.type === "INCOME" ? (
                                                <SelectItem value="SPRZEDAŻ_TOWARU">Sprzedaż towaru / usługi</SelectItem>
                                            ) : (
                                                <>
                                                    {Object.entries(COST_CATEGORIES).map(([group, cats]) => (
                                                        <div key={group}>
                                                            <div className="px-2 py-1 text-[8px] font-black uppercase text-slate-300 bg-slate-50">{group}</div>
                                                            {cats.map(c => (
                                                                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                                            ))}
                                                        </div>
                                                    ))}
                                                </>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <Button onClick={() => { setEditingIndex(null); validateQueue(queue); }} className="w-full bg-cyan-600 hover:bg-cyan-700 h-10">Zatwierdź zmiany</Button>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                            <div><p className="font-semibold">Błąd</p><p>{error}</p></div>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 border-t bg-slate-50/50 flex flex-col sm:flex-row gap-3">
                    {scannerState === "IDLE" ? (
                        <Button disabled={files.length === 0} onClick={handleScan} className="w-full bg-cyan-600 h-14 text-base font-black shadow-lg shadow-cyan-200 transition-all hover:bg-cyan-700 active:scale-95 disabled:grayscale">
                            SKANUJ I DOPASUJ ({files.length} plików)
                        </Button>
                    ) : scannerState === "INBOX" && editingIndex === null ? (
                        <>
                            <Button variant="ghost" onClick={resetState} className="flex-1 h-12 text-slate-400 font-bold hover:text-slate-600">Wyczyść wszystko</Button>
                            <Button disabled={!someValid || queue.some(i => i.status === "SAVING")} onClick={handleBulkApprove} className="flex-[2] bg-emerald-600 hover:bg-emerald-700 h-14 text-base font-black shadow-lg shadow-emerald-200 text-white relative">
                                {queue.some(i => i.status === "SAVING") ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> KSIĘGOWANIE...</>
                                ) : (
                                    <><Save className="mr-2 h-5 w-5" /> Zaksięguj Zweryfikowane</>
                                )}
                            </Button>
                        </>
                    ) : null}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}