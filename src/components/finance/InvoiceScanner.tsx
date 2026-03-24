"use client"

import { useState, useRef, useCallback } from "react"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScanLine, Upload, CheckCircle, AlertTriangle, Loader2, Sparkles } from "lucide-react"
import type { OcrInvoiceData } from "@/lib/ocr/types"
import type { SanitizedOcrDraft } from "@/lib/schemas/ocr-draft"

interface InvoiceScannerProps {
    onDataExtracted: (data: SanitizedOcrDraft) => void
}

export function InvoiceScanner({ onDataExtracted }: InvoiceScannerProps) {
    const [open, setOpen] = useState(false)
    const [dragActive, setDragActive] = useState(false)
    const [files, setFiles] = useState<File[]>([])
    const [scannerState, setScannerState] = useState<"IDLE" | "OCR_PROCESSING" | "SUCCESS" | "ERROR">("IDLE")
    const [error, setError] = useState<string | null>(null)
    const [pendingItems, setPendingItems] = useState<OcrInvoiceData[]>([])
    const [currentIndex, setCurrentIndex] = useState<number>(0)
    const inputRef = useRef<HTMLInputElement>(null)

    const resetState = useCallback(() => {
        setFiles([]); setScannerState("IDLE"); setError(null); setPendingItems([]); setCurrentIndex(0); setDragActive(false)
    }, [])

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
        setFiles(prev => [...prev, ...validFiles].slice(0, 5)) // Max 5 files
        setScannerState("IDLE")
    }, [])

    const handleScan = async () => {
        if (files.length === 0) return
        setScannerState("OCR_PROCESSING"); setError(null)
        const allItems: OcrInvoiceData[] = []
        try {
            for (const f of files) {
                const formData = new FormData(); formData.append("file", f)
                const response = await fetch("/api/ocr/scan", { method: "POST", body: formData })
                const text = await response.text()
                let result; try { result = JSON.parse(text) } catch { throw new Error("Błąd serwera (HTML)") }
                if (!response.ok || !result.success) throw new Error(result.error || `Błąd OCR dla pliku ${f.name}`)
                
                // result.data jest teraz tablicą
                if (Array.isArray(result.data)) {
                    allItems.push(...result.data)
                }
            }

            if (allItems.length === 0) {
                throw new Error("Nie wykryto żadnych dokumentów na przesłanych zdjęciach.")
            }

            setPendingItems(allItems)
            setCurrentIndex(0)
            setScannerState("SUCCESS")
        } catch (err: any) {
            setError(err.message); setScannerState("ERROR")
        }
    }

    const currentItem = pendingItems[currentIndex]

    const handleApprove = async () => {
        if (!currentItem) return
        setError(null)
        try {
            const payload = {
                ...currentItem,
                dueDate: currentItem.dueDate || "",
                nip: currentItem.nip?.replace(/\D/g, "") || null
            }
            const response = await fetch("/api/intake/ocr-draft", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            const result = await response.json()
            if (!response.ok) {
                const details = result.details ? result.details.map((d: any) => `${d.field}: ${d.message}`).join(" | ") : ""
                throw new Error(details || result.error)
            }
            
            onDataExtracted(result.draft)
            
            // Przejdź do kolejnego lub zamknij
            if (currentIndex < pendingItems.length - 1) {
                setCurrentIndex(prev => prev + 1)
            } else {
                setOpen(false)
                resetState()
            }
        } catch (err: any) {
            setError(err.message)
        }
    }

    const isCost = currentItem?.type === "COST" || currentItem?.type === undefined

    const updateCurrentItem = (data: Partial<OcrInvoiceData>) => {
        setPendingItems(prev => {
            const next = [...prev]
            next[currentIndex] = { ...next[currentIndex], ...data }
            return next
        })
    }

    return (
        <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetState(); }}>
            <DialogTrigger asChild>
                <Button className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2 shadow-lg active:scale-95">
                    <ScanLine className="h-4 w-4" /> Skanuj Faktury (Batch)
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        <ScanLine className="text-cyan-600" /> Skaner Gemini AI
                    </DialogTitle>
                    <DialogDescription>
                        Wgraj do 5 plików (PDF/JPG). Gemini wyodrębni dane z każdego wykrytego dokumentu.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-4">
                    {scannerState !== "SUCCESS" && scannerState !== "OCR_PROCESSING" && (
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
                            <p className="font-semibold text-slate-700">Gemini analizuje dokumenty ({files.length} plików)...</p>
                        </div>
                    )}

                    {error && (
                        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                            <div><p className="font-semibold">Błąd</p><p>{error}</p></div>
                        </div>
                    )}

                    {currentItem && scannerState === "SUCCESS" && (
                        <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                            <div className="flex justify-between items-center border-b pb-2">
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-emerald-500" /> Dokument {currentIndex + 1} z {pendingItems.length}
                                    </span>
                                    <span className="text-[10px] text-slate-500">Wykryto łącznie {pendingItems.length} dokumentów</span>
                                </div>
                                {currentItem.ocrConfidence && (
                                    <span className="text-[10px] px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 font-bold">
                                        PEWNOŚĆ: {Math.round(currentItem.ocrConfidence * 100)}%
                                    </span>
                                )}
                            </div>
                            <div className={`p-4 rounded-2xl border-2 ${isCost ? 'border-orange-500/20 bg-orange-50/5' : 'border-cyan-500/20 bg-cyan-50/5'}`}>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2 space-y-1"><Label className="text-[10px] uppercase font-bold text-slate-500">Sprzedawca</Label><Input value={currentItem.parsedName} onChange={(e) => updateCurrentItem({ parsedName: e.target.value })} className="bg-white" /></div>
                                    <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-slate-500">NIP</Label><Input value={currentItem.nip || ""} onChange={(e) => updateCurrentItem({ nip: e.target.value })} className="bg-white font-mono" /></div>
                                    <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-slate-500">Nr Faktury</Label><Input value={currentItem.invoiceNumber || ""} onChange={(e) => updateCurrentItem({ invoiceNumber: e.target.value })} className="bg-white" /></div>
                                    <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-slate-500">Netto</Label><Input value={currentItem.netAmount} onChange={(e) => updateCurrentItem({ netAmount: e.target.value })} className="bg-white" /></div>
                                    <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-slate-500">Brutto</Label><Input className="bg-white font-bold text-cyan-700 border-cyan-200" value={currentItem.grossAmount} onChange={(e) => updateCurrentItem({ grossAmount: e.target.value })} /></div>
                                    <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-slate-500">Data Wystawienia</Label><Input type="date" value={currentItem.issueDate} onChange={(e) => updateCurrentItem({ issueDate: e.target.value })} className="bg-white" /></div>
                                    <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-slate-500">Termin Płatności</Label><Input type="text" value={currentItem.dueDate || ""} onChange={(e) => updateCurrentItem({ dueDate: e.target.value })} className="bg-white" placeholder="np. Zapłacono / YYYY-MM-DD" /></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex gap-2">
                    {scannerState !== "SUCCESS" ? (
                        <Button disabled={files.length === 0 || scannerState === "OCR_PROCESSING"} onClick={handleScan} className="w-full bg-cyan-600 h-12 text-base shadow-lg transition-all hover:bg-cyan-700">
                            {scannerState === "OCR_PROCESSING" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Przetwarzanie...</> : `Analizuj ${files.length} plik(ów) Gemini`}
                        </Button>
                    ) : (
                        <>
                            <Button variant="outline" onClick={resetState} className="flex-1 h-12">Anuluj wszystko</Button>
                            <Button onClick={handleApprove} className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-12 text-base shadow-lg text-white">
                                {currentIndex < pendingItems.length - 1 ? "Zatwierdź i następny" : "Zatwierdź i zakończ"}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}