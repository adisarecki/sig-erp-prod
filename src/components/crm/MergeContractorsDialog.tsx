"use client"

import { useState } from "react"
import { Layers, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { mergeContractorsBulk } from "@/app/actions/contractorsMerge"

interface MergeContractorsDialogProps {
    selectedIds: string[];
    contractorsList: { id: string, name: string, nip: string | null }[];
    onSuccess: () => void;
    triggerElement: React.ReactNode;
}

export function MergeContractorsDialog({ selectedIds, contractorsList, onSuccess, triggerElement }: MergeContractorsDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [primaryId, setPrimaryId] = useState<string>('')

    const involvedContractors = contractorsList.filter(c => selectedIds.includes(c.id))

    async function handleMerge() {
        if (!primaryId) return;
        
        setLoading(true)
        setError(null)
        
        // Secondary to wszyscy oprócz wybranego primary
        const secondaryIds = selectedIds.filter(id => id !== primaryId)

        const result = await mergeContractorsBulk(primaryId, secondaryIds)
        
        setLoading(false)
        if (result.success) {
            setOpen(false)
            onSuccess()
        } else {
            setError(result.error || "Wystąpił błąd podczas scalania.")
        }
    }

    return (
        <Dialog open={open} onOpenChange={(val) => {
            setOpen(val);
            if (!val) { setError(null); setPrimaryId(''); }
        }}>
            <DialogTrigger asChild>
                {triggerElement}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Layers className="w-5 h-5 text-blue-600" />
                        Scal Repetycje Kontrahentów
                    </DialogTitle>
                    <DialogDescription>
                        Wybrałeś {selectedIds.length} rekordów do scalenia. Wskaż &quot;Rodzica&quot;, który przetrwa i przejmie wszystkie Projekty oraz Faktury. Reszta zostanie usunięta.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {error && (
                        <div className="bg-rose-50 text-rose-700 p-3 rounded-md text-sm border border-rose-200">
                            {error}
                        </div>
                    )}

                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 text-sm flex gap-3 items-start">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <p>
                            <strong>Uwaga (Operacja Bezpowrotna):</strong> Po naciśnięciu &quot;Scal&quot;, wszystkie niepoprawne wpisy zostaną wymazane bez śladu.
                        </p>
                    </div>

                    <div className="space-y-3 mt-4">
                        <label className="text-sm font-medium text-slate-700">Wybierz Rekord Nadrzędny (Master Record)</label>
                        <div className="grid gap-2">
                            {involvedContractors.map((contractor) => (
                                <div 
                                    key={contractor.id}
                                    onClick={() => setPrimaryId(contractor.id)}
                                    className={`p-3 border rounded-xl cursor-pointer transition-all flex items-center justify-between
                                        ${primaryId === contractor.id ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                                >
                                    <div>
                                        <p className="font-semibold text-slate-900">{contractor.name}</p>
                                        <p className="text-xs text-slate-500">NIP: {contractor.nip || "Brak"}</p>
                                    </div>
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center
                                        ${primaryId === contractor.id ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                                        {primaryId === contractor.id && (
                                            <div className="w-2 h-2 rounded-full bg-white" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                        Anuluj
                    </Button>
                    <Button onClick={handleMerge} disabled={loading || !primaryId} className="bg-blue-600 hover:bg-blue-700 text-white">
                        {loading ? "Scalanie..." : "Zatwierdź i Scal"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
