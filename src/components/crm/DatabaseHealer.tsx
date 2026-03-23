"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Database, Loader2, Sparkles, RefreshCw } from "lucide-react"
import { cleanupDuplicateContractors, syncAllContractorsToPrisma } from "@/app/actions/contractorHealer"
import { toast } from "sonner"

export function DatabaseHealer() {
    const [isHealing, setIsHealing] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)

    const handleHeal = async () => {
        if (!confirm("Czy na pewno chcesz uruchomić procedurę 'Czysta Kartoteka' dla firmy Orlen? Usunie to duplikaty bez NIP-u (zostawiając tylko te z NIP).")) return
        
        setIsHealing(true)
        try {
            const result = await cleanupDuplicateContractors()
            if (result.success) {
                toast.success(result.message || "Baza danych została uzdrowiona.")
            } else {
                toast.error(result.error || "Wystąpił błąd podczas uzdrawiania bazy.")
            }
        } catch (error) {
            toast.error("Błąd krytyczny podczas leczenia bazy.")
            console.error(error)
        } finally {
            setIsHealing(false)
        }
    }

    const handleSync = async () => {
        if (!confirm("Czy chcesz zsynchronizować wszystkich kontrahentów z Firestore do SQL (Prisma)? To naprawi brakujące rekordy w wyszukiwarkach.")) return

        setIsSyncing(true)
        try {
            const result = await syncAllContractorsToPrisma()
            if (result.success) {
                toast.success(result.message)
            } else {
                toast.error(result.error)
            }
        } catch (error) {
            toast.error("Błąd podczas synchronizacji baz.")
        } finally {
            setIsSyncing(false)
        }
    }

    return (
        <div className="flex items-center gap-2">
            <Button 
                variant="outline" 
                size="sm"
                onClick={handleHeal}
                disabled={isHealing || isSyncing}
                className="text-[10px] uppercase font-bold tracking-wider h-8 border-amber-200 bg-amber-50/50 text-amber-700 hover:bg-amber-100 hover:border-amber-300 transition-all shadow-sm"
            >
                {isHealing ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : (
                    <Sparkles className="w-3 h-3 mr-1" />
                )}
                Czysta Kartoteka (Orlen)
            </Button>

            <Button 
                variant="outline" 
                size="sm"
                onClick={handleSync}
                disabled={isSyncing || isHealing}
                className="text-[10px] uppercase font-bold tracking-wider h-8 border-blue-200 bg-blue-50/50 text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-all shadow-sm"
            >
                {isSyncing ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : (
                    <RefreshCw className="w-3 h-3 mr-1" />
                )}
                Sync SQL (Prisma)
            </Button>
        </div>
    )
}
