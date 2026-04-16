"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { X } from "lucide-react"
import { TableWrapper } from "@/components/layout/TableWrapper"

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

import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay"

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

  // Determine intent bg/border for boxes
  const marginIsPositive = currentMarginNet >= 0;
  const marginIntent = marginIsPositive ? 'income' : 'cost';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-none sm:max-w-4xl max-h-[96vh] sm:max-h-[85vh] overflow-y-auto rounded-[32px] border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.1)]">
        <DialogHeader className="pb-4 border-b border-slate-100">
          <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">
            {title} – <span className="text-indigo-600">{projectName}</span>
          </DialogTitle>
        </DialogHeader>

        {fieldType === 'MARGIN' ? (
          <div className="space-y-8 mt-6">
            {/* PRZYCHODY */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" /> Przychody (Sprzedaż)
              </h3>
              {invoices.filter(inv => inv.type === 'SPRZEDAŻ' || inv.type === 'INCOME' || inv.type === 'REVENUE' || inv.type === 'PRZYCHÓD').length === 0 ? (
                <p className="text-slate-400 text-sm italic py-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">Brak faktur przychodu</p>
              ) : (
                <TableWrapper>
                  <table className="w-full text-sm border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b border-slate-300 bg-emerald-50/50">
                        <th className="text-left px-3 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500">Data</th>
                        <th className="text-left px-3 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500">Nr Faktury</th>
                        <th className="text-right px-3 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500">Netto</th>
                        <th className="text-right px-3 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500">Brutto</th>
                        <th className="text-left px-3 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500 text-center">Inwestor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices
                        .filter(inv => inv.type === 'SPRZEDAŻ' || inv.type === 'INCOME' || inv.type === 'REVENUE' || inv.type === 'PRZYCHÓD')
                        .map((inv, idx) => (
                           <tr key={idx} className="border-b border-slate-100 hover:bg-emerald-50/30 transition-colors">
                            <td className="px-3 py-3 font-medium whitespace-nowrap">{formatDate(inv.issueDate)}</td>
                            <td className="px-3 py-3 font-mono text-[10px] text-slate-500">{inv.invoiceNumber || '-'}</td>
                            <td className="text-right px-3 py-3">
                                <CurrencyDisplay gross={inv.amountNet} net={inv.amountNet} intent="income" hideSign={true} className="text-sm" />
                            </td>
                            <td className="text-right px-3 py-3">
                                <CurrencyDisplay gross={inv.amountGross || inv.amountNet} net={inv.amountGross || inv.amountNet} intent="income" hideSign={true} className="text-sm" />
                            </td>
                            <td className="px-3 py-3 text-slate-600 truncate max-w-[150px] text-xs font-medium text-center">{inv.contractorName || '-'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </TableWrapper>
              )}
              <div className="bg-emerald-50 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <span className="font-bold text-emerald-800 text-sm uppercase tracking-widest">Suma Przychodów:</span>
                <div className="flex gap-8 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="text-right">
                    <p className="text-[10px] text-emerald-600/60 uppercase font-black tracking-widest mb-1">Netto</p>
                    <CurrencyDisplay gross={totalInvoicedNet} net={totalInvoicedNet} intent="income" hideSign={true} className="text-lg" />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-emerald-600/60 uppercase font-black tracking-widest mb-1">Brutto</p>
                    <CurrencyDisplay gross={totalInvoicedGross} net={totalInvoicedGross} intent="income" hideSign={true} className="text-lg" />
                  </div>
                </div>
              </div>
            </div>

            {/* KOSZTY */}
            <div className="space-y-3">
                <h3 className="text-sm font-black text-rose-600 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-500" /> Koszty (Zakupy)
                </h3>
              {invoices.filter(inv => inv.type === 'KOSZT' || inv.type === 'EXPENSE' || inv.type === 'ZAKUP' || inv.type === 'WYDATEK').length === 0 ? (
                <p className="text-slate-400 text-sm italic py-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">Brak faktur kosztów</p>
              ) : (
                <TableWrapper>
                   <table className="w-full text-sm border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b border-slate-300 bg-rose-50/50">
                        <th className="text-left px-3 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500">Data</th>
                        <th className="text-left px-3 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500">Nr Faktury</th>
                        <th className="text-right px-3 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500">Netto</th>
                        <th className="text-right px-3 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500">Brutto</th>
                        <th className="text-left px-3 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500 text-center">Dostawca</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices
                        .filter(inv => inv.type === 'KOSZT' || inv.type === 'EXPENSE' || inv.type === 'ZAKUP' || inv.type === 'WYDATEK')
                        .map((inv, idx) => (
                           <tr key={idx} className="border-b border-slate-100 hover:bg-rose-50/30 transition-colors">
                            <td className="px-3 py-3 font-medium whitespace-nowrap">{formatDate(inv.issueDate)}</td>
                            <td className="px-3 py-3 font-mono text-[10px] text-slate-500">{inv.invoiceNumber || '-'}</td>
                            <td className="text-right px-3 py-3">
                                <CurrencyDisplay gross={inv.amountNet} net={inv.amountNet} intent="cost" hideSign={true} className="text-sm" />
                            </td>
                            <td className="text-right px-3 py-3">
                                <CurrencyDisplay gross={inv.amountGross || inv.amountNet} net={inv.amountGross || inv.amountNet} intent="cost" hideSign={true} className="text-sm" />
                            </td>
                            <td className="px-3 py-3 text-slate-600 truncate max-w-[150px] text-xs font-medium text-center">{inv.contractorName || '-'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </TableWrapper>
              )}
              <div className="bg-rose-50 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <span className="font-bold text-rose-800 text-sm uppercase tracking-widest">Suma Kosztów:</span>
                <div className="flex gap-8 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="text-right">
                    <p className="text-[10px] text-rose-600/60 uppercase font-black tracking-widest mb-1">Netto</p>
                    <CurrencyDisplay gross={totalCostsNet} net={totalCostsNet} intent="cost" hideSign={true} className="text-lg" />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-rose-600/60 uppercase font-black tracking-widest mb-1">Brutto</p>
                    <CurrencyDisplay gross={totalCostsGross} net={totalCostsGross} intent="cost" hideSign={true} className="text-lg" />
                  </div>
                </div>
              </div>
            </div>

            {/* MARŻA FINALNE PODSUMOWANIE */}
            <div className={`border-2 rounded-2xl p-6 ${marginIsPositive ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/50'} shadow-sm`}>
              <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-lg ${marginIsPositive ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                      {marginIsPositive ? '💰' : '📉'}
                  </div>
                  <p className={`font-black text-xl tracking-tight ${marginIsPositive ? 'text-emerald-700' : 'text-rose-700'}`}>
                    Wynik Operacyjny (Marża):
                  </p>
              </div>
              <div className="flex gap-12">
                <div className="text-left flex-1 sm:flex-initial">
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em] mb-1">Marża Netto</p>
                  <CurrencyDisplay gross={currentMarginNet} net={currentMarginNet} intent={marginIntent} className="text-3xl" />
                </div>
                <div className="text-left flex-1 sm:flex-initial">
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em] mb-1">Marża Brutto</p>
                  <CurrencyDisplay gross={currentMarginGross} net={currentMarginGross} intent={marginIntent} className="text-3xl" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Widok UPROSZCZONY (REVENUES lub COSTS) */
          <div className="space-y-4 mt-6">
            {filteredInvoices.length === 0 ? (
              <p className="text-slate-400 text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">Brak faktur dla tej kategorii</p>
            ) : (
              <>
                <TableWrapper>
                  <table className="w-full text-sm border-collapse min-w-[700px]">
                    <thead>
                      <tr className={`border-b border-slate-200 ${fieldType === 'REVENUES' ? 'bg-emerald-50/50' : 'bg-rose-50/50'}`}>
                        <th className="text-left px-3 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500 text-center">Data</th>
                        <th className="text-left px-3 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500">Nr Faktury</th>
                        <th className="text-right px-3 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500">Netto</th>
                        <th className="text-right px-3 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500">Brutto</th>
                        <th className="text-left px-3 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500">Kontrahent</th>
                        <th className="text-center px-3 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500">Typ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map((inv, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                          <td className="px-3 py-3 font-medium whitespace-nowrap text-center text-xs">{formatDate(inv.issueDate)}</td>
                          <td className="px-3 py-3 font-mono text-[10px] text-slate-500">{inv.invoiceNumber || '-'}</td>
                          <td className="text-right px-3 py-3">
                            <CurrencyDisplay gross={inv.amountNet} net={inv.amountNet} intent={fieldType === 'REVENUES' ? 'income' : 'cost'} hideSign={true} />
                          </td>
                          <td className="text-right px-3 py-3">
                            <CurrencyDisplay gross={inv.amountGross || inv.amountNet} net={inv.amountGross || inv.amountNet} intent={fieldType === 'REVENUES' ? 'income' : 'cost'} hideSign={true} />
                          </td>
                          <td className="px-3 py-3 text-slate-600 truncate max-w-[150px] font-medium text-xs">{inv.contractorName || '-'}</td>
                          <td className="px-3 py-3 text-center">
                             <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${fieldType === 'REVENUES' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              {inv.type}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrapper>

                <div className={`rounded-2xl p-5 flex justify-between items-center shadow-sm border ${fieldType === 'REVENUES' ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                  <span className={`font-black text-lg uppercase tracking-tight ${fieldType === 'REVENUES' ? 'text-emerald-800' : 'text-rose-800'}`}>
                    Suma {title}:
                  </span>
                  <div className="flex gap-10">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Netto</p>
                      <CurrencyDisplay gross={totalNet} net={totalNet} intent={fieldType === 'REVENUES' ? 'income' : 'cost'} hideSign={true} className="text-2xl" />
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Brutto</p>
                      <CurrencyDisplay gross={totalGross} net={totalGross} intent={fieldType === 'REVENUES' ? 'income' : 'cost'} hideSign={true} className="text-2xl" />
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
