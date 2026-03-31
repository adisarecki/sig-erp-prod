"use client"

import { useState } from "react"
import { RefreshCw, LayoutDashboard, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { KSeFInboxModal } from "./KSeFInboxModal"

interface KSeFSyncButtonProps {
    hasToken: boolean
    variant?: "default" | "outline" | "ghost" | "secondary"
    className?: string
    showLabel?: boolean
}

/**
 * KSeFSyncButton
 * VECTOR 103: Trigger for KSeF Gatekeeper (Strefa Buforowa)
 * Instead of auto-syncing, this now opens the Inbox Modal.
 */
export function KSeFSyncButton({ hasToken, variant = "outline", className = "", showLabel = true }: KSeFSyncButtonProps) {
    const [isModalOpen, setIsModalOpen] = useState(false)

    // Security Guard: Hidden if no token configured
    if (!hasToken) return null

    return (
        <>
            <Button
                variant={variant}
                size="sm"
                onClick={() => setIsModalOpen(true)}
                className={`flex items-center gap-2 font-bold transition-all active:scale-95 group border-2 ${className}`}
            >
                <div className="group-hover:rotate-180 transition-transform duration-500">
                    <RefreshCw className="w-4 h-4 text-indigo-500" />
                </div>
                {showLabel && "Pobierz z KSeF"}
                <div className="ml-1 px-1.5 py-0.5 bg-indigo-50 rounded text-[9px] text-indigo-600 font-black uppercase tracking-widest hidden sm:block">
                    Inbox
                </div>
            </Button>

            <KSeFInboxModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)}
                onImportSuccess={() => {
                    // Refresh the main app state if needed
                    setTimeout(() => window.location.reload(), 500)
                }}
            />
        </>
    )
}
