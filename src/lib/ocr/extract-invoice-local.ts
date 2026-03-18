/**
 * extract-invoice-local.ts
 *
 * Local OCR Text Parser – Regex-based extraction from raw Tesseract output.
 * TERRITORY: Agent 2 (Worker) – ZERO Prisma, ZERO tenantId, ZERO database writes.
 *
 * Replaces the OpenAI Vision API call with a fully offline, client-side pipeline.
 * Data contract: Must produce an OcrInvoiceData object with amounts as strings.
 */

import type { OcrInvoiceData } from "./types"

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Extracts a Polish NIP (10 digits) from a string.
 * CEO-spec: strip spaces/dashes first, then match exactly 10 digits.
 */
function extractNip(text: string): string | null {
    const cleaned = text.replace(/[-.\s]/g, "")
    const match = cleaned.match(/(?<!\d)\d{10}(?!\d)/)
    return match ? match[0] : null
}

/**
 * Extract amount from raw text.
 * Tries patterns like: 1 234,56 PLN / 1234.56 / 1 234.56 zł
 * Returns a normalized decimal string like "1234.56".
 */
function extractAmount(text: string, labelRegex: RegExp): string | null {
    const match = text.match(labelRegex)
    if (!match) return null

    // Capture everything after the label
    const raw = match[1]
    if (!raw) return null

    // Normalize: remove spaces used as thousand separators,
    // replace comma decimal separator with dot
    const normalized = raw
        .trim()
        .replace(/\s/g, "")
        .replace(",", ".")
        .replace(/[^\d.]/g, "") // strip all non-numeric except dot

    if (!normalized || isNaN(parseFloat(normalized))) return null
    return parseFloat(normalized).toFixed(2)
}

/**
 * Extract a date (YYYY-MM-DD or DD.MM.YYYY) from text following a label.
 * Returns ISO format: YYYY-MM-DD
 */
function extractDate(text: string, labelRegex: RegExp): string | null {
    const match = text.match(labelRegex)
    if (!match || !match[1]) return null

    const raw = match[1].trim()

    // ISO format: 2026-03-15
    if (/\d{4}-\d{2}-\d{2}/.test(raw)) {
        return raw.substring(0, 10)
    }

    // Polish format: 15.03.2026
    const polishMatch = raw.match(/(\d{2})\.(\d{2})\.(\d{4})/)
    if (polishMatch) {
        return `${polishMatch[3]}-${polishMatch[2]}-${polishMatch[1]}`
    }

    return null
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * extractFromRawText
 *
 * Parses raw Tesseract OCR output and extracts structured invoice data.
 * Returns an OcrInvoiceData object compatible with the Gatekeeper API contract.
 *
 * NOTE: Confidence scores are estimates based on field completeness, not actual OCR
 * confidence, since Tesseract returns word-level data which we aggregate here.
 *
 * @param rawText - Raw text string from Tesseract.js worker.recognize()
 */
export function extractFromRawText(rawText: string): OcrInvoiceData {
    const text = rawText

    // ─── NIP Extraction ────────────────────────────────────────────────────
    const nip = extractNip(text)

    // ─── Company Name ──────────────────────────────────────────────────────
    // Try to extract after "Sprzedawca:", "Wystawca:", "Nabywca:", etc.
    const sellerMatch = text.match(
        /(?:Sprzedawca|Wystawca|Dostawca|Firma|Nazwa)[\s:]+([^\n]+)/i
    )
    const parsedName = sellerMatch ? sellerMatch[1].trim().substring(0, 100) : null

    // ─── Invoice Number ────────────────────────────────────────────────────
    const invoiceNumberMatch = text.match(
        /(?:Faktura\s*(?:VAT)?|Nr\s+faktury|FV|Numer)[\s:\/\-]+([^\n,]+)/i
    )
    const invoiceNumber = invoiceNumberMatch ? invoiceNumberMatch[1].trim().substring(0, 50) : null

    // ─── Dates ─────────────────────────────────────────────────────────────
    const issueDate =
        extractDate(text, /(?:Data\s+wystawienia|Data\s+sprzeda.y|Wystawiono)[\s:]+(\d[\d\s./-]+)/i) ??
        new Date().toISOString().split("T")[0]

    const dueDate =
        extractDate(text, /(?:Termin\s+p.atno.ci|P.atno.. do|Do\s+zap.aty)[\s:]+(\d[\d\s./-]+)/i) ??
        null

    // ─── Monetary Amounts ──────────────────────────────────────────────────
    // Priority order: labeled "Netto:", "Do zapłaty:", "VAT:" etc.
    const netAmountRaw = extractAmount(
        text,
        /(?:Warto.. netto|Netto|Net)[\s:]+([0-9\s]+[,.]?[0-9]*)/i
    )
    const vatAmountRaw = extractAmount(
        text,
        /(?:Kwota VAT|VAT|Podatek VAT)[\s:]+([0-9\s]+[,.]?[0-9]*)/i
    )
    const grossAmountRaw = extractAmount(
        text,
        /(?:Warto.. brutto|Brutto|Do zap.aty|Razem)[\s:]+([0-9\s]+[,.]?[0-9]*)/i
    )

    // Derive missing amounts if possible
    let netAmount = netAmountRaw ?? "0.00"
    let vatAmount = vatAmountRaw ?? "0.00"
    let grossAmount = grossAmountRaw ?? "0.00"

    // If we have net and gross but not vat, derive it
    if (netAmountRaw && grossAmountRaw && !vatAmountRaw) {
        const derived = (parseFloat(grossAmountRaw) - parseFloat(netAmountRaw)).toFixed(2)
        vatAmount = parseFloat(derived) >= 0 ? derived : "0.00"
    }

    // If we have net and vat but not gross, derive it
    if (netAmountRaw && vatAmountRaw && !grossAmountRaw) {
        grossAmount = (parseFloat(netAmountRaw) + parseFloat(vatAmountRaw)).toFixed(2)
    }

    // ─── VAT Rate ──────────────────────────────────────────────────────────
    // Look for explicit VAT rate like "23%", "8%"
    const vatRateMatch = text.match(/\b(23|22|8|5|0)\s*%/)
    const vatRate = vatRateMatch ? `0.${vatRateMatch[1].padStart(2, "0")}` : "0.23"

    // ─── Invoice Type ──────────────────────────────────────────────────────
    // Heuristic: if "nabywca" or "klient" is mentioned more prominently → INCOME
    const hasIncome = /(?:nabywca|klient|odbiorca)/i.test(text)
    const type: "INCOME" | "COST" = hasIncome ? "INCOME" : "COST"

    // ─── Confidence Score ──────────────────────────────────────────────────
    // Simple heuristic: count how many fields were successfully extracted
    const filledFields = [nip, parsedName, invoiceNumber, netAmountRaw, vatAmountRaw, grossAmountRaw].filter(Boolean).length
    const ocrConfidence = Math.min(filledFields / 6, 1)

    return {
        nip: nip ?? "",
        parsedName: parsedName ?? "",
        invoiceNumber,
        issueDate,
        dueDate,
        netAmount,
        grossAmount,
        vatAmount,
        vatRate,
        type,
        ocrConfidence,
    }
}
