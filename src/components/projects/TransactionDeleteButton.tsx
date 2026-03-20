"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { deleteTransaction } from "@/app/actions/transactions"
import { useRouter } from "next/navigation"

interface TransactionDeleteButtonProps {
    transactionId: string
    description?: string
    isTestMode?: boolean
}

export function TransactionDeleteButton({ transactionId, description, isTestMode }: TransactionDeleteButtonProps) {
    const [isDeleting, setIsDeleting] = useState(false)
    const router = useRouter()
    
    // isTestMode is now passed as a prop from the server-rendered page
    if (!isTestMode) return null

    const handleDelete = async () => {
        const confirmed = confirm(`Czy na pewno chcesz USUNĄĆ tę transakcję?\n\n"${description || 'Brak opisu'}"\n\nOperacja jest nieodwracalna i natychmiast wpłynie na budżet projektu.`)
        if (!confirmed) return

        setIsDeleting(true)
        try {
            await deleteTransaction(transactionId)
            router.refresh()
        } catch (error) {
            alert("Błąd podczas usuwania transakcji: " + (error as Error).message)
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            disabled={isDeleting}
            className="h-8 w-8 text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-all focus:ring-rose-500"
            title="Usuń transakcję (Tryb Testowy)"
        >
            <Trash2 className={`w-4 h-4 ${isDeleting ? 'animate-pulse' : ''}`} />
        </Button>
    )
}
