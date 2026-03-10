"use client"

import { useState } from "react"
import { Trash2, AlertTriangle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { resetOperationalData } from "@/app/actions/admin"

export default function SettingsPage() {
    const [isPending, setIsPending] = useState(false)
    const [isDone, setIsDone] = useState(false)

    async function handleReset() {
        const confirmed = confirm(
            "UWAGA! Ta operacja bezpowrotnie usunie WSZYSTKIE Projekty, Kontrahentów, Faktury i Transakcje. Czy na pewno chcesz wyczyścić bazę danych operacyjnych?"
        )

        if (!confirmed) return

        setIsPending(true)
        try {
            await resetOperationalData()
            setIsDone(true)
            setTimeout(() => setIsDone(false), 5000)
        } catch (error) {
            console.error(error)
            alert("Błąd podczas czyszczenia bazy: " + (error as Error).message)
        } finally {
            setIsPending(false)
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Ustawienia Systemu</h1>
                <p className="text-slate-500 mt-1">Konfiguracja środowiska, zarządzanie danymi i parametry globalne.</p>
            </div>

            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                <div className="p-6 border-b bg-slate-50">
                    <div className="flex items-center gap-2 text-orange-600 font-semibold">
                        <AlertTriangle className="w-5 h-5" />
                        <h2>Strefa Deweloperska / Konserwacja</h2>
                    </div>
                </div>
                <div className="p-6 space-y-6">
                    <div className="flex justify-between items-start gap-6">
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-slate-900">Wyczyść Dane Operacyjne</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                Usuń wszystkie dane testowe (Projekty, Kontrahentów, Finanse), aby przygotować system do wprowadzenia rzeczywistych danych produkcyjnych.
                                <span className="font-semibold text-red-600 block mt-2">To działanie jest nieodwracalne!</span>
                            </p>
                        </div>
                        <Button
                            variant="destructive"
                            className="flex items-center gap-2 shrink-0 h-10 px-6"
                            onClick={handleReset}
                            disabled={isPending}
                        >
                            {isPending ? (
                                <span className="animate-pulse">Czyszczenie...</span>
                            ) : isDone ? (
                                <><CheckCircle2 className="w-4 h-4" /> Gotowe</>
                            ) : (
                                <><Trash2 className="w-4 h-4" /> Usuń wszystkie dane</>
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="bg-white border rounded-xl p-6 shadow-sm opacity-60">
                <h3 className="text-lg font-bold text-slate-900">Informacje o Systemie</h3>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                    <p>Wersja: <strong className="text-slate-900">0.2.1-beta</strong></p>
                    <p>Środowisko: <strong className="text-slate-900 text-blue-600">Wizjoner Preview</strong></p>
                    <p>Połączenie z bazą: <strong className="text-green-600 italic">Aktywne (Neon.tech)</strong></p>
                </div>
            </div>
        </div>
    )
}
