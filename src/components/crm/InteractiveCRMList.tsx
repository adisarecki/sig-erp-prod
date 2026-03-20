"use client"

import { useState } from "react"
import { Trash, Layers } from "lucide-react"
import { FloatingActionBar } from "@/components/ui/FloatingActionBar"
import { EditContractorModal } from "@/components/crm/EditContractorModal"
import { deleteContractor, deleteSelectedContractors } from "@/app/actions/crm"
import { MergeContractorsDialog } from "@/components/crm/MergeContractorsDialog"
import { Trash2 } from "lucide-react"

interface Invoice {
    id: string;
    amountGross: number;
    dueDate: Date;
    type: string;
}

interface Contractor {
    id: string;
    name: string;
    nip: string | null;
    address: string | null;
    status: string;
    invoices: Invoice[];
}

interface InteractiveCRMListProps {
    contractors: Contractor[];
}

export function InteractiveCRMList({ contractors }: InteractiveCRMListProps) {
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const now = new Date()

    const toggleSelection = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    const toggleAll = () => {
        if (selectedIds.length === contractors.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(contractors.map(c => c.id))
        }
    }

    const handleDeleteBulk = async () => {
        if (confirm("Czy na pewno chcesz usunąć trwale te rekordy z bazy?")) {
            try {
                const result = await deleteSelectedContractors(selectedIds)
                if (result.success) {
                    setSelectedIds([])
                }
            } catch (err: any) {
                alert(err.message || "Błąd podczas usuwania.")
            }
        }
    }

    const handleDeleteSingle = async (id: string, name: string) => {
        if (confirm(`Czy na pewno chcesz trwale usunąć kontrahenta "${name}"? Tej operacji nie da się cofnąć.`)) {
            try {
                await deleteContractor(id)
            } catch (err: any) {
                alert(err.message || "Błąd podczas usuwania.")
            }
        }
    }

    if (contractors.length === 0) {
        return (
            <div className="bg-white rounded-xl border shadow-sm p-8 text-center text-slate-500 font-medium italic">
                Brak zarejestrowanych firm. Dodaj pierwszą firmę, aby rozpocząć współpracę.
            </div>
        )
    }

    return (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden relative">
            <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 flex items-center gap-4">
                <input
                    type="checkbox"
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    checked={selectedIds.length === contractors.length && contractors.length > 0}
                    onChange={toggleAll}
                />
                <span className="text-sm font-semibold text-slate-600">
                    Zaznacz wszystkich
                </span>
            </div>

            <div className="divide-y divide-slate-100">
                {contractors.map((contractor) => {
                    const invoices = contractor.invoices || []
                    const overdueInvoices = invoices.filter(inv => inv.type === 'SPRZEDAŻ' && new Date(inv.dueDate) < now)
                    const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + inv.amountGross, 0)

                    return (
                        <div 
                            key={contractor.id} 
                            className={`p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-slate-50 transition-colors cursor-pointer ${selectedIds.includes(contractor.id) ? 'bg-blue-50/50' : ''}`}
                            onClick={(e) => {
                                // Prevent checkbox toggling when clicking exactly on the edit modal trigger
                                if ((e.target as HTMLElement).closest('button[data-edit="true"]')) return;
                                toggleSelection(contractor.id);
                            }}
                        >
                            <div className="flex items-start gap-4 w-full">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    checked={selectedIds.includes(contractor.id)}
                                    onChange={() => toggleSelection(contractor.id)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-lg font-bold text-slate-900">{contractor.name}</h2>
                                        {totalOverdue > 0 && (
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider animate-pulse">
                                                ZALEGA: {new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(totalOverdue)}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-slate-500 text-sm mt-1">
                                        {contractor.nip ? `NIP: ${contractor.nip}` : "Brak NIP"} • {contractor.address || "Brak adresu"}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 pl-4">
                                    <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${contractor.status === 'ACTIVE' ? 'bg-green-50 text-green-700 border-green-200' :
                                        contractor.status === 'IN_REVIEW' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                            'bg-slate-100 text-slate-700 border-slate-200'
                                        }`}>
                                        {contractor.status}
                                    </span>
                                    <div data-edit="true" className="flex items-center gap-2">
                                        <EditContractorModal contractor={{
                                            id: contractor.id,
                                            name: contractor.name,
                                            nip: contractor.nip,
                                            address: contractor.address,
                                            status: contractor.status
                                        }} />
                                        <button
                                            onClick={() => handleDeleteSingle(contractor.id, contractor.name)}
                                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-all hover:scale-110"
                                            title="Usuń kontrahenta"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            <FloatingActionBar
                selectedCount={selectedIds.length}
                onClearSelection={() => setSelectedIds([])}
                actions={[
                    {
                        label: 'Usuń Zaznaczone',
                        icon: <Trash className="w-4 h-4" />,
                        onClick: handleDeleteBulk,
                        variant: 'danger'
                    }
                ]}
            />
            
            {/* Ukryty trigger Mergera uruchamiany z poziomu paska bo potrzebuje modala */}
            {selectedIds.length > 1 && (
                <MergeContractorsDialog 
                    selectedIds={selectedIds}
                    contractorsList={contractors}
                    onSuccess={() => setSelectedIds([])}
                    triggerElement={
                        <div className="fixed bottom-8 left-[calc(50%+190px)] -translate-x-1/2 z-50">
                            {/* Dopina się wizualnie do istniejącego paska */}
                            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-2xl transition-all h-full">
                                <Layers className="w-4 h-4" /> Scal Duplikaty
                            </button>
                        </div>
                    }
                />
            )}
        </div>
    )
}
