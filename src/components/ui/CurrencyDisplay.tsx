import React from "react";
import { cn } from "@/lib/utils";
import Decimal from "decimal.js";

interface CurrencyDisplayProps {
    gross: number | string | Decimal;
    net?: number | string | Decimal;
    isIncome?: boolean; // If true, adds "+" prefix to positive values
    className?: string; // Additional classes for the primary amount
    primary?: "net" | "gross"; // Which value to highlight as primary
    hideSign?: boolean; // If true, uses standard sign rendering
    intent?: 'income' | 'cost' | 'tax-shield' | 'warning' | 'neutral'; // Forced semantic intent (Vector 200)
}

/**
 * Globalny Formatter do prezentacji kwot.
 * Zgodnie z wytycznymi Vector 200: Semantyka wizualna + Prawda matematyczna.
 * Emerald (Przychód), Rose (Koszt), Cyan (Tarcza podatkowa), Amber (Ostrzeżenie).
 */
export function CurrencyDisplay({ gross, net, isIncome, className, primary = "net", hideSign = false, intent }: CurrencyDisplayProps) {
    const gNum = typeof gross === 'number' ? gross : new Decimal(String(gross || 0)).toNumber();
    const nNum = net !== undefined ? (typeof net === 'number' ? net : new Decimal(String(net || 0)).toNumber()) : undefined;

    const displayPrimary = primary === "net" ? (nNum ?? gNum) : gNum;
    const displaySecondary = primary === "net" ? gNum : (nNum ?? gNum);

    // VECTOR 200: Deterministic Global Semantics
    let semanticColor = "text-slate-500";
    if (intent) {
        switch (intent) {
            case 'income': semanticColor = "text-emerald-600"; break;
            case 'cost': semanticColor = "text-rose-600"; break;
            case 'tax-shield': semanticColor = "text-cyan-600"; break;
            case 'warning': semanticColor = "text-amber-600"; break;
            case 'neutral': semanticColor = "text-slate-400"; break;
        }
    } else {
        // Automatic derivation based on sign (Visual Truth)
        semanticColor = displayPrimary > 0 ? "text-emerald-600" : displayPrimary < 0 ? "text-rose-600" : "text-slate-400";
    }

    const formatter = new Intl.NumberFormat('pl-PL', { 
        style: 'currency', 
        currency: 'PLN',
        minimumFractionDigits: 2,
        signDisplay: hideSign ? 'auto' : 'always'
    });

    return (
        <div className={cn("inline-flex items-center flex-wrap gap-x-2", semanticColor, className)}>
            <span className="font-black tracking-tight whitespace-nowrap">
                {formatter.format(displayPrimary)}
            </span>
            <span className="text-[0.6em] sm:text-[0.65em] font-bold opacity-40 whitespace-nowrap uppercase tracking-tighter">
                ({formatter.format(displaySecondary)} brutto)
            </span>
        </div>
    );
}
