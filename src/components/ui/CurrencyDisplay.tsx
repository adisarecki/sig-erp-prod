import React from "react";
import { cn } from "@/lib/utils";
import Decimal from "decimal.js";

interface CurrencyDisplayProps {
    gross: number | string | Decimal;
    net?: number | string | Decimal;
    isIncome?: boolean; // If true, adds "+" prefix to positive values
    className?: string; // Additional classes for the primary amount
    primary?: "net" | "gross"; // Which value to highlight as primary
}

/**
 * Globalny Formatter do prezentacji kwot.
 * Zgodnie z wytycznymi Vector 107/118: PRIORYTET DLA NETTO.
 * Format: `NETTO zł (brutto zł)`, mniejszy font dla kwoty brutto.
 */
export function CurrencyDisplay({ gross, net, isIncome, className, primary = "net" }: CurrencyDisplayProps) {
    const gNum = typeof gross === 'number' ? gross : new Decimal(String(gross)).toNumber();
    const nNum = net !== undefined ? (typeof net === 'number' ? net : new Decimal(String(net)).toNumber()) : undefined;

    const formatter = new Intl.NumberFormat('pl-PL', { 
        style: 'currency', 
        currency: 'PLN',
        minimumFractionDigits: 2
    });

    const displayPrimary = primary === "net" ? (nNum ?? gNum) : gNum;
    const displaySecondary = primary === "net" ? gNum : (nNum ?? gNum);

    let prefix = "";
    if (isIncome === true && displayPrimary > 0) prefix = "+";
    else if (isIncome === false && displayPrimary > 0) prefix = "-";
    
    if (displayPrimary < 0) {
        prefix = "-";
    }

    const formattedPrimary = formatter.format(Math.abs(displayPrimary));
    const formattedSecondary = formatter.format(Math.abs(displaySecondary));

    return (
        <div className={cn("inline-flex items-center flex-wrap gap-x-2", className)}>
            <span className="font-black tracking-tight whitespace-nowrap">
                {prefix}{formattedPrimary}
            </span>
            <span className="text-[0.6em] sm:text-[0.65em] font-bold opacity-40 whitespace-nowrap uppercase tracking-tighter">
                ({formattedSecondary} brutto)
            </span>
        </div>
    );
}
