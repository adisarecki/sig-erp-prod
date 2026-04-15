import { NextRequest, NextResponse } from "next/server"
import Decimal from "decimal.js"
import { ocrDraftSchema, type SanitizedOcrDraft } from "@/lib/schemas/ocr-draft"

const SYSTEM_TENANT_ID = "default-tenant"

export async function POST(request: NextRequest) {
    let body: any
    try {
        body = await request.json()

        // --- ZAAWANSOWANA LOGIKA "ZAPŁACONO" I CZYSZCZENIE DAT ---
        const rawDueDate = String(body.dueDate || "").trim().toLowerCase();
        const isStandardDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDueDate);

        if (!isStandardDate) {
            // TUTAJ JEST ROZWIĄZANIE! Zod nienawidzi "null". 
            // Skoro to nie jest poprawna data (bo jest pusto albo jest napisane "Zapłacono"),
            // od razu zasilamy to pole datą wystawienia faktury.
            body.dueDate = body.issueDate || "";
        }

        // Zabezpieczenie innych pól przed byciem "null" dla spokoju Zoda
        if (!body.invoiceNumber) body.invoiceNumber = "";
        if (!body.nip) body.nip = "";
        if (body.vatRate !== undefined && body.vatRate !== null) {
            body.vatRate = String(body.vatRate);
        }

        // Zod przy ".optional()" akceptuje "undefined", ale odrzuca "null". 
        // Usuwamy wszystkie wartośći "null", żeby schema bezpiecznie je zignorowała.
        Object.keys(body).forEach(key => {
            if (body[key] === null) {
                delete body[key];
            }
        });

    } catch {
        return NextResponse.json({ error: "Nieprawidłowy format JSON." }, { status: 400 })
    }

    const validation = ocrDraftSchema.safeParse(body)

    if (!validation.success) {
        return NextResponse.json({
            error: "Błąd walidacji pól.",
            details: validation.error.issues.map(issue => ({
                field: issue.path.join("."),
                message: issue.message,
            })),
        }, { status: 422 })
    }

    try {
        const safeNet = data.netAmount || "0"
        const safeGross = data.grossAmount || "0"
        const safeVat = data.vatAmount || "0"

        netAmountCents = new Decimal(safeNet).times(100).toDecimalPlaces(0).toNumber()
        grossAmountCents = new Decimal(safeGross).times(100).toDecimalPlaces(0).toNumber()
        vatAmountCents = new Decimal(safeVat).times(100).toDecimalPlaces(0).toNumber()

        const expectedGrossCents = netAmountCents + vatAmountCents
        const diff = Math.abs(expectedGrossCents - grossAmountCents)

        // For DRAFTS, we only log the discrepancy but don't block if fields are empty
        if (diff > 1 && safeNet !== "0" && safeGross !== "0") {
            // Logging financial inconsistency but letting it through if it's a partial scan
            console.warn(`[OCR_DRAFT_INCONSISTENCY] Detected diff: ${diff} cents`);
        }
    } catch (err) {
        netAmountCents = 0
        grossAmountCents = 0
        vatAmountCents = 0
    }

    const sanitized: SanitizedOcrDraft = {
        nip: data.nip || "",
        parsedName: data.parsedName || "Nieznany Kontrahent",
        address: (data as any).address ?? null,
        issueDate: data.issueDate || new Date().toISOString().split('T')[0],
        dueDate: data.dueDate || data.issueDate || new Date().toISOString().split('T')[0],
        netAmountCents,
        grossAmountCents,
        vatAmountCents,
        invoiceNumber: data.invoiceNumber ?? null,
        type: data.type,
        vatRate: data.vatRate ?? "0.23",
        bankAccountNumber: data.bankAccountNumber ?? null,
        ocrConfidence: data.ocrConfidence ?? null,
        tenantId: SYSTEM_TENANT_ID,
    }

    return NextResponse.json({ status: "validated", draft: sanitized }, { status: 200 })
}