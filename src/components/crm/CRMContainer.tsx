"use client"

import { useState } from "react"
import { InteractiveCRMList } from "./InteractiveCRMList"
import { Users, HardHat, Building2 } from "lucide-react"

interface CRMContainerProps {
    contractors: any[];
}

export function CRMContainer({ contractors }: CRMContainerProps) {
    const [activeTab, setActiveTab] = useState("ALL")

    const filteredContractors = contractors.filter(c => {
        if (activeTab === "ALL") return true
        if (activeTab === "INWESTOR") return c.type === "INWESTOR"
        if (activeTab === "DOSTAWCA") return c.type === "DOSTAWCA" || c.type === "HURTOWNIA"
        return false
    })

    return (
        <div className="space-y-4">
            {/* FORCE RENDER TABS - V.018-RESCUE */}
            <div className="flex bg-slate-100 p-1 rounded-lg self-stretch sm:self-auto inline-flex border border-slate-200 shadow-sm">
                <button
                    onClick={() => setActiveTab("ALL")}
                    className={`px-6 py-2 text-xs font-black rounded-md transition-all uppercase tracking-widest flex items-center gap-2 ${
                        activeTab === "ALL" 
                        ? "bg-white text-slate-900 shadow-md scale-[1.02]" 
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                    <Users className="w-3.5 h-3.5" /> WSZYSTKIE
                </button>
                <button
                    onClick={() => setActiveTab("INWESTOR")}
                    className={`px-6 py-2 text-xs font-black rounded-md transition-all uppercase tracking-widest flex items-center gap-2 ${
                        activeTab === "INWESTOR" 
                        ? "bg-white text-slate-900 shadow-md scale-[1.02]" 
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                    <HardHat className="w-3.5 h-3.5" /> INWESTORZY
                </button>
                <button
                    onClick={() => setActiveTab("DOSTAWCA")}
                    className={`px-6 py-2 text-xs font-black rounded-md transition-all uppercase tracking-widest flex items-center gap-2 ${
                        activeTab === "DOSTAWCA" 
                        ? "bg-white text-slate-900 shadow-md scale-[1.02]" 
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                    <Building2 className="w-3.5 h-3.5" /> DOSTAWCY
                </button>
            </div>

            <InteractiveCRMList contractors={filteredContractors} />
        </div>
    )
}
