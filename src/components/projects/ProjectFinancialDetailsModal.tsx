"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { X } from "lucide-react"

interface Invoice {
  type: string
  amountNet: number
  amountGross?: number
  issueDate: string | Date
  invoiceNumber?: string
  contractorName?: string
}

interface ProjectFinancialDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  projectName: string
  fieldType: 'REVENUES' | 'COSTS' | 'MARGIN'
  invoices: Invoice[]
  totalInvoicedNet: number
  totalInvoicedGross: number
  totalCostsNet: number
  totalCostsGross: number
  currentMarginNet: number
  currentMarginGross: number
}

const formatPln = (value: number) => {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value)
}

const formatDate = (date: string | Date) => {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('pl-PL')
}

export function ProjectFinancialDetailsModal({
  isOpen,
  onClose,
  projectName,
  fieldType,
  invoices,
  totalInvoicedNet,
  totalInvoicedGross,
  totalCostsNet,
  totalCostsGross,
  currentMarginNet,
  currentMarginGross
}: ProjectFinancialDetailsModalProps) {
  
  // Filtruj faktury zależnie od typu
  let filteredInvoices: Invoice[] = []
  let title = ''
  let totalNet = 0
  let totalGross = 0

  if (fieldType === 'REVENUES') {
    filteredInvoices = invoices.filter(inv => 
      inv.type === 'SPRZEDAŻ' || inv.type === 'INCOME' || inv.type === 'REVENUE' || inv.type === 'PRZYCHÓD'
    )
    title = 'Przychody'
    totalNet = totalInvoicedNet
    totalGross = totalInvoicedGross
  } else if (fieldType === 'COSTS') {
    filteredInvoices = invoices.filter(inv => 
      inv.type === 'KOSZT' || inv.type === 'EXPENSE' || inv.type === 'ZAKUP' || inv.type === 'WYDATEK'
    )
    title = 'Koszty'
    totalNet = totalCostsNet
    totalGross = totalCostsGross
  } else {
    // MARGIN - pokażemy przychody i koszty razem
    title = 'Analiza Marży'
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {title} – {projectName}
          </DialogTitle>
        </DialogHeader>

        {fieldType === 'MARGIN' ? (
          // Widok MARGIN: pokazuj przychody i koszty razem
          <div className="space-y-8">
            {/* PRZYCHODY */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-emerald-600">Przychody (Sprzedaż)</h3>
              {invoices.filter(inv => inv.type === 'SPRZEDAŻ' || inv.type === 'INCOME' || inv.type === 'REVENUE' || inv.type === 'PRZYCHÓD').length === 0 ? (
                <p className="text-slate-400 text-sm italic">Brak faktur przychodu</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-300 bg-emerald-50">
                        <th className="text-left px-3 py-2 font-semibold text-slate-700">Data</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-700">Nr Faktury</th>
                        <th className="text-right px-3 py-2 font-semibold text-slate-700">Netto</th>
                        <th className="text-right px-3 py-2 font-semibold text-slate-700">Brutto</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-700">Inwestor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices
                        .filter(inv => inv.type === 'SPRZEDAŻ' || inv.type === 'INCOME' || inv.type === 'REVENUE' || inv.type === 'PRZYCHÓD')
                        .map((inv, idx) => (
                          <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                            <td className="px-3 py-2">{formatDate(inv.issueDate)}</td>
                            <td className="px-3 py-2 font-mono text-xs">{inv.invoiceNumber || '-'}</td>
                            <td className="text-right px-3 py-2 text-emerald-600 font-semibold">{formatPln(inv.amountNet)}</td>
                            <td className="text-right px-3 py-2 text-emerald-600 font-semibold">{formatPln(inv.amountGross || inv.amountNet)}</td>
                            <td className="px-3 py-2 text-slate-600">{inv.contractorName || '-'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <span className="font-semibold text-slate-700">Razem Przychody:</span>
                <div className="flex gap-4 sm:gap-6 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Netto</p>
                    <p className="text-base sm:text-lg font-bold text-emerald-600">{formatPln(totalInvoicedNet)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Brutto</p>
                    <p className="text-base sm:text-lg font-bold text-emerald-600">{formatPln(totalInvoicedGross)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* KOSZTY */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-red-600">Koszty (Zakupy)</h3>
              {invoices.filter(inv => inv.type === 'KOSZT' || inv.type === 'EXPENSE' || inv.type === 'ZAKUP' || inv.type === 'WYDATEK').length === 0 ? (
                <p className="text-slate-400 text-sm italic">Brak faktur kosztów</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-300 bg-red-50">
                        <th className="text-left px-3 py-2 font-semibold text-slate-700">Data</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-700">Nr Faktury</th>
                        <th className="text-right px-3 py-2 font-semibold text-slate-700">Netto</th>
                        <th className="text-right px-3 py-2 font-semibold text-slate-700">Brutto</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-700">Dostawca</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices
                        .filter(inv => inv.type === 'KOSZT' || inv.type === 'EXPENSE' || inv.type === 'ZAKUP' || inv.type === 'WYDATEK')
                        .map((inv, idx) => (
                          <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                            <td className="px-3 py-2">{formatDate(inv.issueDate)}</td>
                            <td className="px-3 py-2 font-mono text-xs">{inv.invoiceNumber || '-'}</td>
                            <td className="text-right px-3 py-2 text-red-600 font-semibold">{formatPln(inv.amountNet)}</td>
                            <td className="text-right px-3 py-2 text-red-600 font-semibold">{formatPln(inv.amountGross || inv.amountNet)}</td>
                            <td className="px-3 py-2 text-slate-600">{inv.contractorName || '-'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <span className="font-semibold text-slate-700">Razem Koszty:</span>
                <div className="flex gap-4 sm:gap-6 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Netto</p>
                    <p className="text-base sm:text-lg font-bold text-red-600">{formatPln(totalCostsNet)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Brutto</p>
                    <p className="text-base sm:text-lg font-bold text-red-600">{formatPln(totalCostsGross)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* MARŻA */}
            <div className={`border-2 rounded-lg p-4 ${currentMarginNet < 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
              <p className={`font-bold text-lg ${currentMarginNet < 0 ? 'text-red-600' : 'text-green-600'}`}>
                Obecna Marża (Zysk/Strata):
              </p>
              <div className="flex gap-6 mt-3">
                <div className="text-left flex-1 sm:flex-initial">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Netto</p>
                  <p className={`text-xl sm:text-2xl font-black ${currentMarginNet < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatPln(currentMarginNet)}
                  </p>
                </div>
                <div className="text-left flex-1 sm:flex-initial">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Brutto</p>
                  <p className={`text-xl sm:text-2xl font-black ${currentMarginGross < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatPln(currentMarginGross)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Widok REVENUES lub COSTS
          <div className="space-y-3">
            {filteredInvoices.length === 0 ? (
              <p className="text-slate-400 text-center py-8">Brak faktur dla tej kategorii</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className={`border-b border-slate-300 ${fieldType === 'REVENUES' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                        <th className="text-left px-3 py-2 font-semibold text-slate-700">Data</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-700">Nr Faktury</th>
                        <th className="text-right px-3 py-2 font-semibold text-slate-700">Netto</th>
                        <th className="text-right px-3 py-2 font-semibold text-slate-700">Brutto</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-700">Kontrahent</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-700">Typ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map((inv, idx) => (
                        <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="px-3 py-2">{formatDate(inv.issueDate)}</td>
                          <td className="px-3 py-2 font-mono text-xs text-slate-600">{inv.invoiceNumber || '-'}</td>
                          <td className={`text-right px-3 py-2 font-semibold ${fieldType === 'REVENUES' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatPln(inv.amountNet)}
                          </td>
                          <td className={`text-right px-3 py-2 font-semibold ${fieldType === 'REVENUES' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatPln(inv.amountGross || inv.amountNet)}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{inv.contractorName || '-'}</td>
                          <td className="px-3 py-2">
                            <span className={`text-xs px-2 py-1 rounded font-semibold ${fieldType === 'REVENUES' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                              {inv.type}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className={`border-2 rounded-lg p-4 flex justify-between items-center ${fieldType === 'REVENUES' ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                  <span className={`font-bold text-lg ${fieldType === 'REVENUES' ? 'text-emerald-600' : 'text-red-600'}`}>
                    Razem {title}:
                  </span>
                  <div className="flex gap-6">
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Netto</p>
                      <p className={`text-xl font-bold ${fieldType === 'REVENUES' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatPln(totalNet)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Brutto</p>
                      <p className={`text-xl font-bold ${fieldType === 'REVENUES' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatPln(totalGross)}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
