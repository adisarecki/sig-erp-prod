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

interface ProjectCockpitActionsProps {
    projectId: string
    allProjects: { id: string; name: string }[]
    contractors: { id: string; name: string; nip?: string | null }[]
}

export function ProjectCockpitActions({ projectId, allProjects, contractors }: ProjectCockpitActionsProps) {
    const [ocrData, setOcrData] = useState<SanitizedOcrDraft | null>(null)

    const handleOcrExtracted = (data: SanitizedOcrDraft) => {
        setOcrData(data)
    }

    return (
        <div className="flex items-center gap-3">
            <InvoiceScanner onDataExtracted={handleOcrExtracted} />
            <RegisterCostModal 
                projects={allProjects} 
                contractors={contractors} 
                lockedProjectId={projectId}
                ocrData={ocrData?.type === "COST" || !ocrData ? ocrData || undefined : undefined}
            />
        </div>
    )
}
