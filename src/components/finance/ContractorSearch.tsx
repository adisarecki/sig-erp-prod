"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Search, UserPlus, Building2, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface Contractor {
    id: string
    name: string
    nip?: string | null
    address?: string | null
}

interface ContractorSearchProps {
    contractors: Contractor[]
    onSelect: (contractor: Contractor | null) => void
    onManualEntry: (name: string, nip: string, address: string) => void
    initialValue?: string
    initialNip?: string
    initialAddress?: string
}

export function ContractorSearch({ 
    contractors, 
    onSelect, 
    onManualEntry,
    initialValue = "",
    initialNip = "",
    initialAddress = ""
}: ContractorSearchProps) {
    const [query, setQuery] = useState(initialValue)
    const [isOpen, setIsOpen] = useState(false)
    const [isManual, setIsManual] = useState(false)
    const [manualNip, setManualNip] = useState(initialNip)
    const [manualAddress, setManualAddress] = useState(initialAddress)
    const containerRef = useRef<HTMLDivElement>(null)

    // Filter contractors based on query
    const filteredContractors = query.length >= 2 
        ? contractors.filter(c => 
            c.name.toLowerCase().includes(query.toLowerCase()) || 
            (c.nip && c.nip.includes(query))
          ).slice(0, 5)
        : []

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const handleSelect = (c: Contractor) => {
        setQuery(c.name)
        setIsManual(false)
        setIsOpen(false)
        onSelect(c)
    }

    const handleManualToggle = () => {
        setIsManual(true)
        setIsOpen(false)
        onSelect(null)
        onManualEntry(query, manualNip, manualAddress)
    }

    const handleQueryChange = (val: string) => {
        setQuery(val)
        if (!isManual) {
            setIsOpen(true)
        }
        if (isManual) {
            onManualEntry(val, manualNip, manualAddress)
        }
    }

    return (
        <div className="space-y-4" ref={containerRef}>
            <div className="space-y-2 relative">
                <div className="flex items-center justify-between mb-1">
                    <Label className="font-semibold text-slate-700">Sprzedawca / Dostawca *</Label>
                    {isManual ? (
                        <button 
                            type="button" 
                            onClick={() => { setIsManual(false); setQuery(""); onSelect(null); }}
                            className="text-[10px] uppercase font-bold text-blue-600 hover:underline"
                        >
                            Wróć do wyszukiwania
                        </button>
                    ) : (
                        <span className="text-[10px] text-slate-400 uppercase font-medium">Wyszukaj w bazie danych</span>
                    )}
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <Input
                        placeholder={isManual ? "Wpisz pełną nazwę firmy..." : "Zacznij wpisywać nazwę lub NIP..."}
                        value={query}
                        onChange={(e) => handleQueryChange(e.target.value)}
                        onFocus={() => !isManual && query.length >= 2 && setIsOpen(true)}
                        className={cn(
                            "pl-10 h-12 text-base border-slate-200 transition-all",
                            isManual ? "bg-blue-50/30 border-blue-200" : "bg-white focus:ring-blue-500"
                        )}
                        autoComplete="off"
                    />
                </div>

                {/* Dropdown results */}
                {isOpen && !isManual && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                        {filteredContractors.length > 0 ? (
                            <div className="p-1">
                                {filteredContractors.map((c) => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => handleSelect(c)}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-lg text-left transition-colors group"
                                    >
                                        <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 shrink-0">
                                            <Building2 className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-900 truncate">{c.name}</p>
                                            <p className="text-[11px] text-slate-500 font-mono italic">
                                                {c.nip ? `NIP: ${c.nip}` : "Brak NIP"}
                                            </p>
                                        </div>
                                        <Check className="h-4 w-4 text-blue-600 opacity-0 group-hover:opacity-100" />
                                    </button>
                                ))}
                                <div className="h-px bg-slate-100 my-1" />
                            </div>
                        ) : query.length >= 2 ? (
                            <div className="p-3 text-center text-sm text-slate-500 italic">
                                Nie znaleziono firmy o tej nazwie.
                            </div>
                        ) : null}
                        
                        <button
                            type="button"
                            onClick={handleManualToggle}
                            className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-blue-50 text-blue-700 text-sm font-bold transition-colors border-t border-slate-100"
                        >
                            <UserPlus className="h-4 w-4" />
                            <span>Dodaj firmę ręcznie (brak w bazie)</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Manual Fields */}
            {isManual && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50/50 border border-blue-100 rounded-2xl animate-in fade-in slide-in-from-top-4">
                    <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">NIP (Opcjonalnie)</Label>
                        <Input
                            placeholder="10 cyfr"
                            value={manualNip}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                                setManualNip(val)
                                onManualEntry(query, val, manualAddress)
                            }}
                            className="bg-white font-mono h-11 border-blue-100"
                            autoComplete="off"
                        />
                    </div>
                    <div className="space-y-1.5 flex flex-col justify-end pb-0.5">
                        <p className="text-[11px] text-slate-500 leading-tight italic">
                            Wprowadź dane, aby system mógł poprawnie stworzyć kartotę partnera.
                        </p>
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Pełen Adres</Label>
                        <Input
                            placeholder="ul. Słoneczna 1, 00-001 Warszawa"
                            value={manualAddress}
                            onChange={(e) => {
                                setManualAddress(e.target.value)
                                onManualEntry(query, manualNip, e.target.value)
                            }}
                            className="bg-white h-11 border-blue-100"
                            autoComplete="off"
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
