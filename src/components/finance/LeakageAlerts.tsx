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
                <ShieldAlert className="w-4 h-4 text-red-600" />
                Wykryte wycieki pieniędzy (Leakage Detection)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {alerts.map((alert) => (
                    <div 
                        key={alert.id}
                        className={`p-4 rounded-xl border flex gap-3 transition-all hover:shadow-md
                            ${alert.severity === 'CRITICAL' ? 'bg-red-50 border-red-200 text-red-900' : 
                              alert.severity === 'WARNING' ? 'bg-orange-50 border-orange-200 text-orange-900' : 
                              'bg-indigo-50 border-indigo-200 text-indigo-900'}`}
                    >
                        <div className="mt-1">
                            {alert.type === 'DOUBLE_PAYMENT' && <ShieldAlert className="w-5 h-5 text-red-600" />}
                            {alert.type === 'MISSING_INVOICE' && <ZapOff className="w-5 h-5 text-orange-600" />}
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
