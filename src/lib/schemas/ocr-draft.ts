/**
 * OCR DRAFT DATA CONTRACT – Zod Schema
 *
 * Defines the exact payload format that Agent 2 (OCR Worker) must send
 * to the Master's intake endpoint. This is the ONLY accepted format.
 *
 * RULES:
 *   - All monetary amounts MUST be strings (e.g., "1250.50"), NOT floats
 *   - NIP must be exactly 10 digits, no separators
 *   - tenantId is NEVER accepted from the payload (injected server-side from session)
 */

import { z } from "zod"

// ─── Validators ──────────────────────────────────────────────────────────────

/** Validates a monetary string: must be a valid decimal number as a string */
const moneyString = z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Kwota musi być stringiem w formacie '1250.50' (max 2 miejsca po przecinku)")

/** Validates NIP: exactly 10 digits, no separators */
const nipString = z
    .string()
    .regex(/^\d{10}$/, "NIP musi zawierać dokładnie 10 cyfr bez separatorów")

/** ISO 8601 date string: YYYY-MM-DD */
const dateString = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data musi być w formacie YYYY-MM-DD")

// ─── Main Schema ─────────────────────────────────────────────────────────────

export const ocrDraftSchema = z.object({
    /**
     * Contractor NIP extracted by OCR.
     * Clean 10-digit string, no dashes or spaces.
     */
    nip: nipString,

    /**
     * Name of the contractor as read from the invoice by OCR.
     * Will be matched against existing CRM database or created as new.
     */
    parsedName: z
        .string()
        .min(2, "Nazwa kontrahenta musi mieć minimum 2 znaki")
        .max(200, "Nazwa kontrahenta nie może przekraczać 200 znaków"),

    /**
     * Address of the contractor (optional).
     */
    address: z.string().max(300).optional(),

    /**
     * Invoice issue date in ISO format.
     */
    issueDate: dateString,

    /**
     * Invoice due date in ISO format (optional – defaults to issueDate + 14 days).
     */
    dueDate: dateString.optional(),

    /**
     * NET amount as a string. Example: "10000.00"
     * NEVER a float/number. This prevents JS floating-point precision errors.
     */
    netAmount: moneyString,

    /**
     * GROSS amount as a string. Example: "12300.00"
     */
    grossAmount: moneyString,

    /**
     * VAT amount as a string. Example: "2300.00"
     */
    vatAmount: moneyString,

    /**
     * Invoice number / reference as read by OCR (optional).
     */
    invoiceNumber: z.string().max(100).optional(),

    /**
     * Invoice type: COST (faktura zakupowa) or INCOME (faktura sprzedażowa).
     */
    type: z.enum(["COST", "INCOME"]),

    /**
     * VAT rate as string. Example: "0.23"
     */
    vatRate: z.coerce
        .string()
        .regex(/^[01](\.\d{1,2})?$/, "Stawka VAT musi być stringiem w formacie '0.23'")
        .optional(),

    /**
     * OCR confidence score (0.0 – 1.0).
     * Informational only – the Master decides what to do with partial data.
     */
    ocrConfidence: z.number().min(0).max(1).optional(),

    /**
     * Bank account number extracted from the invoice.
     */
    bankAccountNumber: z.string().max(34).optional(),
})

/** TypeScript type derived from the schema */
export type OcrDraftPayload = z.infer<typeof ocrDraftSchema>

/** Type for the sanitized, server-safe output after validation + decimal conversion */
export interface SanitizedOcrDraft {
    nip: string
    parsedName: string
    address: string | null
    issueDate: string
    dueDate: string
    netAmountCents: number    // Integer cents (e.g., 1250.50 → 125050)
    grossAmountCents: number
    vatAmountCents: number
    invoiceNumber: string | null
    type: "COST" | "INCOME"
    vatRate: string
    bankAccountNumber: string | null
    ocrConfidence: number | null
    tenantId: string           // Injected server-side, NEVER from payload
}
