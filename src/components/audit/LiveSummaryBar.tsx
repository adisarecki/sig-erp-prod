/**
 * Live Summary Bar Component - Vector 180.15
 * Dynamic fiscal summary with semantic color coding
 */

"use client";

import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import { LiveSummary, SemanticIntent } from "@/lib/audit/types";
import { FiscalCalculatorService } from "@/lib/audit/fiscalCalculatorService";

interface LiveSummaryBarProps {
  liveSummary: LiveSummary;
  isCompact?: boolean;
}

export function LiveSummaryBar({
  liveSummary,
  isCompact = false,
}: LiveSummaryBarProps) {
  const liabilities = FiscalCalculatorService.calculateLiabilities(
    liveSummary.totals
  );

  const stats = [
    {
      label: "Wszystkie",
      value: liveSummary.itemCount,
      color: "text-slate-600",
      bg: "bg-slate-50",
    },
    {
      label: "Zatwierdzone",
      value: liveSummary.verifiedCount,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Do weryfikacji",
      value: liveSummary.pendingCount,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Odrzucone",
      value: liveSummary.rejectedCount,
      color: "text-rose-600",
      bg: "bg-rose-50",
    },
  ];

  if (isCompact) {
    return (
      <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-slate-500">{stat.label}</span>
            <span className={`text-lg font-black ${stat.color}`}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Map intents to background families
  const intentBg: Record<SemanticIntent, string> = {
    'income': 'bg-emerald-50 border-emerald-100',
    'cost': 'bg-rose-50 border-rose-100',
    'tax-shield': 'bg-cyan-50 border-cyan-100',
    'warning': 'bg-amber-50 border-amber-100',
    'neutral': 'bg-slate-50 border-slate-100'
  };

  return (
    <div className="space-y-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-2">
      {/* Item Statistics */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`flex flex-col items-center p-3 ${stat.bg} rounded-xl border border-transparent hover:border-slate-200 transition-all`}
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
              {stat.label}
            </span>
            <span className={`text-xl font-black ${stat.color}`}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Fiscal Liabilities */}
      <div className="grid grid-cols-3 gap-3">
        {/* VAT Saldo */}
        <div className={`p-4 rounded-xl border ${intentBg[liabilities.vatSaldo.intent]}`}>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
            {liabilities.vatSaldo.label}
          </div>
          <div className="text-xl">
            <CurrencyDisplay 
              gross={liveSummary.vatSaldo} 
              net={liveSummary.vatSaldo} 
              intent={liabilities.vatSaldo.intent} 
              className="text-lg"
            />
          </div>
        </div>

        {/* CIT Liability */}
        <div className={`p-4 rounded-xl border ${intentBg[liabilities.citLiability.intent]}`}>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
            {liabilities.citLiability.label}
          </div>
          <div className="text-xl">
            <CurrencyDisplay 
              gross={liveSummary.citLiability} 
              net={liveSummary.citLiability} 
              intent={liabilities.citLiability.intent} 
              className="text-lg"
            />
          </div>
        </div>

        {/* Gross Liability */}
        <div className={`p-4 rounded-xl border ${intentBg[liabilities.grossLiability.intent]}`}>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
            {liabilities.grossLiability.label}
          </div>
          <div className="text-xl">
            <CurrencyDisplay 
              gross={liveSummary.grossLiability} 
              net={liveSummary.grossLiability} 
              intent={liabilities.grossLiability.intent} 
              className="text-lg"
            />
          </div>
        </div>
      </div>

      {/* Totals Summary Line */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
        <div className="flex gap-6">
            <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase">NETTO SUMA</span>
                <span className="text-xs font-bold text-slate-700">
                    {liveSummary.totals.netAmount.toString()} PLN
                </span>
            </div>
            <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase">VAT SUMA</span>
                <span className="text-xs font-bold text-slate-700">
                    {liveSummary.totals.vatAmount.toString()} PLN
                </span>
            </div>
            <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase">BRUTTO SUMA</span>
                <span className="text-xs font-bold text-slate-700">
                    {liveSummary.totals.grossAmount.toString()} PLN
                </span>
            </div>
        </div>
        <div className="px-3 py-1 bg-slate-900 rounded text-white text-[10px] font-black uppercase tracking-[0.2em]">
            RAPORT DANYCH SUROWYCH
        </div>
      </div>
    </div>
  );
}
