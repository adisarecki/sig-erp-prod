"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Trash2, AlertTriangle } from "lucide-react"
import { fullResetTenantData } from "@/app/actions/admin"

/**
 * DevTools – Panel programistyczny do szybkich operacji administracyjnych.
 * ZAKAZ używania na produkcji bez zabezpieczeń!
 */
export function DevTools() {
    const [isPending, setIsPending] = useState(false)

    async function handleFullReset() {
        const confirmResult = window.confirm(
            "UWAGA! Ta operacja USUNIE WSZYSTKIE faktury, projekty i kontrahentów dla Twojej firmy. Czy na pewno chcesz wyczyścić bazę do zera?"
        )
        
        if (!confirmResult) return

        setIsPending(true)
        try {
            const res = await fullResetTenantData()
            if (res.success) {
                alert("Baza wyczyszczona. System jest gotowy na nowe dane (Demetrix).")
                window.location.reload()
            }
        } catch (error) {
            alert(error instanceof Error ? error.message : "Błąd krytyczny przy czyszczeniu.")
        } finally {
            setIsPending(false)
        }
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 p-4 bg-white border-2 border-rose-200 rounded-2xl shadow-2xl space-y-3 max-w-[200px]">
            <div className="flex items-center gap-2 text-rose-600 text-xs font-bold uppercase tracking-tighter">
                <AlertTriangle className="w-4 h-4" />
                <span>Dev Console</span>
            </div>
            
            <p className="text-[10px] text-slate-500 leading-tight">
                Użyj przycisku poniżej, aby wykonać <b>FULL RESET</b> danych dla Twojego tenanta.
            </p>

            <Button 
                variant="destructive" 
                size="sm" 
                className="w-full h-10 gap-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 hover:scale-105 active:scale-95 transition-all"
                onClick={handleFullReset}
                disabled={isPending}
            >
                <Trash2 className="w-4 h-4" />
                {isPending ? "Czyszczenie..." : "Wyczyść Bazę"}
            </Button>
        </div>
    )
}
