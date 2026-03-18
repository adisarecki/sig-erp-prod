/**
 * OCR Module – TypeScript Types
 *
 * TERRITORY: src/lib/ocr/ (Agent 2 – Worker)
 * ZERO Prisma imports. ZERO database logic. ZERO tenantId.
 */

/**
 * Raw structured data extracted from an invoice image by Vision API.
 * All monetary values are STRINGS to comply with API_CONTRACTS.md.
 */
export interface OcrInvoiceData {
    /** Contractor NIP – 10 digits, no separators */
    nip: string
    /** Contractor name as read from invoice */
    parsedName: string
    /** Invoice issue date – YYYY-MM-DD */
    issueDate: string
    /** Invoice due date – YYYY-MM-DD (optional) */
    dueDate: string | null
    /** Net amount as string, e.g. "1250.50" */
    netAmount: string
    /** Gross amount as string, e.g. "1537.62" */
    grossAmount: string
    /** VAT amount as string, e.g. "287.12" */
    vatAmount: string
    /** Invoice number / reference */
    invoiceNumber: string | null
    /** COST or INCOME */
    type: "COST" | "INCOME"
    /** VAT rate as string, e.g. "0.23" */
    vatRate: string
    /** OCR confidence score 0.0–1.0 */
    ocrConfidence: number
}

/**
 * Response from POST /api/ocr/scan
 */
export interface OcrScanResponse {
    status: "success" | "error"
    data?: OcrInvoiceData
    error?: string
}
