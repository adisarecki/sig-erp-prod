import { getCurrentTenantId } from "@/lib/tenant"
import prisma from "@/lib/prisma"
import { ShieldAlert, Download, Search, Settings2, FileText, CheckCircle2, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Invoice, Contractor } from "@prisma/client"
import { formatPln as formatCurrency } from "@/lib/utils"

export const metadata = {
    title: "Accounting Audit | SIG ERP",
    description: "Reconciliation layer checking OCR extracted data against Ledger entries."
}

export default async function AuditPage() {
    const tenantId = await getCurrentTenantId()

    // Fetch invoices that have rawOcrData
    const invoices = await prisma.invoice.findMany({
        where: { tenantId, rawOcrData: { not: null } as any },
        include: { contractor: true },
        orderBy: { issueDate: 'desc' }
    })

    const rows = invoices.map(inv => {
        const ocr = inv.rawOcrData as any
        const expectedGross = Number(ocr?.grossAmount?.replace(',', '.') || 0)
        const expectedNet = Number(ocr?.netAmount?.replace(',', '.') || 0)
        
        const actualGross = Number(inv.amountGross)
        const actualNet = Number(inv.amountNet)

        const grossMatch = expectedGross === actualGross
        const netMatch = expectedNet === actualNet
        const match = grossMatch && netMatch

        return {
            id: inv.id,
            externalId: inv.externalId || ocr?.invoiceNumber || '-',
            contractor: inv.contractor?.name || ocr?.parsedName || 'Brak',
            issueDate: inv.issueDate,
            actualGross,
            actualNet,
            expectedGross,
            expectedNet,
            match,
            type: inv.type
        }
    })

    return (
        <div className="max-w-6xl mx-auto space-y-6 pt-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* HEROBAR */}
            <div className="bg-slate-900 rounded-3xl p-8 relative overflow-hidden shadow-xl">
                <div className="absolute inset-0 bg-blue-500/10" />
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                
                <div className="relative flex justify-between items-start z-10">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <ShieldAlert className="w-8 h-8 text-blue-400" />
                            <h1 className="text-3xl font-black text-white tracking-tight">Accounting Audit</h1>
                        </div>
                        <p className="text-slate-400 max-w-xl">
                            Warstwa pojednania (Reconciliation Layer). Weryfikacja różnic między twardymi danymi z systemu OCR,
                            a ostatecznymi wpisami do księgi głównej wprowadzonymi ręcznie.
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <Button className="bg-white text-slate-900 hover:bg-slate-100 rounded-xl font-bold shadow gap-2">
                            <Download className="w-4 h-4" /> Eksport (CSV)
                        </Button>
                    </div>
                </div>
            </div>

            {/* QUICK STATS */}
            <div className="grid grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Przeskanowane Zapisy</p>
                    <p className="text-3xl font-black text-slate-900">{rows.length}</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Rozbieżności Gross/Net</p>
                    <p className="text-3xl font-black text-rose-500">{rows.filter(r => !r.match).length}</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Zaufanie Systemu</p>
                    <p className="text-3xl font-black text-emerald-500">
                        {rows.length > 0 ? ((rows.filter(r => r.match).length / rows.length) * 100).toFixed(1) : 100}%
                    </p>
                </div>
            </div>

            {/* TABLE */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-widest border-b border-slate-100 font-bold">
                            <tr>
                                <th className="px-6 py-4">Dokument</th>
                                <th className="px-6 py-4">Typ</th>
                                <th className="px-6 py-4 text-right">Oczekiwane (OCR) Gross</th>
                                <th className="px-6 py-4 text-right">Zapis (Ledger) Gross</th>
                                <th className="px-6 py-4 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rows.map((row) => (
                                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-slate-900">{row.externalId}</p>
                                        <p className="text-xs text-slate-500">{row.contractor} &middot; {row.issueDate.toLocaleDateString()}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        {row.type === "INCOME" || row.type === "SPRZEDAŻ" ? (
                                            <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">Sprzedaż</Badge>
                                        ) : (
                                            <Badge variant="outline" className="border-rose-200 text-rose-700 bg-rose-50">Koszty</Badge>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono text-slate-600">
                                        {formatCurrency(row.expectedGross)}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                                        {formatCurrency(row.actualGross)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {row.match ? (
                                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none">
                                                <CheckCircle2 className="w-3 h-3 mr-1" /> Zgodne
                                            </Badge>
                                        ) : (
                                            <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-200 border-none font-black text-xs uppercase cursor-help" title="Wykryto rozbieżność względem twardego skanu OCR. Ustal czy księgowość wprowadziła poprawkę, czy nastąpiło przekłamanie danych.">
                                                <XCircle className="w-3 h-3 mr-1" /> Zastrzeżenie
                                            </Badge>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p>Brak zgromadzonych zapisów OCR w trybie audytu.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {/* FOOTER */}
            <div className="text-center text-xs text-slate-400 py-4">
                Wersja systemu nie pozwala jeszcze na masowy import rozbieżności z powrotem. Export CSV jest przewidziany do przeglądu zarządu.
            </div>
        </div>
    )
}
