"use client"

import { useEffect, useState } from "react"
import { getSyncStatus } from "@/app/actions/health"
import { resolveDrift } from "@/app/actions/sync-actions"
import { cleanupRetentionGhostEntries } from "@/app/actions/cleanup-retentions"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { motion, AnimatePresence } from "framer-motion"
import { 
    Database, 
    AlertTriangle, 
    CheckCircle2, 
    RefreshCw, 
    ArrowRightCircle, 
    Trash2, 
    ExternalLink,
    Loader2
} from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import Link from "next/link"

export function SyncStatus() {
    const [status, setStatus] = useState<"checking" | "ok" | "error">("checking")
    const [details, setDetails] = useState<any>(null)
    const [driftingItems, setDriftingItems] = useState<any[]>([])
    const [isResolving, setIsResolving] = useState<string | null>(null)
    const [isCleaning, setIsCleaning] = useState(false)

    const check = async () => {
        const res = await getSyncStatus()
        if (res.success) {
            setStatus(res.isSynced ? "ok" : "error")
            setDetails(res.details)
            setDriftingItems(res.driftingItems || [])
        } else {
            setStatus("error")
        }
    }

    useEffect(() => {
        check()
        const interval = setInterval(check, 5 * 60 * 1000)
        return () => clearInterval(interval)
    }, [])

    const handleResolve = async (id: string, type: any, action: 'push' | 'purge') => {
        setIsResolving(id)
        try {
            const res = await resolveDrift(id, type, action)
            if (res.success) {
                toast.success(action === 'push' ? "Zsynchronizowano pomyślnie" : "Usunięto z Firestore")
                await check()
            } else {
                toast.error(res.error || "Błąd podczas rozwiązywania driftu")
            }
        } finally {
            setIsResolving(null)
        }
    }

    const handleEmergencyCleanup = async () => {
        if (!confirm("Czy na pewno chcesz usunąć błędne blokady kaucji? To przywróci Twój realny bilans Safe-to-Spend.")) return
        setIsCleaning(true)
        try {
            const res = await cleanupRetentionGhostEntries()
            if (res.success) {
                toast.success(res.message)
                await check()
            } else {
                toast.error(res.error || "Błąd podczas czyszczenia")
            }
        } finally {
            setIsCleaning(false)
        }
    }

    return (
        <Popover>
            <PopoverTrigger className="focus:outline-none">
                <div className="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-full hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200 group">
                    <div className="relative flex h-3 w-3">
                        {status === "checking" && (
                            <motion.span
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 border-t-2 border-amber-600"
                            />
                        )}
                        {status === "ok" && (
                            <>
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-20" />
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            </>
                        )}
                        {status === "error" && (
                            <>
                                <motion.span 
                                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                    className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" 
                                />
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600 shadow-[0_0_10px_rgba(225,29,72,0.5)]" />
                            </>
                        )}
                    </div>
                    <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider hidden sm:inline-block">
                        {status === "ok" ? "Sync: OK" : status === "checking" ? "Sync: .." : "Sync: Error"}
                    </span>
                </div>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="end" className="w-80 p-0 bg-white border border-slate-200 shadow-2xl rounded-xl overflow-hidden">
                <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-slate-400" />
                        <span className="font-bold text-slate-800 text-sm">Drift Resolution Center</span>
                    </div>
                    {status === "ok" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />
                    )}
                </div>

                <div className="max-h-[400px] overflow-y-auto">
                    {status === "error" && driftingItems.length > 0 ? (
                        <div className="p-2 space-y-2">
                            <div className="px-2 py-1 text-[10px] font-bold text-rose-500 uppercase tracking-tight">
                                {driftingItems.length} NIEDOPASOWANE REKORDY
                            </div>
                            
                            {driftingItems.map((item) => (
                                <div key={item.id} className="p-3 rounded-lg border border-slate-100 bg-white shadow-sm space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase">
                                                    {item.label}
                                                </span>
                                                <span className="text-[10px] font-mono text-slate-400">
                                                    {item.id.slice(0, 8)}...
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-slate-600 flex items-center gap-1">
                                                {item.location === 'only_firestore' ? (
                                                    <span className="text-orange-600 font-medium">Obecne w Firebase, brak w SQL</span>
                                                ) : (
                                                    <span className="text-blue-600 font-medium">Obecne w SQL, brak w Firebase</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        {item.location === 'only_firestore' && (
                                            <>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-8 text-[10px] gap-1.5 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                                                    onClick={() => handleResolve(item.id, item.type, 'push')}
                                                    disabled={isResolving === item.id}
                                                >
                                                    {isResolving === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRightCircle className="w-3 h-3" />}
                                                    DOCIĄGNIJ DO SQL
                                                </Button>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-8 text-[10px] gap-1.5 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                                                    onClick={() => handleResolve(item.id, item.type, 'purge')}
                                                    disabled={isResolving === item.id}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                    USUŃ Z FIRESTORE
                                                </Button>
                                            </>
                                        )}
                                        <Link 
                                            href={`/finance/${item.type === 'invoices' ? 'invoices' : item.type}?edit=${item.id}`}
                                            className={cn(
                                                buttonVariants({ variant: "ghost", size: "sm" }),
                                                "h-8 text-[10px] gap-1.5 col-span-2 text-slate-400 hover:text-slate-600 w-full"
                                            )}
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                            MANUAL FIX
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : status === "checking" ? (
                        <div className="p-8 flex flex-col items-center justify-center gap-2">
                            <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
                            <span className="text-xs text-slate-400">Analizowanie spójności...</span>
                        </div>
                    ) : (
                        <div className="p-8 flex flex-col items-center justify-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                            </div>
                            <span className="text-xs font-medium text-slate-600">Wszystkie dane są spójne</span>
                            <span className="text-[10px] text-slate-400">Ostatnia weryfikacja: {new Date().toLocaleTimeString()}</span>
                        </div>
                    )}
                </div>

                <div className="p-3 bg-slate-50 border-t flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <div className="text-[9px] text-slate-400 uppercase tracking-tight">
                            FS / SQL Architecture
                        </div>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 text-[9px] gap-1 text-slate-500"
                            onClick={check}
                        >
                            <RefreshCw className="w-2.5 h-2.5" />
                            ODŚWIEŻ
                        </Button>
                    </div>
                    
                    <Button 
                        variant="destructive" 
                        size="sm" 
                        className="w-full h-8 text-[10px] font-black uppercase tracking-widest gap-2 bg-rose-600 hover:bg-rose-700"
                        onClick={handleEmergencyCleanup}
                        disabled={isCleaning}
                    >
                        {isCleaning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        Napraw Drift Finansowy (Fix Balance)
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}

