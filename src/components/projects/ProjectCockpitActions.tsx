"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { RegisterCostModal } from "@/components/finance/RegisterCostModal"
import type { SanitizedOcrDraft } from "@/lib/schemas/ocr-draft"

// Dynamically load InvoiceScanner with SSR disabled to prevent pdfjs-dist issues
const InvoiceScanner = dynamic(() => import("@/components/finance/InvoiceScanner").then(mod => mod.InvoiceScanner), {
    ssr: false,
    loading: () => <div className="animate-pulse bg-slate-100 h-10 w-32 rounded-lg" />
})

import { RegisterIncomeModal } from "@/components/finance/RegisterIncomeModal"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { deleteProject } from "@/app/actions/projects"

interface ProjectCockpitActionsProps {
    projectId: string
    allProjects: { id: string; name: string }[]
    contractors: { id: string; name: string; nip?: string | null }[]
}

export function ProjectCockpitActions({ projectId, allProjects, contractors }: ProjectCockpitActionsProps) {
    const [ocrData, setOcrData] = useState<SanitizedOcrDraft | null>(null)
    const router = useRouter()

    const handleOcrExtracted = (data: SanitizedOcrDraft) => {
        setOcrData(data)
    }

    const handleDelete = async () => {
        if (confirm("Czy na pewno chcesz TRWALE usunąć ten projekt? Usunięte zostaną także wszystkie powiązane etapy, faktury i transakcje. Tej operacji nie da się cofnąć.")) {
            try {
                const res = await deleteProject(projectId);
                if (res.success) {
                    router.push("/projects");
                }
            } catch (err: any) {
                alert(err.message || "Błąd usuwania projektu.");
            }
        }
    }

    const isTestMode = process.env.NEXT_PUBLIC_ENABLE_TEST_DELETE === "true"

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
            <InvoiceScanner onDataExtracted={handleOcrExtracted} />
            <RegisterIncomeModal 
                projects={allProjects} 
                contractors={contractors} 
                lockedProjectId={projectId}
                ocrData={ocrData?.type === "INCOME" ? ocrData : undefined}
            />
            <RegisterCostModal 
                projects={allProjects} 
                contractors={contractors} 
                lockedProjectId={projectId}
                ocrData={ocrData?.type === "COST" || !ocrData ? ocrData || undefined : undefined}
            />
        </div>
    )
}
