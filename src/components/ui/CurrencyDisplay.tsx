import React from "react";
import { cn } from "@/lib/utils";
import Decimal from "decimal.js";

interface CurrencyDisplayProps {
    gross: number | string | Decimal;
    net?: number | string | Decimal;
    isIncome?: boolean; // If true, adds "+" prefix to positive values
    className?: string; // Additional classes for the gross amount
}

/**
 * Globalny Formatter do prezentacji kwot.
 * Zgodnie z wytycznymi VD: format `BRUTTO zł (netto zł)`, mniejszy font dla kwoty netto.
 */
export function CurrencyDisplay({ gross, net, isIncome, className }: CurrencyDisplayProps) {
    // Parser string/number/Decimal do liczby
    const gNum = typeof gross === 'number' ? gross : new Decimal(String(gross)).toNumber();
    const nNum = net !== undefined ? (typeof net === 'number' ? net : new Decimal(String(net)).toNumber()) : undefined;

    const formatter = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' });
    const formattedGross = formatter.format(Math.abs(gNum));
    
    // Ujemne/Dodatnie znaki, jeśli nie-isIncome to zakładamy, że to koszt (minus jeśli nie ma go w liczbie, ale zwykle zależy od interfejsu)
    // Zostawiam znak wyliczany na zewnątrz (częściowo) lub tutaj jako opcja.
    // Typowo isIncome === true -> "+"
    // isIncome === false -> "-"
    // Zrobię to elastyczne.
    let prefix = "";
    if (isIncome === true && gNum > 0) prefix = "+";
    else if (isIncome === false && gNum > 0) prefix = "-";
    // Jeśli gNum < 0 tzn że znak - już tam jest, więc:
    if (gNum < 0) {
        prefix = "-";
    }

    // Ustaw myNetto
    // Jeśli Netto nie przekazano lub jest tożsame z Brutto, to i tak możemy to wyrenderować
    const displayNet = nNum !== undefined ? nNum : gNum;
    const formattedNet = formatter.format(Math.abs(displayNet));

    // Domyślne kolory (zależą od parent elementu) - ale netto zawsze dyskretniejsze
    return (
        <div className={cn("inline-flex items-center flex-wrap gap-x-1", className)}>
            <span className="font-bold whitespace-nowrap">
                {prefix}{formattedGross}
            </span>
            <span className="text-[0.65em] font-normal opacity-60 whitespace-nowrap">
                ({formattedNet})
            </span>
        </div>
    );
}
