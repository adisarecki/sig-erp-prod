"use client"

import dynamic from "next/dynamic"
import { RegisterCostModal } from "@/components/finance/RegisterCostModal"
import { RegisterIncomeModal } from "@/components/finance/RegisterIncomeModal"

// Dynamically load InvoiceScanner with SSR disabled to prevent pdfjs-dist issues
const InvoiceScanner = dynamic(() => import("@/components/finance/InvoiceScanner").then(mod => mod.InvoiceScanner), {
    ssr: false,
    loading: () => <div className="animate-pulse bg-slate-100 h-10 w-32 rounded-lg" />
})
import { Trash2 } from "lucide-react"
import { deleteProject } from "@/app/actions/projects"
import { ClosureProjectModal } from "./ClosureProjectModal"

interface ProjectCockpitActionsProps {
    projectId: string
    projectName: string
    budgetEstimated: number
    totalInvoicedNet: number
    allProjects: { id: string; name: string }[]
    contractors: { id: string; name: string; nip?: string | null }[]
    isTestMode?: boolean
    projectStatus?: string
}

export function ProjectCockpitActions({ 
    projectId, 
    projectName,
    budgetEstimated,
    totalInvoicedNet,
    allProjects, 
    contractors, 
    isTestMode,
    projectStatus
}: ProjectCockpitActionsProps) {
    // router no longer needed in this component

    const handleDelete = async () => {
        if (confirm("Czy na pewno chcesz TRWALE usunąć ten projekt? Usunięte zostaną także wszystkie powiązane etapy, faktury i transakcje. Tej operacji nie da się cofnąć.")) {
            try {
                const res = await deleteProject(projectId);
                if (res?.error) {
                    alert(res.error)
                }
                // Jeśli res.success lub brak błędu, akcja sama zrobi redirect lub my to obsłużymy.
                // Ponieważ deleteProject teraz robi redirect("/projects"), 
                // to wywołanie rzuci wyjątek, który zostanie złapany przez Next.js.
            } catch (err: any) {
                // Jeśli to błąd redirektu Next.js, ignorujemy (on sam obsłuży przejście)
                if (err.message === 'NEXT_REDIRECT') return;
                console.error("Delete project error:", err);
            }
        }
    }

    return (
        <div className="flex items-center gap-3">
            {isTestMode && (
                <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-all uppercase tracking-tight"
                >
                    <Trash2 className="w-4 h-4" />
                    Usuń Projekt
                </button>
            )}
            
            {projectStatus !== 'CLOSED' && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg pl-4 pr-1 py-1">
                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest hidden sm:inline">Gotowy do odbioru?</span>
                    <ClosureProjectModal 
                        projectId={projectId}
                        projectName={projectName}
                        budgetEstimated={budgetEstimated}
                        totalInvoicedNet={totalInvoicedNet}
                    />
                </div>
            )}

            <InvoiceScanner />
            <RegisterIncomeModal 
                projects={allProjects} 
                contractors={contractors} 
                lockedProjectId={projectId}
            />
            <RegisterCostModal 
                projects={allProjects} 
                contractors={contractors} 
                lockedProjectId={projectId}
            />
        </div>
    )
}
