"use client"

import Link from "next/link"
import { HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface HelpLinkProps {
    /** ID from glossary.ts or howto.ts */
    helpId: string
    /** Short tooltip text (usually HelpEntry.summary) */
    tooltip: string
    className?: string
    /** Size of the icon */
    size?: "xs" | "sm"
}

/**
 * Vector 150: Contextual help icon — tooltip + link to /help/[id].
 * Drop-in replacement for TooltipHelp with knowledge hub integration.
 */
export function HelpLink({ helpId, tooltip, className, size = "sm" }: HelpLinkProps) {
    const iconSize = size === "xs" ? "w-3 h-3" : "w-4 h-4"

    return (
        <Link
            href={`/help/${helpId}`}
            title={tooltip}
            className={cn(
                "inline-flex items-center justify-center rounded-full",
                "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50",
                "transition-all duration-150",
                "focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1",
                className
            )}
            onClick={e => e.stopPropagation()}
        >
            <HelpCircle className={iconSize} />
            <span className="sr-only">Pomoc: {tooltip}</span>
        </Link>
    )
}
