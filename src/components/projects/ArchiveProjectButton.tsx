"use client"

/**
 * Przycisk archiwizacji projektu - zmienia status projektu na ARCHIVED.
 */

import { useState } from "react"
import { Archive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { archiveProject } from "@/app/actions/projects"

interface ArchiveProjectButtonProps {
    projectId: string
}

export function ArchiveProjectButton({ projectId }: ArchiveProjectButtonProps) {
    const [isLoading, setIsLoading] = useState(false)

    const handleArchive = async () => {
        if (!confirm("Czy na pewno chcesz zakończyć i zarchiwizować ten projekt?")) return

        setIsLoading(true)
        try {
            await archiveProject(projectId)
        } catch (error) {
            console.error(error)
            alert("Błąd podczas archiwizacji projektu.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
            onClick={handleArchive}
            disabled={isLoading}
            title="Zakończ i Archiwizuj"
        >
            <Archive className={`h-4 w-4 ${isLoading ? 'animate-pulse' : ''}`} />
        </Button>
    )
}
