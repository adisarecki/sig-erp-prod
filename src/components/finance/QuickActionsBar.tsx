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

import { useState } from "react"
import dynamic from "next/dynamic"
import { RegisterIncomeModal } from "@/components/finance/RegisterIncomeModal"
import { RegisterCostModal } from "@/components/finance/RegisterCostModal"
import { RegisterDebtModal } from "@/components/finance/RegisterDebtModal"

// Dynamically load InvoiceScanner with SSR disabled to prevent pdfjs-dist issues
const InvoiceScanner = dynamic(() => import("@/components/finance/InvoiceScanner").then(mod => mod.InvoiceScanner), {
    ssr: false,
    loading: () => <div className="animate-pulse bg-slate-100 h-9 w-24 rounded-lg" />
})
import { TrendingUp, TrendingDown, ScanLine, DownloadCloud, History } from "lucide-react"
import type { SanitizedOcrDraft } from "@/lib/schemas/ocr-draft"

interface QuickActionsBarProps {
    projects: { id: string; name: string }[]
    contractors: { id: string; name: string; nip?: string | null }[]
}

export function QuickActionsBar({ projects, contractors }: QuickActionsBarProps) {
    // OCR scan result – stored here to pass as initial values to modals
    const [ocrData, setOcrData] = useState<SanitizedOcrDraft | null>(null)

    const handleOcrExtracted = (data: SanitizedOcrDraft) => {
        setOcrData(data)
        // The data is now available for RegisterCostModal/RegisterIncomeModal
        // to use as initial values. The modal will open automatically via state.
    }

    return (
        <div className="flex flex-col sm:flex-row gap-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
            {/* Etykieta */}
            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-widest mr-auto">
                <span>Szybkie Akcje</span>
            </div>

            {/* Skanuj Fakturę – AI Module: Cyan */}
            <div className="flex items-center gap-1.5">
                <div className="p-1.5 bg-cyan-50 rounded-lg text-cyan-600">
                    <ScanLine className="w-4 h-4" />
                </div>
                <div className="text-xs text-slate-400 leading-tight hidden lg:block">
                    Skan AI<br />/ OCR
                </div>
                <InvoiceScanner onDataExtracted={handleOcrExtracted} />
            </div>

            <div className="w-px bg-slate-100 hidden sm:block" />

            {/* Dodaj Przychód – Standard: Emerald Green */}
            <div className="flex items-center gap-1.5">
                <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
                    <TrendingUp className="w-4 h-4" />
                </div>
                <div className="text-xs text-slate-400 leading-tight hidden lg:block">
                    Faktura sprzedażowa<br />/ Wpływ
                </div>
                <RegisterIncomeModal projects={projects} contractors={contractors} ocrData={ocrData?.type === "INCOME" ? ocrData : undefined} />
            </div>

            <div className="w-px bg-slate-100 hidden sm:block" />

            {/* Dodaj Koszt – Standard: Orange */}
            <div className="flex items-center gap-1.5 pr-2">
                <div className="p-1.5 bg-orange-50 rounded-lg text-orange-500">
                    <TrendingDown className="w-4 h-4" />
                </div>
                <div className="text-xs text-slate-400 leading-tight hidden lg:block">
                    Faktura zakupowa<br />/ Wydatek
                </div>
                <RegisterCostModal projects={projects} contractors={contractors} ocrData={ocrData?.type === "COST" ? ocrData : undefined} />
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

            {/* Import Bankowy – Foundation: Indigo */}
            <div className="flex items-center gap-3 pl-2 group">
                <div className="flex items-center gap-1.5">
                    <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                        <DownloadCloud className="w-4 h-4" />
                    </div>
                    <div className="text-xs text-slate-400 leading-tight hidden lg:block">
                        Import<br />Bankowy
                    </div>
                </div>
                <button 
                  type="button"
                  className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all active:scale-95 shadow-sm shadow-indigo-200"
                  onClick={() => alert("Fundamenty importu (Schema + API) wdrożone! Endpoint: /api/finance/import-bank oczekuje na parser plików bankowych CSV/MT940.")}
                >
                    📥 Importuj wyciąg
                </button>
            </div>
        </div>
    )
}
