"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Search, UserPlus, Building2, Check, Loader2, Search as SearchIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { searchContractors } from "@/app/actions/crm"
import { fetchGusData } from "@/app/actions/gus"

interface Contractor {
    id: string
    name: string
    nip?: string | null
    address?: string | null
}

interface ContractorSearchProps {
    contractors: Contractor[] // Keep for initial fallback if needed
    onSelect: (contractor: Contractor | null) => void
    onManualEntry: (name: string, nip: string, address: string) => void
    initialValue?: string
    initialNip?: string
    initialAddress?: string
}

export function ContractorSearch({ 
    contractors: initialContractors, 
    onSelect, 
    onManualEntry,
    initialValue = "",
    initialNip = "",
    initialAddress = ""
}: ContractorSearchProps) {
    const [query, setQuery] = useState(initialValue)
    const [results, setResults] = useState<Contractor[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const [isManual, setIsManual] = useState(false)
    const [manualNip, setManualNip] = useState(initialNip)
    const [manualAddress, setManualAddress] = useState(initialAddress)
    const [gusLoading, setGusLoading] = useState(false)
    const [successFlash, setSuccessFlash] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    // Debounced search
    useEffect(() => {
        if (!query || query.length < 2 || isManual) {
            setResults([])
            setIsOpen(false)
            return
        }

        const handler = setTimeout(async () => {
            setIsLoading(true)
            try {
                const searchResults = await searchContractors(query)
                setResults(searchResults)
                setIsOpen(true)
            } catch (error) {
                console.error("Search error:", error)
            } finally {
                setIsLoading(false)
            }
        }, 400) // 400ms debounce

        return () => clearTimeout(handler)
    }, [query, isManual])

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

    const handleGusFetch = async (targetNip?: string) => {
        const nipToFetch = targetNip || manualNip.replace(/[^0-9]/g, "")
        if (nipToFetch.length !== 10) return

        setGusLoading(true)
        try {
            const res = await fetchGusData(nipToFetch)
            if (res.success && res.data) {
                setQuery(res.data.name)
                setManualAddress(res.data.address)
                setManualNip(nipToFetch)
                onManualEntry(res.data.name, nipToFetch, res.data.address)
                setSuccessFlash(true)
                setTimeout(() => setSuccessFlash(false), 2000)
            }
        } catch (error) {
            console.error("GUS Fetch Error:", error)
        } finally {
            setGusLoading(false)
        }
    }

    // Auto-trigger on 10th digit
    useEffect(() => {
        if (isManual && manualNip.length === 10) {
            handleGusFetch(manualNip)
        }
    }, [manualNip])

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
                </div>                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <Input
                        placeholder={isManual ? "Wpisz pełną nazwę firmy..." : "Zacznij wpisywać nazwę lub NIP..."}
                        value={query}
                        onChange={(e) => handleQueryChange(e.target.value)}
                        onFocus={() => !isManual && query.length >= 2 && setIsOpen(true)}
                        className={cn(
                            "pl-10 h-12 text-base border-slate-200 transition-all duration-500",
                            isManual ? "bg-blue-50/30 border-blue-200" : "bg-white focus:ring-blue-500",
                            isManual && successFlash && "bg-green-50 ring-2 ring-green-400 border-green-500"
                        )}
                        autoComplete="off"
                    />
                    {isLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        </div>
                    )}
                </div>

                {/* Dropdown results */}
                {isOpen && !isManual && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                        {results.length > 0 ? (
                            <div className="p-1">
                                {results.map((c) => (
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
                        ) : query.length >= 2 && !isLoading ? (
                            <div className="p-3 text-center text-sm text-slate-500 italic">
                                Nie znaleziono firmy o tej nazwie.
                            </div>
                        ) : isLoading ? (
                            <div className="p-4 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Szukanie w bazie danych...
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
                        <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">NIP (10 cyfr)</Label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input
                                    placeholder="Wpisz NIP..."
                                    value={manualNip}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                                        setManualNip(val)
                                        onManualEntry(query, val, manualAddress)
                                    }}
                                    className="bg-white font-mono h-11 border-blue-100 pr-10"
                                    autoComplete="off"
                                />
                                {gusLoading && (
                                    <div className="absolute right-3 top-2.5">
                                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                    </div>
                                )}
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => handleGusFetch()}
                                disabled={gusLoading || manualNip.length < 10}
                                className="h-11 w-11 bg-white border-blue-100 hover:bg-blue-50 text-blue-600"
                            >
                                <SearchIcon className="h-4 w-4" />
                            </Button>
                        </div>
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
                            className={cn(
                                "bg-white h-11 border-blue-100 transition-all duration-500",
                                successFlash && "bg-green-50 ring-2 ring-green-400 border-green-500"
                            )}
                            autoComplete="off"
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
