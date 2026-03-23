"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Database, Loader2, Sparkles } from "lucide-react"
import { cleanupDuplicateContractors } from "@/app/actions/contractorHealer"
import { toast } from "sonner"

export function DatabaseHealer() {
    const [isHealing, setIsHealing] = useState(false)

    const handleHeal = async () => {
        if (!confirm("Czy na pewno chcesz uruchomić procedurę 'Czysta Kartoteka' dla firmy Orlen? Usunie to duplikaty bez NIP-u.")) return
        
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

    return (
        <Button 
            variant="outline" 
            size="sm"
            onClick={handleHeal}
            disabled={isHealing}
            className="text-[10px] uppercase font-bold tracking-wider h-8 border-amber-200 bg-amber-50/50 text-amber-700 hover:bg-amber-100 hover:border-amber-300 transition-all"
        >
            {isHealing ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
            ) : (
                <Database className="w-3 h-3 mr-1" />
            )}
            Health Check (Orlen)
        </Button>
    )
}
