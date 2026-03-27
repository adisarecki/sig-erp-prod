"use client"

import { useState } from "react"
import { RefreshCw, DownloadCloud, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { motion } from "framer-motion"

interface KSeFSyncButtonProps {
    hasToken: boolean
    variant?: "default" | "outline" | "ghost" | "secondary"
    className?: string
    showLabel?: boolean
}

/**
 * KSeFSyncButton
 * Manages the manual trigger for KSeF synchronization.
 * Security: Only visible if hasToken is true.
 */
export function KSeFSyncButton({ hasToken, variant = "outline", className = "", showLabel = true }: KSeFSyncButtonProps) {
    const [isSyncing, setIsSyncing] = useState(false)

    // Security Guard: Hidden if no token configured
    if (!hasToken) return null

    const handleSync = async () => {
        setIsSyncing(true)
        const toastId = toast.loading("Synchronizacja z KSeF...", {
            description: "Pobieranie faktur z ostatniego miesiąca."
        })

        try {
            const response = await fetch("/api/ksef/sync")
            const result = await response.json()

            if (result.success) {
                toast.success("Synchronizacja zakończona", {
                    id: toastId,
                    description: `Pobrano ${result.count} nowych faktur do Inboxa (UNVERIFIED).`
                })
                // Optional: Trigger revalidation or reload
                setTimeout(() => window.location.reload(), 1500)
            } else {
                toast.error("Błąd synchronizacji", {
                    id: toastId,
                    description: result.error || "Wystąpił problem podczas komunikacji z KSeF."
                })
            }
        } catch (error) {
            console.error("[KSeF_SYNC_UI_ERROR]", error)
            toast.error("Błąd sieci", {
                id: toastId,
                description: "Nie udało się nawiązać połączenia z API KSeF."
            })
        } finally {
            setIsSyncing(false)
        }
    }

    return (
        <Button
            variant={variant}
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            className={`flex items-center gap-2 font-bold transition-all active:scale-95 ${className}`}
        >
            <motion.div
                animate={isSyncing ? { rotate: 360 } : {}}
                transition={isSyncing ? { repeat: Infinity, duration: 1, ease: "linear" } : {}}
            >
                {isSyncing ? <Loader2 className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
            </motion.div>
            {showLabel && (isSyncing ? "Pobieranie..." : "Pobierz z KSeF")}
        </Button>
    )
}
