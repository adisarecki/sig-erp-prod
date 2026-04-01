"use client"

import { Badge } from "@/components/ui/badge"
import { Database, FileCode2, ArrowRight } from "lucide-react"

interface SyncDiffViewProps {
    diffFields: {
        field: string
        firestoreValue: any
        postgresValue: any
    }[]
}

export function SyncDiffView({ diffFields }: SyncDiffViewProps) {
    if (!diffFields || diffFields.length === 0) {
        return (
            <div className="p-8 text-center bg-emerald-50 rounded-3xl border border-emerald-100">
                <p className="text-emerald-700 font-bold">Wszystkie rekordy są zgodne.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-4 px-2">Wykryto {diffFields.length} nieścisłości:</h4>
            <div className="space-y-3">
                {diffFields.map((diff, i) => (
                    <div key={i} className="grid grid-cols-7 items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm group hover:border-indigo-200 transition-all">
                        <div className="col-span-2">
                             <p className="text-[10px] uppercase font-black text-slate-400 tracking-tighter mb-0.5">Pole</p>
                             <p className="font-bold text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                                 <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
                                 {diff.field}
                             </p>
                        </div>

                        <div className="col-span-2 p-3 bg-slate-50/50 rounded-xl group-hover:bg-indigo-50/30 transition-colors">
                             <div className="flex items-center gap-1.5 mb-1">
                                 <Database className="w-3 h-3 text-amber-500" />
                                 <p className="text-[8px] uppercase font-black text-slate-400">Firestore (SSoT)</p>
                             </div>
                             <p className="text-xs font-mono font-bold text-slate-700 truncate">
                                 {diff.firestoreValue?.toString() || <span className="text-slate-300 italic">null</span>}
                             </p>
                        </div>

                        <div className="flex justify-center">
                            <ArrowRight className="w-5 h-5 text-slate-200 group-hover:text-indigo-400 transition-colors" />
                        </div>

                        <div className="col-span-2 p-3 bg-slate-50/50 rounded-xl group-hover:bg-indigo-50/30 transition-colors">
                             <div className="flex items-center gap-1.5 mb-1">
                                 <Database className="w-3 h-3 text-blue-500" />
                                 <p className="text-[8px] uppercase font-black text-slate-400">Postgres (Mirror)</p>
                             </div>
                             <p className="text-xs font-mono font-bold text-slate-700 truncate">
                                 {diff.postgresValue?.toString() || <span className="text-slate-300 italic">null</span>}
                             </p>
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 items-start mt-6">
                 <div className="mt-0.5">
                     <Database className="w-5 h-5 text-amber-500" />
                 </div>
                 <div className="space-y-1">
                     <p className="text-xs font-black text-amber-900 uppercase tracking-widest">Uwaga Konsystencji</p>
                     <p className="text-xs text-amber-700 font-medium">System Dual-DB wykrył niespójności. Zalecana manualna synchronizacja z priorytetem Firestore (Primary SSoT) w celu przywrócenia integralności Mirrora PostgreSQL.</p>
                 </div>
            </div>
        </div>
    )
}
