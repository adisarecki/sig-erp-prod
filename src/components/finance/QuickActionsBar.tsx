"use client"

/**
 * QuickActionsBar – Globalny Panel Szybkich Akcji
 *
 * Standard UI SIG ERP: Ten komponent jest jedynym, autoryzowanym miejscem
 * dla przycisków "Dodaj Przychód" i "Dodaj Koszt".
 * ZAKAZ tworzenia innych przycisków dodawania przychodów/kosztów w UI.
 *
 * Moduł AI: Przycisk "Skanuj Fakturę" (Agent 2 – OCR Worker).
 *
 * Użycie: <QuickActionsBar projects={...} contractors={...} />
 */

import { useState, useRef } from "react"
import dynamic from "next/dynamic"
import { RegisterIncomeModal } from "@/components/finance/RegisterIncomeModal"
import { RegisterCostModal } from "@/components/finance/RegisterCostModal"
import { RegisterDebtModal } from "@/components/finance/RegisterDebtModal"

// Dynamically load InvoiceScanner with SSR disabled to prevent pdfjs-dist issues
const InvoiceScanner = dynamic(() => import("@/components/finance/InvoiceScanner").then(mod => mod.InvoiceScanner), {
    ssr: false,
    loading: () => <div className="animate-pulse bg-slate-100 h-9 w-24 rounded-lg" />
})
import Link from "next/link"
import { type Contractor, type Project } from "@/lib/types/crm"
import { TrendingUp, TrendingDown, ScanLine, DownloadCloud, History, Loader2, Trash2, AlertTriangle, Info } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface QuickActionsBarProps {
    projects: Project[]
    contractors: Contractor[]
}

export function QuickActionsBar({ projects, contractors }: QuickActionsBarProps) {
    const [isImporting, setIsImporting] = useState(false)
    const [isPurging, setIsPurging] = useState(false)
    const [showPurgeConfirm, setShowPurgeConfirm] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        processFile(file)
    }

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files?.[0]
        if (!file) return
        processFile(file)
    }

    const processFile = async (file: File) => {
        setIsImporting(true)
        try {
            // VECTOR 120: Redirect to Bank Reconciliation Hub
            const rawText = await file.text()
            localStorage.setItem("pendingBankCsv", rawText) // Store for the other page
            window.location.href = "/finanse/verify-balance?auto=true"
        } catch (err: any) {
            console.error("IMPORT_ERR:", err)
            alert("Błąd połączenia z serwerem.")
        } finally {
            setIsImporting(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    const handlePurge = async () => {
        setIsPurging(true)
        console.log("[ADMIN] Starting Deep Purge operation...")
        try {
            const response = await fetch("/api/finance/transactions/purge-all", {
                method: "DELETE",
            })
            const result = await response.json()
            if (result.success) {
                console.log("[ADMIN] Purge successful:", result)
                alert(`Baza wyczyszczona (Deep Purge). Usunięto ${result.purgedCount} transakcji.`)
                setShowPurgeConfirm(false)
                // Force a hard reload to clear all caches (SWR, React Query, LocalState)
                window.location.href = window.location.pathname + window.location.search
            } else {
                console.error("[ADMIN] Purge failed:", result.error)
                alert(`Błąd: ${result.error || "Błąd podczas czyszczenia"}`)
            }
        } catch (err) {
            console.error("[ADMIN] Network error during purge:", err)
            alert("Błąd sieci.")
        } finally {
            setIsPurging(false)
        }
    }

    return (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
            {/* Etykieta */}
            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-widest mr-auto">
                <span>Szybkie Akcje</span>
            </div>

            <div className="w-px bg-slate-100 hidden sm:block" />

            {/* Dług Historyczny – Fort Knox: Rose/Slate */}
            <div className="flex items-center gap-1.5 pr-2 group">
                <div className="p-1.5 bg-rose-50 rounded-lg text-rose-600 group-hover:bg-rose-100 transition-colors">
                    <History className="w-4 h-4" />
                </div>
                <div className="text-xs text-slate-400 leading-tight hidden lg:block">
                    Zobowiązanie<br />Historyczne
                </div>
                <RegisterDebtModal />
            </div>

            <div className="w-px bg-slate-100 hidden sm:block" />

            {/* CENTRALA FINANSOWA – Vector 106 Node */}
            <Link href="/finanse/verify-balance">
                <Button 
                  variant="outline"
                  className="h-9 px-4 bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center gap-2"
                >
                    <DownloadCloud className="w-3 h-3" />
                    Weryfikuj Saldo i Import
                </Button>
            </Link>

            <div className="w-px bg-slate-100 hidden sm:block" />

            {/* EMERGENCY NUKE – Admin: Rose */}
            <button 
              type="button"
              className="h-9 px-3 text-rose-600 hover:bg-rose-50 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all active:scale-95 flex items-center gap-2 border border-rose-100"
              onClick={() => setShowPurgeConfirm(true)}
            >
                <Trash2 className="w-3 h-3" />
                Wyczyść rejestr
            </button>

            {/* NUKE CONFIRMATION MODAL */}
            <Dialog open={showPurgeConfirm} onOpenChange={setShowPurgeConfirm}>
                <DialogContent className="sm:max-w-[425px] border-rose-100">
                    <DialogHeader className="space-y-3">
                        <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mb-2">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <DialogTitle className="text-xl font-bold text-slate-900">
                            Resetowanie Rejestru Bankowego
                        </DialogTitle>
                        <DialogDescription className="text-slate-600 font-medium text-base leading-relaxed">
                            Czy na pewno chcesz usunąć <span className="text-rose-600 font-bold">WSZYSTKIE</span> transakcje bez przypisanego projektu?
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4 bg-rose-50 p-4 rounded-xl border border-rose-100 text-sm text-rose-800 leading-relaxed space-y-2">
                        <p className="font-bold flex items-center gap-2">
                            <Info className="w-4 h-4" /> SKUTKI OPERACJI:
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-xs opacity-90">
                            <li>Wszystkie transakcje bankowe zostaną trwale usunięte.</li>
                            <li>Opłacone faktury zarządcze wrócą do statusu "DO ZAPŁATY".</li>
                            <li>Zwolnione zostaną blokady "bankTransactionId" (możliwy ponowny import).</li>
                            <li>Koszty projektowe pozostaną nienaruszone.</li>
                        </ul>
                    </div>

                    <DialogFooter className="mt-6 flex gap-2">
                        <Button variant="outline" onClick={() => setShowPurgeConfirm(false)} className="flex-1">
                            Anuluj
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={handlePurge} 
                            disabled={isPurging}
                            className="flex-1 font-bold shadow-lg shadow-rose-200 uppercase tracking-tighter"
                        >
                            {isPurging ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                            USUŃ I RESETUJ
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
