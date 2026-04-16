"use client";

import React from "react";
import Decimal from "decimal.js";
import { Badge } from "@/components/ui/badge";

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

  const groups = items.reduce((acc: Record<string, any>, item) => {
    const groupKey = item.correctionGroup || item.projectId || item.contractorName || "INNE";
    const groupLabel = item.correctionGroup
      ? `Project Shadow: ${item.correctionGroup}`
      : item.projectId
      ? `Project: ${item.projectId}`
      : `${item.contractorName}`;

    if (!acc[groupKey]) {
      acc[groupKey] = {
        label: groupLabel,
        items: [],
        netAmount: new Decimal(0),
        vatAmount: new Decimal(0),
        grossAmount: new Decimal(0),
      };
    }

    acc[groupKey].items.push(item);
    acc[groupKey].netAmount = acc[groupKey].netAmount.add(new Decimal(item.netAmount || 0));
    acc[groupKey].vatAmount = acc[groupKey].vatAmount.add(new Decimal(item.vatAmount || 0));
    acc[groupKey].grossAmount = acc[groupKey].grossAmount.add(new Decimal(item.grossAmount || 0));

    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.values(groups).map((group: any) => (
        <div key={group.label} className="p-5 rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2 text-sm uppercase tracking-[0.18em] text-slate-500 font-semibold">
                <span>Project Shadow</span>
                {group.label.includes("Project Shadow") ? (
                  <Badge variant="secondary" className="uppercase text-[10px] px-2 py-1">
                    korekta
                  </Badge>
                ) : null}
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{group.label}</h3>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm text-slate-600">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Net</div>
                <div className="font-bold text-slate-900">{group.netAmount.toFixed(2)} PLN</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">VAT</div>
                <div className="font-bold text-slate-900">{group.vatAmount.toFixed(2)} PLN</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Gross</div>
                <div className="font-bold text-slate-900">{group.grossAmount.toFixed(2)} PLN</div>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            {group.items.map((item: any) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 grid gap-3 md:grid-cols-3 md:items-center"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-sm font-semibold text-slate-900">{item.invoiceNumber}</span>
                    {item.isCorrection && item.correctionReference ? (
                      <Badge className="bg-cyan-100 text-cyan-800 border-none">🔗 POWIĄZANO Z #{item.correctionReference}</Badge>
                    ) : item.correctionOfItem?.invoiceNumber ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-none">🔗 POWIĄZANO Z #{item.correctionOfItem.invoiceNumber}</Badge>
                    ) : null}
                  </div>
                  <div className="text-sm text-slate-600">{item.contractorName} • {new Date(item.issueDate).toLocaleDateString()}</div>
                </div>

                <div className="grid gap-1 text-sm text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>Net</span>
                    <span className="font-semibold text-slate-900">{new Decimal(item.netAmount || 0).toFixed(2)} PLN</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>VAT</span>
                    <span className="font-semibold text-slate-900">{new Decimal(item.vatAmount || 0).toFixed(2)} PLN</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Gross</span>
                    <span className="font-semibold text-slate-900">{new Decimal(item.grossAmount || 0).toFixed(2)} PLN</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 text-right">
                  <span className="text-xs uppercase tracking-[0.24em] text-slate-400">Status</span>
                  <span className="font-semibold text-slate-900">{item.status || "PENDING"}</span>
                  {item.isCorrection && (
                    <span className="text-[11px] uppercase tracking-[0.24em] text-cyan-700">Korekta dokumentu</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
