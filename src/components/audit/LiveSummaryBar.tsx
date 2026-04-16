/**
 * Live Summary Bar Component - Vector 180.15
 * Dynamic fiscal summary with semantic color coding
 */

"use client";

import React from "react";
import { LiveSummary, FiscalCalculatorService } from "@/lib/audit";
import Decimal from "decimal.js";

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
      label: "Items",
      value: liveSummary.itemCount,
      color: "text-gray-600",
    },
    {
      label: "Verified",
      value: liveSummary.verifiedCount,
      color: "text-green-600",
    },
    {
      label: "Pending",
      value: liveSummary.pendingCount,
      color: "text-yellow-600",
    },
    {
      label: "Rejected",
      value: liveSummary.rejectedCount,
      color: "text-red-600",
    },
  ];

  if (isCompact) {
    return (
      <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center">
            <span className="text-xs text-gray-600">{stat.label}</span>
            <span className={`text-lg font-bold ${stat.color}`}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Item Statistics */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center p-2 bg-gray-50 rounded"
          >
            <span className="text-xs font-medium text-gray-600">
              {stat.label}
            </span>
            <span className={`text-xl font-bold ${stat.color}`}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Fiscal Liabilities */}
      <div className="grid grid-cols-3 gap-3">
        {/* VAT Saldo */}
        <div
          className="p-3 rounded-lg"
          style={{ backgroundColor: `${liabilities.vatSaldo.color}15` }}
        >
          <div className="text-xs font-medium text-gray-600 mb-1">
            {liabilities.vatSaldo.label}
          </div>
          <div
            className="text-lg font-bold"
            style={{ color: liabilities.vatSaldo.color }}
          >
            {FiscalCalculatorService.formatLiability(
              new Decimal(liveSummary.vatSaldo)
            )}
          </div>
        </div>

        {/* CIT Liability */}
        <div
          className="p-3 rounded-lg"
          style={{ backgroundColor: `${liabilities.citLiability.color}15` }}
        >
          <div className="text-xs font-medium text-gray-600 mb-1">
            {liabilities.citLiability.label}
          </div>
          <div
            className="text-lg font-bold"
            style={{ color: liabilities.citLiability.color }}
          >
            {FiscalCalculatorService.formatLiability(
              new Decimal(liveSummary.citLiability)
            )}
          </div>
        </div>

        {/* Gross Liability */}
        <div
          className="p-3 rounded-lg"
          style={{ backgroundColor: `${liabilities.grossLiability.color}15` }}
        >
          <div className="text-xs font-medium text-gray-600 mb-1">
            {liabilities.grossLiability.label}
          </div>
          <div
            className="text-lg font-bold"
            style={{ color: liabilities.grossLiability.color }}
          >
            {FiscalCalculatorService.formatLiability(
              new Decimal(liveSummary.grossLiability)
            )}
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-4 gap-2 text-sm">
        <div>
          <span className="text-gray-600">Net:</span>
          <span className="font-bold ml-2">
            {liveSummary.totals.netAmount.toString()} PLN
          </span>
        </div>
        <div>
          <span className="text-gray-600">VAT (23%):</span>
          <span className="font-bold ml-2">
            {liveSummary.totals.vatAmount.toString()} PLN
          </span>
        </div>
        <div>
          <span className="text-gray-600">CIT ({new Decimal(liveSummary.citRate).mul(100).toFixed(0)}%):</span>
          <span className="font-bold ml-2">
            {liveSummary.totals.citAmount.toString()} PLN
          </span>
        </div>
        <div>
          <span className="text-gray-600">Gross:</span>
          <span className="font-bold ml-2">
            {liveSummary.totals.grossAmount.toString()} PLN
          </span>
        </div>
      </div>
    </div>
  );
}
