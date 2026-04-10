"use client"

import { useState } from "react"
import { Trash, Layers, Trash2 } from "lucide-react"
import { FloatingActionBar } from "@/components/ui/FloatingActionBar"
import { EditContractorModal } from "@/components/crm/EditContractorModal"
import { deleteContractor, deleteSelectedContractors } from "@/app/actions/crm"
import { MergeContractorsDialog } from "@/components/crm/MergeContractorsDialog"
import { VatStatusBadge } from "@/components/ui/VatStatusBadge"
import type { VatStatus } from "@/app/actions/vat"
import { VatCheckButton } from "@/components/crm/VatCheckButton"

interface Invoice {
    id: string;
    amountGross: number;
    dueDate: Date;
    type: string;
    status: string;
}

interface Contractor {
    id: string;
    name: string;
    nip: string | null;
    address: string | null;
    type: string;
    status: string;
    invoices: Invoice[];
    objects: { id: string, name: string }[];
}

interface InteractiveCRMListProps {
    contractors: Contractor[];
}

export function InteractiveCRMList({ contractors }: InteractiveCRMListProps) {
    const [selectedIds, setSelectedIds] = useState<string[]>([])

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

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
                <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <input
                            type="checkbox"
                            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            checked={selectedIds.length === contractors.length && contractors.length > 0}
                            onChange={toggleAll}
                        />
                        <span className="text-sm font-bold text-slate-600 uppercase tracking-tighter">
                            Zaznacz wszystkich ({contractors.length})
                        </span>
                    </div>
                    {/* VERSION TAG FOR DEBUGGING */}
                    <span className="text-[9px] font-mono text-slate-300">V.018-RESCUE-ACTIVE</span>
                </div>

                <div className="divide-y divide-slate-100">
                    {contractors.length === 0 ? (
                        <div className="p-20 text-center text-slate-400 font-medium italic">
                            Brak kontrahentów do wyświetlenia.
                        </div>
                    ) : (
                        contractors.map((contractor) => {
                            const invoices = contractor.invoices || []
                            // STRICT LOGIC: Formula: Debt = SUM(Invoice.amountGross) WHERE Invoice.status NOT IN ('PAID', 'REVERSED')
                            const unpaidInvoices = invoices.filter(inv => 
                                inv.status !== 'PAID' && 
                                inv.status !== 'REVERSED'
                            )
                            const totalDebt = unpaidInvoices.reduce((sum, inv) => sum + inv.amountGross, 0)

                            return (
                                <div
                                    key={contractor.id}
                                    className={`p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-slate-50/50 transition-all cursor-pointer ${selectedIds.includes(contractor.id) ? 'bg-blue-50/30' : ''}`}
                                    onClick={(e) => {
                                        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
                                        toggleSelection(contractor.id);
                                    }}
                                >
                                    <div className="flex items-start gap-4 flex-1">
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 mt-1.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            checked={selectedIds.includes(contractor.id)}
                                            onChange={() => toggleSelection(contractor.id)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <h2 className="text-lg font-extrabold text-slate-900 truncate">
                                                    {contractor.name}
                                                </h2>
                                                
                                                {/* TYPE BADGE */}
                                                <span className={`px-2 py-0.5 text-[10px] font-black rounded border uppercase tracking-wider ${
                                                    contractor.type === 'INWESTOR' 
                                                    ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                                    : 'bg-orange-50 text-orange-700 border-orange-200'
                                                }`}>
                                                    {contractor.type}
                                                </span>

                                                {/* DEBT BADGE - TOTAL DESTROY IF 0 */}
                                                {totalDebt > 0 && (
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-300 uppercase tracking-widest animate-pulse shadow-sm">
                                                        ZALEGA: {new Intl.PluralRules('pl-PL').select(totalDebt) && new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(totalDebt)}
                                                    </span>
                                                )}

                                                {/* VAT SHIELD CHECK - Vector 140 */}
                                                {contractor.nip && (
                                                    <VatCheckButton nip={contractor.nip} />
                                                )}
                                            </div>
                                            <p className="text-slate-500 text-sm mt-0.5">
                                                {contractor.nip ? `NIP: ${contractor.nip}` : "Brak NIP"} • {contractor.address || "Brak adresu"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 mt-4 sm:mt-0 pl-11 sm:pl-0">
                                        <span className={`px-3 py-1 text-[10px] font-black rounded-full border uppercase tracking-widest ${
                                            contractor.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                            'bg-slate-100 text-slate-600 border-slate-200'
                                        }`}>
                                            {contractor.status}
                                        </span>
                                        
                                        <div className="flex items-center gap-1">
                                            <EditContractorModal contractor={{
                                                ...contractor,
                                                type: contractor.type || "INWESTOR",
                                                objects: contractor.objects || []
                                            }} />
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteSingle(contractor.id, contractor.name);
                                                }}
                                                className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                title="Usuń na stałe"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
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

            {selectedIds.length > 1 && (
                <MergeContractorsDialog
                    selectedIds={selectedIds}
                    contractorsList={contractors}
                    onSuccess={() => setSelectedIds([])}
                    triggerElement={
                        <div className="fixed bottom-8 left-[calc(50%+190px)] -translate-x-1/2 z-50">
                            <button className="flex items-center gap-2 px-6 py-3 text-xs font-black uppercase tracking-widest rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-2xl transition-all h-full scale-110 active:scale-100">
                                <Layers className="w-4 h-4" /> Scal Duplikaty
                            </button>
                        </div>
                    }
                />
            )}
        </div>
    )
}
