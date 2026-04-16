"use client"

import { AlertTriangle, ShieldAlert, ZapOff } from "lucide-react"
import { LeakageAlert } from "@/lib/finance/leakage-detection"

interface LeakageAlertsProps {
    alerts: LeakageAlert[]
}

export function LeakageAlerts({ alerts }: LeakageAlertsProps) {
    if (alerts.length === 0) return null

    return (
        <div className="space-y-3 mb-6">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wider">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                Wykryte wycieki pieniędzy (Leakage Detection)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {alerts.map((alert) => (
                    <div 
                        key={alert.id}
                        className={`p-4 rounded-xl border flex gap-3 transition-all hover:shadow-md
                            ${alert.severity === 'CRITICAL' ? 'bg-rose-50 border-rose-200 text-rose-900' : 
                              alert.severity === 'WARNING' ? 'bg-amber-50 border-amber-200 text-amber-900' : 
                              'bg-slate-50 border-slate-200 text-slate-900'}`}
                    >
                        <div className="mt-1">
                            {alert.type === 'DOUBLE_PAYMENT' && <ShieldAlert className="w-5 h-5 text-rose-600" />}
                            {alert.type === 'MISSING_INVOICE' && <ZapOff className="w-5 h-5 text-amber-600" />}
                            {alert.type === 'VAT_MISMATCH' && <AlertTriangle className="w-5 h-5 text-indigo-600" />}
                        </div>
                        <div>
                            <p className="text-sm font-bold leading-tight">{alert.title}</p>
                            <p className="text-xs mt-1 opacity-80">{alert.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
