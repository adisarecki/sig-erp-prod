"use client"

import { useState } from "react"
import Link from "next/link"
import { Archive, Pause, Play, Trash2, Building2, MapPin, Clock, ChevronRight, Plus, Filter, Search, Download, Trash, Layers } from "lucide-react"
import { FloatingActionBar } from "@/components/ui/FloatingActionBar"
import { Button } from "@/components/ui/button"
import { bulkUpdateProjectLifecycle } from "@/app/actions/projectsBulk"
import { deleteProject, deleteSelectedProjects } from "@/app/actions/projects"
import { ProjectAnalysisDialog } from "@/components/projects/ProjectAnalysisDialog"
import { EditProjectModal } from "@/components/projects/EditProjectModal"
import { ClosureProjectModal } from "@/components/projects/ClosureProjectModal"
import { RegisterIncomeModal } from "@/components/finance/RegisterIncomeModal"
import { RegisterCostModal } from "@/components/finance/RegisterCostModal"
import { ProjectFinancialDetailsModal } from "@/components/projects/ProjectFinancialDetailsModal"
import { TrendingUp, PlusCircle, MinusCircle } from "lucide-react"
import { TooltipHelp } from "@/components/ui/TooltipHelp"
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay"

// Typ pomocniczy dla formattera PLN
const formatPln = (value: number) => {
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value)
}

interface ProjectData {
    id: string;
    name: string;
    type: string;
    status: string;
    lifecycleStatus: string;
    budgetEstimated: number | string | { toNumber: () => number };
    contractorId: string;
    contractor: { name: string };
    object: { name: string; address: string | null };
    invoices: { type: string; amountNet: number | string; amountGross?: number | string; issueDate: string | Date }[];
    transactions: { type: string; amount: number | string; transactionDate: string | Date }[];
    retentionShortTermRate?: number;
    retentionLongTermRate?: number;
    estimatedCompletionDate?: string | Date;
    warrantyPeriodYears?: number;
}

interface InteractiveProjectListProps {
    projects: ProjectData[];
    contractors: { id: string; name: string; nip?: string | null }[];
    isArchivedView?: boolean;
}

export function InteractiveProjectList({ projects, contractors, isArchivedView = false }: InteractiveProjectListProps) {
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [financialModalState, setFinancialModalState] = useState<{ projectId: string; projectName: string; fieldType: 'REVENUES' | 'COSTS' | 'MARGIN' } | null>(null)
    
    const toggleSelection = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    const toggleAll = () => {
        if (selectedIds.length === projects.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(projects.map(p => p.id))
        }
    }

    const handleBulkStatusChange = async (status: 'ACTIVE' | 'ON_HOLD' | 'ARCHIVED') => {
        const result = await bulkUpdateProjectLifecycle(selectedIds, status)
        if (result.success) {
            setSelectedIds([])
        } else {
            alert(result.error)
        }
    }

    const handleDeleteBulk = async () => {
        if (confirm(`Czy na pewno chcesz TRWALE usunąć ${selectedIds.length} zaznaczonych projektów? Usunięte zostaną także wszystkie powiązane etapy, faktury i transakcje. Tej operacji nie da się cofnąć.`)) {
            try {
                const res = await deleteSelectedProjects(selectedIds);
                if (res.success) {
                    setSelectedIds([]);
                }
            } catch (err: any) {
                alert(err.message || "Wystąpił błąd podczas usuwania projektów.");
            }
        }
    }

    const handleDeleteSingle = async (e: React.MouseEvent, id: string, name: string) => {
        e.stopPropagation();
        if (confirm(`Czy na pewno chcesz TRWALE usunąć projekt "${name}"? Usunięte zostaną także wszystkie powiązane etapy, faktury i transakcje. Tej operacji nie da się cofnąć.`)) {
            try {
                const res = await deleteProject(id);
                if (res.success) {
                    setSelectedIds(prev => prev.filter(x => x !== id));
                }
            } catch (err: any) {
                alert(err.message || "Wystąpił błąd podczas usuwania projektu.");
            }
        }
    }

    if (projects.length === 0) {
        return (
            <div className="bg-white rounded-xl border shadow-sm p-12 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 mb-4">
                    <span className="text-xl">📁</span>
                </div>
                <p className="text-slate-500 italic">Brak projektów w tej kategorii.</p>
            </div>
        )
    }

    // Definicja dostępnych akcji w zależności od widoku
    const activeActions = [
        {
            label: 'Archiwizuj',
            icon: <Archive className="w-4 h-4" />,
            onClick: () => handleBulkStatusChange('ARCHIVED'),
            variant: 'danger' as const
        },
        {
            label: 'Wstrzymaj',
            icon: <Pause className="w-4 h-4" />,
            onClick: () => handleBulkStatusChange('ON_HOLD')
        },
        {
            label: 'Usuń',
            icon: <Trash2 className="w-4 h-4" />,
            onClick: handleDeleteBulk,
            variant: 'danger' as const
        }
    ]

    const archivedActions = [
        {
            label: 'Przywróć (Aktywuj)',
            icon: <Play className="w-4 h-4" />,
            onClick: () => handleBulkStatusChange('ACTIVE'),
            variant: 'primary' as const
        },
        {
            label: 'Usuń Trwale',
            icon: <Trash2 className="w-4 h-4" />,
            onClick: handleDeleteBulk,
            variant: 'danger' as const
        }
    ]

    return (
        <div className="grid gap-6">
            <div className="border border-slate-200 bg-white rounded-xl px-4 py-3 flex items-center gap-4 shadow-sm">
                <input
                    type="checkbox"
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    checked={selectedIds.length === projects.length && projects.length > 0}
                    onChange={toggleAll}
                />
                <span className="text-sm font-semibold text-slate-700">
                    Zaznacz wszystkie widoczne projekty
                </span>
            </div>

            {/* GLOBAL SUMMARY: Realny Limit Operacyjny (suma wszystkich projektów) */}
            {projects.length > 0 && (() => {
                const totalGlobalRealRevenue = projects.reduce((sum, project) => {
                    const budgetVal = Number(project.budgetEstimated);
                    const shortRate = project.retentionShortTermRate ?? 0;
                    const longRate = project.retentionLongTermRate ?? 0;
                    const totalRate = shortRate + longRate;
                    const retentionAmount = budgetVal * totalRate;
                    const realRevenue = budgetVal - retentionAmount;
                    return sum + realRevenue;
                }, 0);

                const totalGlobalRetention = projects.reduce((sum, project) => {
                    const budgetVal = Number(project.budgetEstimated);
                    const shortRate = project.retentionShortTermRate ?? 0;
                    const longRate = project.retentionLongTermRate ?? 0;
                    const totalRate = shortRate + longRate;
                    const retentionAmount = budgetVal * totalRate;
                    return sum + retentionAmount;
                }, 0);

                const tooltipContent = (
                    <div className="space-y-3 text-left">
                        <div>
                            <p className="font-bold text-blue-300 mb-1">📋 CAŁKOWITA UMOWA (Wszystkie Projekty):</p>
                            <p className="text-lg font-black text-blue-200">{formatPln(totalGlobalRealRevenue + totalGlobalRetention)}</p>
                            <p className="text-xs text-slate-300 mt-1">Suma wartości wszystkich kontraktów</p>
                        </div>
                        <div className="border-t border-slate-600 pt-2">
                            <p className="font-bold text-amber-300 mb-1">🔒 KAUCJE (Zabezpieczenia):</p>
                            <p className="text-lg font-black text-amber-200">{formatPln(totalGlobalRetention)}</p>
                            <p className="text-xs text-slate-300 mt-1">Zatrzymane u kontraktorów - będą zwrócone</p>
                        </div>
                        <div className="border-t border-slate-600 pt-2">
                            <p className="font-bold text-emerald-300 mb-1">💚 DOSTĘPNE (Rzeczywista Płynność):</p>
                            <p className="text-lg font-black text-emerald-200">{formatPln(totalGlobalRealRevenue)}</p>
                            <p className="text-xs text-slate-300 mt-1">Pieniądze gotowe do operacyjnego wydania</p>
                        </div>
                        <div className="border-t border-slate-600 pt-2">
                            <p className="font-bold text-sky-300 mb-2">📊 ROZBICIE PO PROJEKTACH:</p>
                            <div className="space-y-1 max-h-[200px] overflow-y-auto">
                                {projects.map((p) => {
                                    const pBudget = Number(p.budgetEstimated);
                                    const pShort = p.retentionShortTermRate ?? 0;
                                    const pLong = p.retentionLongTermRate ?? 0;
                                    const pTotalRate = pShort + pLong > 0 ? pShort + pLong : 0.1;
                                    const pRetention = pBudget * pTotalRate;
                                    const pRealRevenue = pBudget - pRetention;
                                    return (
                                        <div key={p.id} className="text-xs bg-slate-700 bg-opacity-50 p-1.5 rounded">
                                            <div className="flex justify-between items-center">
                                                <span className="font-semibold text-slate-200">{p.name}</span>
                                            </div>
                                            <div className="flex gap-2 mt-0.5 text-slate-300">
                                                <span>💚 {formatPln(pRealRevenue)}</span>
                                                <span>🔒 {formatPln(pRetention)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );

                return (
                    <div className="border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 md:p-6 shadow-md">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <div className="flex-shrink-0 text-blue-600 text-3xl sm:text-2xl">
                                🔒
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-xs sm:text-sm font-bold uppercase text-blue-700 tracking-wider truncate">
                                        Dostępne do Operacyjnego Wydania
                                    </p>
                                    <TooltipHelp content={tooltipContent} />
                                </div>
                                <p className="text-3xl sm:text-4xl font-black text-slate-900 mt-1 sm:mt-2 leading-tight truncate">
                                    {formatPln(totalGlobalRealRevenue)}
                                </p>
                                <p className="text-[10px] sm:text-xs font-semibold text-slate-500 mt-1 sm:mt-2 uppercase tracking-widest leading-relaxed">
                                    Rzeczywista Płynność Operacyjna – Suma wszystkich projektów
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {projects.map((project) => {
                const invoices = project.invoices || []
                const transactions = project.transactions || []
                const totalInvoicedNet = invoices
                    .filter((inv) => inv.type === 'SPRZEDAŻ' || inv.type === 'INCOME' || inv.type === 'REVENUE' || inv.type === 'PRZYCHÓD')
                    .reduce((sum: number, inv) => sum + Number(inv.amountNet), 0)
                const totalInvoicedGross = invoices
                    .filter((inv) => inv.type === 'SPRZEDAŻ' || inv.type === 'INCOME' || inv.type === 'REVENUE' || inv.type === 'PRZYCHÓD')
                    .reduce((sum: number, inv) => sum + Number(inv.amountGross || inv.amountNet), 0)

                const totalCostsNet = invoices
                    .filter((inv) => inv.type === 'KOSZT' || inv.type === 'EXPENSE' || inv.type === 'ZAKUP' || inv.type === 'WYDATEK')
                    .reduce((sum: number, inv) => sum + Number(inv.amountNet), 0)
                const totalCostsGross = invoices
                    .filter((inv) => inv.type === 'KOSZT' || inv.type === 'EXPENSE' || inv.type === 'ZAKUP' || inv.type === 'WYDATEK')
                    .reduce((sum: number, inv) => sum + Number(inv.amountGross || inv.amountNet), 0)

                const currentMarginNet = totalInvoicedNet - totalCostsNet
                const currentMarginGross = totalInvoicedGross - totalCostsGross
                const isLoss = currentMarginNet < 0

                return (
                    <div
                        key={project.id}
                        className={`bg-white rounded-xl border transition cursor-pointer overflow-hidden
                            ${project.lifecycleStatus === 'ARCHIVED' ? 'opacity-75 grayscale-[0.5]' : ''}
                            ${selectedIds.includes(project.id) ? 'border-blue-500 ring-1 ring-blue-500 shadow-md' : 'border-slate-200 hover:shadow-md'}`}
                        onClick={(e) => {
                            // Zapobieganie zmianie Checkbox po kliknięciu Analizy
                            if ((e.target as HTMLElement).closest('button[data-dialog="true"]')) return;
                            toggleSelection(project.id);
                        }}
                    >
                        <div className={`p-6 border-b flex flex-col lg:flex-row justify-between items-start gap-4 lg:gap-0 ${selectedIds.includes(project.id) ? 'bg-blue-50/30' : ''}`}>
                            <div className="flex items-start gap-4">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    checked={selectedIds.includes(project.id)}
                                    onChange={() => toggleSelection(project.id)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <div>
                                    <div className="flex items-center gap-3">
                                        <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md border border-slate-200">
                                            {project.type}
                                        </span>
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-md border ${project.lifecycleStatus === 'ARCHIVED' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                                            project.lifecycleStatus === 'ON_HOLD' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                'bg-green-100 text-green-700 border-green-200'}`}>
                                            {project.lifecycleStatus === 'ARCHIVED' ? 'ZARCHIWIZOWANY' :
                                                project.lifecycleStatus === 'ON_HOLD' ? 'WSTRZYMANY' : project.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Link
                                            href={`/projects/${project.id}`}
                                            className="hover:underline decoration-blue-500 underline-offset-4 decoration-2"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <h2 className="text-xl font-bold text-slate-900">{project.name}</h2>
                                        </Link>
                                        <div className="flex items-center gap-1">
                                            <EditProjectModal
                                                project={{
                                                    id: project.id,
                                                    name: project.name,
                                                    budgetEstimated: Number(project.budgetEstimated),
                                                    retentionShortTermRate: project.retentionShortTermRate,
                                                    retentionLongTermRate: project.retentionLongTermRate,
                                                    estimatedCompletionDate: project.estimatedCompletionDate,
                                                    warrantyPeriodYears: project.warrantyPeriodYears
                                                }}
                                            />
                                            {project.status !== 'CLOSED' && (
                                                <ClosureProjectModal 
                                                    projectId={project.id}
                                                    projectName={project.name}
                                                    budgetEstimated={Number(project.budgetEstimated)}
                                                    totalInvoicedNet={totalInvoicedNet}
                                                />
                                            )}
                                            <button
                                                onClick={(e) => handleDeleteSingle(e, project.id, project.name)}
                                                className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-all hover:scale-110"
                                                title="Usuń projekt"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-slate-500 mt-1 text-sm">
                                        Inwestor: <strong className="text-slate-700">{project.contractor.name}</strong> •
                                        Obiekt: <strong className="text-slate-700">{project.object.name}</strong>
                                        ({project.object.address})
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between lg:justify-end w-full lg:w-auto gap-4 pl-9 lg:pl-0">
                                <div className="flex flex-col items-start lg:items-end lg:mr-4 w-full sm:w-auto">
                                    {/* VECTOR 101: INDIVIDUAL PROJECT RETENTION */}
                                    {(() => {
                                        const budgetVal = Number(project.budgetEstimated);
                                        const shortRate = project.retentionShortTermRate ?? 0;
                                        const longRate = project.retentionLongTermRate ?? 0;
                                        const totalRate = shortRate + longRate;
                                        const retentionAmount = budgetVal * totalRate;
                                        const realRevenue = budgetVal - retentionAmount;

                                        const projectTooltip = (
                                            <div className="space-y-2 text-left">
                                                <div>
                                                    <p className="font-bold text-blue-300 mb-0.5">📋 UMOWA (Całkowita)</p>
                                                    <p className="text-sm font-black text-blue-200">{formatPln(budgetVal)}</p>
                                                    <p className="text-xs text-slate-300">Całkowita kwota kontraktu (bez odliczeń)</p>
                                                </div>
                                                <div className="border-t border-slate-600 pt-2">
                                                    <p className="font-bold text-amber-300 mb-0.5">🔒 KAUCJA (Zabezpieczenie)</p>
                                                    <p className="text-sm font-black text-amber-200">{formatPln(retentionAmount)}</p>
                                                    <p className="text-xs text-slate-300">Zatrzymane u: <strong>{project.contractor?.name || 'N/A'}</strong></p>
                                                    <p className="text-xs text-slate-300">({(totalRate * 100).toFixed(0)}% umowy)</p>
                                                </div>
                                                <div className="border-t border-slate-600 pt-2">
                                                    <p className="font-bold text-emerald-300 mb-0.5">💚 DOSTĘPNE (Paliwo)</p>
                                                    <p className="text-sm font-black text-emerald-200">{formatPln(realRevenue)}</p>
                                                    <p className="text-xs text-slate-300">Rzeczywiste do wydania teraz</p>
                                                </div>
                                            </div>
                                        );

                                        return (
                                            <div className="flex flex-col items-start lg:items-end">
                                                <div className="flex items-center gap-2 whitespace-nowrap">
                                                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                                                        Paliwo tego projektu
                                                    </p>
                                                    <TooltipHelp content={projectTooltip} />
                                                </div>
                                                <p className="text-lg font-bold text-emerald-600 leading-tight">
                                                    {formatPln(realRevenue)}
                                                </p>
                                                
                                                {totalRate > 0 && (
                                                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex items-center gap-2 w-full sm:w-auto">
                                                        <span className="text-base">🔒</span>
                                                        <div className="whitespace-nowrap overflow-hidden">
                                                            <p className="text-[10px] font-bold text-amber-700 uppercase leading-none">Kaucja</p>
                                                            <div className="flex items-center gap-1">
                                                                <p className="text-sm font-bold text-amber-800">{formatPln(retentionAmount)}</p>
                                                                <p className="text-[10px] text-amber-600 font-medium">({(totalRate * 100).toFixed(0)}%)</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                                <div className="flex items-center gap-2 lg:border-l lg:border-slate-100 lg:pl-4 h-full w-full sm:w-auto" data-dialog="true">
                                    <ProjectAnalysisDialog
                                        projectName={project.name}
                                        invoices={project.invoices.map((inv) => ({
                                            type: inv.type,
                                            amountNet: Number(inv.amountNet),
                                            amountGross: Number(inv.amountGross || inv.amountNet),
                                            issueDate: typeof inv.issueDate === 'string' ? inv.issueDate : (inv.issueDate as Date).toISOString()
                                        }))}
                                        transactions={project.transactions.map((t) => ({
                                            type: t.type,
                                            amount: Number(t.amount),
                                            transactionDate: typeof t.transactionDate === 'string' ? t.transactionDate : (t.transactionDate as Date).toISOString()
                                        }))}
                                        budgetEstimated={Number(project.budgetEstimated)}
                                        retentionRate={(project.retentionShortTermRate || 0) + (project.retentionLongTermRate || 0) || 0.1}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className={`p-6 border-t flex flex-wrap gap-3 ${selectedIds.includes(project.id) ? 'bg-slate-50/50' : 'bg-slate-50'}`}>
                            <div className="flex-1 flex flex-col md:flex-row gap-6">
                                <div 
                                    className="cursor-pointer hover:opacity-75 transition-opacity"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFinancialModalState({ projectId: project.id, projectName: project.name, fieldType: 'REVENUES' });
                                    }}
                                >
                                    <p className="text-sm font-medium text-slate-500 mb-1">Zaksięgowane Przychody</p>
                                    <CurrencyDisplay gross={totalInvoicedGross} net={totalInvoicedNet} isIncome={true} className="text-xl font-bold text-slate-800" />
                                </div>
                                <div 
                                    className="cursor-pointer hover:opacity-75 transition-opacity"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFinancialModalState({ projectId: project.id, projectName: project.name, fieldType: 'COSTS' });
                                    }}
                                >
                                    <p className="text-sm font-medium text-slate-500 mb-1">Poniesione Koszty</p>
                                    <CurrencyDisplay gross={totalCostsGross} net={totalCostsNet} isIncome={false} className="text-xl font-bold text-red-600" />
                                </div>
                                <div 
                                    className="md:pl-6 md:border-l md:border-slate-200 cursor-pointer hover:opacity-75 transition-opacity"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFinancialModalState({ projectId: project.id, projectName: project.name, fieldType: 'MARGIN' });
                                    }}
                                >
                                    <p className="text-sm font-medium text-slate-500 mb-1">Obecna Marża Zysku (Netto)</p>
                                    <CurrencyDisplay gross={currentMarginGross} net={currentMarginNet} isIncome={true} className={`text-2xl font-bold ${isLoss ? 'text-red-600' : 'text-green-600'}`} />
                                </div>
                            </div>

                            {/* Akcje finansowe */}
                            {!isArchivedView && (
                                <div className="flex items-center gap-2 mt-4 md:mt-0" onClick={(e) => e.stopPropagation()}>
                                    <RegisterIncomeModal
                                        projects={projects.map(p => ({ id: p.id, name: p.name, contractorId: p.contractorId }))}
                                        contractors={contractors}
                                        lockedProjectId={project.id}
                                        trigger={
                                            <Button variant="outline" className="border-emerald-500 text-emerald-700 hover:bg-emerald-50 gap-2 h-9">
                                                <PlusCircle className="w-4 h-4" />
                                                Dodaj Przychód
                                            </Button>
                                        }
                                    />
                                    <RegisterCostModal
                                        projects={projects.map(p => ({ id: p.id, name: p.name, contractorId: p.contractorId }))}
                                        contractors={contractors}
                                        lockedProjectId={project.id}
                                        trigger={
                                            <Button variant="outline" className="border-rose-500 text-rose-700 hover:bg-rose-50 gap-2 h-9">
                                                <MinusCircle className="w-4 h-4" />
                                                Dodaj Koszt
                                            </Button>
                                        }
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}

            <FloatingActionBar
                selectedCount={selectedIds.length}
                onClearSelection={() => setSelectedIds([])}
                actions={isArchivedView ? archivedActions : activeActions}
            />

            {/* Render Financial Details Modal */}
            {financialModalState && (
                <ProjectFinancialDetailsModal
                    isOpen={!!financialModalState}
                    onClose={() => setFinancialModalState(null)}
                    projectName={financialModalState.projectName}
                    fieldType={financialModalState.fieldType}
                    invoices={projects.find(p => p.id === financialModalState.projectId)?.invoices.map(inv => ({
                        type: inv.type,
                        amountNet: Number(inv.amountNet),
                        amountGross: Number(inv.amountGross || inv.amountNet),
                        issueDate: inv.issueDate,
                        invoiceNumber: (inv as any).invoiceNumber,
                        contractorName: (inv as any).contractorName
                    })) || []}
                    totalInvoicedNet={projects.find(p => p.id === financialModalState.projectId)?.invoices
                        .filter((inv) => inv.type === 'SPRZEDAŻ' || inv.type === 'INCOME' || inv.type === 'REVENUE' || inv.type === 'PRZYCHÓD')
                        .reduce((sum: number, inv) => sum + Number(inv.amountNet), 0) || 0}
                    totalInvoicedGross={projects.find(p => p.id === financialModalState.projectId)?.invoices
                        .filter((inv) => inv.type === 'SPRZEDAŻ' || inv.type === 'INCOME' || inv.type === 'REVENUE' || inv.type === 'PRZYCHÓD')
                        .reduce((sum: number, inv) => sum + Number(inv.amountGross || inv.amountNet), 0) || 0}
                    totalCostsNet={projects.find(p => p.id === financialModalState.projectId)?.invoices
                        .filter((inv) => inv.type === 'KOSZT' || inv.type === 'EXPENSE' || inv.type === 'ZAKUP' || inv.type === 'WYDATEK')
                        .reduce((sum: number, inv) => sum + Number(inv.amountNet), 0) || 0}
                    totalCostsGross={projects.find(p => p.id === financialModalState.projectId)?.invoices
                        .filter((inv) => inv.type === 'KOSZT' || inv.type === 'EXPENSE' || inv.type === 'ZAKUP' || inv.type === 'WYDATEK')
                        .reduce((sum: number, inv) => sum + Number(inv.amountGross || inv.amountNet), 0) || 0}
                    currentMarginNet={(projects.find(p => p.id === financialModalState.projectId)?.invoices
                        .filter((inv) => inv.type === 'SPRZEDAŻ' || inv.type === 'INCOME' || inv.type === 'REVENUE' || inv.type === 'PRZYCHÓD')
                        .reduce((sum: number, inv) => sum + Number(inv.amountNet), 0) || 0) - 
                        (projects.find(p => p.id === financialModalState.projectId)?.invoices
                        .filter((inv) => inv.type === 'KOSZT' || inv.type === 'EXPENSE' || inv.type === 'ZAKUP' || inv.type === 'WYDATEK')
                        .reduce((sum: number, inv) => sum + Number(inv.amountNet), 0) || 0)}
                    currentMarginGross={(projects.find(p => p.id === financialModalState.projectId)?.invoices
                        .filter((inv) => inv.type === 'SPRZEDAŻ' || inv.type === 'INCOME' || inv.type === 'REVENUE' || inv.type === 'PRZYCHÓD')
                        .reduce((sum: number, inv) => sum + Number(inv.amountGross || inv.amountNet), 0) || 0) - 
                        (projects.find(p => p.id === financialModalState.projectId)?.invoices
                        .filter((inv) => inv.type === 'KOSZT' || inv.type === 'EXPENSE' || inv.type === 'ZAKUP' || inv.type === 'WYDATEK')
                        .reduce((sum: number, inv) => sum + Number(inv.amountGross || inv.amountNet), 0) || 0)}
                />
            )}
        </div>
    )
}
