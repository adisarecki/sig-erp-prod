import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import Decimal from "decimal.js"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Shared PLN formatting utility (Vector 099 consistent)
 */
export const formatPln = (value: number | string | Decimal) => {
    const num = typeof value === 'number' ? value : new Decimal(String(value)).toNumber()
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(num)
}
