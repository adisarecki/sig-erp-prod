"use client"

import { useEffect, useState } from "react"
import { getSyncStatus } from "@/app/actions/health"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { motion, AnimatePresence } from "framer-motion"
import { Database, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react"

export function SyncStatus() {
    const [status, setStatus] = useState<"checking" | "ok" | "error">("checking")
    const [details, setDetails] = useState<any>(null)

    useEffect(() => {
        const check = async () => {
            const res = await getSyncStatus()
            if (res.success) {
                setStatus(res.isSynced ? "ok" : "error")
                setDetails(res.details)
            } else {
                setStatus("error")
            }
        }
        check()
        // Opcjonalnie: odświeżaj co 5 minut
        const interval = setInterval(check, 5 * 60 * 1000)
        return () => clearInterval(interval)
    }, [])

    return (
        <TooltipProvider delayDuration={300}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 cursor-help px-3 py-1.5 rounded-full hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200">
                        <div className="relative flex h-3 w-3">
                            {status === "checking" && (
                                <motion.span
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                    className="absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75 border-t-2 border-yellow-600"
                                />
                            )}
                            {status === "ok" && (
                                <>
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-20" />
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                                </>
                            )}
                            {status === "error" && (
                                <>
                                    <motion.span 
                                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                                        transition={{ duration: 1.5, repeat: Infinity }}
                                        className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" 
                                    />
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]" />
                                </>
                            )}
                        </div>
                        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider hidden sm:inline-block">
                            {status === "ok" ? "Sync: OK" : status === "checking" ? "Sync: .." : "Sync: Error"}
                        </span>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="w-64 p-3 bg-white border border-slate-200 shadow-xl rounded-lg">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 border-b pb-2">
                            {status === "ok" ? (
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : status === "error" ? (
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                            ) : (
                                <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />
                            )}
                            <span className="font-bold text-slate-800 text-sm">
                                Status Synchronizacji
                            </span>
                        </div>
                        
                        {status === "error" && (
                            <p className="text-xs text-red-600 font-medium bg-red-50 p-2 rounded border border-red-100">
                                Wykryto rozbieżność w danych (Dual-Sync Drift). Wymagana interwencja administratora.
                            </p>
                        )}

                        {details && (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
                                <span className="text-[10px] text-slate-400 uppercase">Kolekcja</span>
                                <span className="text-[10px] text-slate-400 uppercase text-right">FS / SQL</span>
                                
                                <div className="text-xs text-slate-600">Projekty</div>
                                <div className={`text-xs font-mono text-right ${details.projects.firestore !== details.projects.prisma ? 'text-red-500 font-bold' : 'text-slate-800'}`}>
                                    {details.projects.firestore} / {details.projects.prisma}
                                </div>

                                <div className="text-xs text-slate-600">Transakcje</div>
                                <div className={`text-xs font-mono text-right ${details.transactions.firestore !== details.transactions.prisma ? 'text-red-500 font-bold' : 'text-slate-800'}`}>
                                    {details.transactions.firestore} / {details.transactions.prisma}
                                </div>

                                <div className="text-xs text-slate-600">Faktury</div>
                                <div className={`text-xs font-mono text-right ${details.invoices.firestore !== details.invoices.prisma ? 'text-red-500 font-bold' : 'text-slate-800'}`}>
                                    {details.invoices.firestore} / {details.invoices.prisma}
                                </div>
                            </div>
                        )}
                        
                        <div className="text-[9px] text-slate-400 pt-2 border-t mt-2 text-center">
                            Double check: Firestore (Operational) vs Prisma (Analytical)
                        </div>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
