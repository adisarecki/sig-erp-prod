"use client";

import React from "react";
import Decimal from "decimal.js";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";

interface InvestigationModeItemListProps {
  items: any[];
}

export function InvestigationModeItemList({ items }: InvestigationModeItemListProps) {
  if (!items || items.length === 0) {
    return (
      <div className="p-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-600">
        Brak jeszcze dokumentów w sesji audytowej. Wgraj faktury, aby zobaczyć korekty i grupy projektowe.
      </div>
    );
  }

  // ─── VECTOR 200.25: TRANSACTION STACK GROUPING ────────────────────────────
  // Group by correctionGroup (shared Transaction Stack) or fall back to
  // a unique key per item so standalone documents never merge.
  type StackGroup = {
    label: string;
    items: any[];
    isStack: boolean;
    netAmount: Decimal;
    vatAmount: Decimal;
    grossAmount: Decimal;
  };

  const stacks: Record<string, StackGroup> = {};

  items.forEach((item) => {
    const stackKey = item.correctionGroup
      ? `CG::${item.correctionGroup}`
      : `SOLO::${item.id}`;

    if (!stacks[stackKey]) {
      stacks[stackKey] = {
        label: item.correctionGroup || item.contractorName || "INNE",
        items: [],
        isStack: false,
        netAmount: new Decimal(0),
        vatAmount: new Decimal(0),
        grossAmount: new Decimal(0),
      };
    }

    stacks[stackKey].items.push(item);
    // Signed math — corrections are already negative in the DB
    stacks[stackKey].netAmount = stacks[stackKey].netAmount.add(new Decimal(String(item.netAmount || 0)));
    stacks[stackKey].vatAmount = stacks[stackKey].vatAmount.add(new Decimal(String(item.vatAmount || 0)));
    stacks[stackKey].grossAmount = stacks[stackKey].grossAmount.add(new Decimal(String(item.grossAmount || 0)));
  });

  // Mark stacks that truly contain a correction
  Object.values(stacks).forEach((group) => {
    if (group.items.some((i) => i.isCorrection)) {
      group.isStack = true;
    }
  });
  // ──────────────────────────────────────────────────────────────────────────

  const fmt = (v: Decimal) =>
    new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN",
      signDisplay: "always",
    }).format(v.toNumber());

  return (
    <div className="space-y-6">
      {Object.values(stacks).map((group: StackGroup) => (
        <div
          key={group.label}
          className={`p-5 rounded-3xl border shadow-sm ${
            group.isStack
              ? "border-cyan-200 bg-cyan-50/30"
              : "border-slate-200 bg-white"
          }`}
        >
          {/* Stack Header */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2 text-sm uppercase tracking-[0.18em] text-slate-500 font-semibold">
                {group.isStack ? (
                  <>
                    <span className="text-cyan-600">🔗 Transaction Stack</span>
                    <Badge className="bg-cyan-100 text-cyan-800 border-none text-[10px] px-2 py-0.5 uppercase tracking-widest">
                      Net Truth: {fmt(group.netAmount)}
                    </Badge>
                  </>
                ) : (
                  <span>Dokument</span>
                )}
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{group.label}</h3>
            </div>

            {/* Reconciled totals for this stack */}
            <div className="grid grid-cols-3 gap-3 text-sm text-slate-600">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Net</div>
                <div className={`font-bold ${group.netAmount.gte(0) ? "text-slate-900" : "text-rose-600"}`}>
                  {fmt(group.netAmount)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">VAT</div>
                <div className={`font-bold ${group.vatAmount.gte(0) ? "text-slate-900" : "text-rose-600"}`}>
                  {fmt(group.vatAmount)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Gross</div>
                <div className={`font-bold ${group.grossAmount.gte(0) ? "text-slate-900" : "text-rose-600"}`}>
                  {fmt(group.grossAmount)}
                </div>
              </div>
            </div>
          </div>

          {/* Individual documents in the stack — oldest first */}
          <div className="grid gap-3">
            {group.items
              .slice()
              .sort((a, b) => new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime())
              .map((item: any) => {
                const isIntelligentCorrection = item.isCorrection && item.correctionOfItemId;
                const net = new Decimal(String(item.netAmount || 0));
                const vat = new Decimal(String(item.vatAmount || 0));
                const gross = new Decimal(String(item.grossAmount || 0));

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-4 grid gap-3 md:grid-cols-3 md:items-center ${
                      item.isCorrection
                        ? "border-cyan-200 bg-cyan-50"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    {/* Left: Invoice details */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-sm font-semibold text-slate-900">
                          {item.invoiceNumber}
                        </span>

                        {/* Collision-detected (Relational Intelligence) badge */}
                        {isIntelligentCorrection && (
                          <Badge className="bg-cyan-600 text-white border-none text-[10px] px-2 py-0.5">
                            🔗 INTELIGENTNA KOREKTA: ZMIANA WARTOŚCI
                          </Badge>
                        )}

                        {/* Keyword-detected correction without direct DB link */}
                        {item.isCorrection && !isIntelligentCorrection && item.correctionReference && (
                          <Badge className="bg-cyan-100 text-cyan-800 border-none">
                            🔗 Korekta #{item.correctionReference}
                          </Badge>
                        )}

                        {/* Original document in a stack */}
                        {!item.isCorrection && group.isStack && (
                          <Badge className="bg-slate-200 text-slate-700 border-none text-[10px]">
                            📄 Oryginał
                          </Badge>
                        )}

                        {/* Legacy link badges */}
                        {item.correctionOfItem?.invoiceNumber && !isIntelligentCorrection && (
                          <Badge className="bg-emerald-100 text-emerald-800 border-none">
                            🔗 Powiązano z #{item.correctionOfItem.invoiceNumber}
                          </Badge>
                        )}
                        {item.linkedInvoice?.invoiceNumber && (
                          <Badge className="bg-slate-100 text-slate-900 border-none">
                            🔗 Zapisano jako #{item.linkedInvoice.invoiceNumber}
                          </Badge>
                        )}
                      </div>

                      <div className="text-sm text-slate-600">
                        {item.contractorName} •{" "}
                        {new Date(item.issueDate).toLocaleDateString("pl-PL")}
                      </div>
                      {item.nip && (
                        <div className="text-xs text-slate-400 font-mono">NIP: {item.nip}</div>
                      )}

                      {/* VECTOR 200.50: Structured Comparison Model Display */}
                      {item.isCorrection && item.beforeNetAmount != null && (
                        <div className="mt-2 p-2.5 rounded-xl bg-white/60 border border-cyan-200/50 text-[10px] sm:text-xs">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <div className="text-slate-400 uppercase tracking-wider mb-0.5">Przed</div>
                              <div className="text-slate-600 font-medium">
                                {new Intl.NumberFormat("pl-PL").format(Number(item.beforeNetAmount))}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-400 uppercase tracking-wider mb-0.5">Po</div>
                              <div className="text-slate-600 font-medium">
                                {new Intl.NumberFormat("pl-PL").format(Number(item.afterNetAmount))}
                              </div>
                            </div>
                            <div>
                              <div className="text-cyan-600 uppercase tracking-wider mb-0.5 font-bold">Różnica</div>
                              <div className="text-cyan-700 font-bold">
                                {new Intl.NumberFormat("pl-PL").format(Number(item.deltaNetAmount))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Center: Amounts */}
                    <div className="grid gap-1 text-sm text-slate-600">
                      <div className="flex items-center justify-between">
                        <span>Net</span>
                        <CurrencyDisplay net={net} gross={net} intent={net.lt(0) ? "cost" : "income"} hideSign={false} className="text-sm" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span>VAT</span>
                        <CurrencyDisplay net={vat} gross={vat} intent={vat.lt(0) ? "cost" : "tax-shield"} hideSign={false} className="text-sm" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Gross</span>
                        <CurrencyDisplay net={gross} gross={gross} intent={gross.lt(0) ? "cost" : "income"} hideSign={false} className="text-sm" />
                      </div>
                    </div>

                    {/* Right: Status */}
                    <div className="flex flex-col gap-2 text-right">
                      <span className="text-xs uppercase tracking-[0.24em] text-slate-400">
                        Status
                      </span>
                      <span className="font-semibold text-slate-900">{item.status || "PENDING"}</span>
                      {item.isCorrection && (
                        <span className="text-[11px] uppercase tracking-[0.18em] text-cyan-700">
                          Korekta dokumentu
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
