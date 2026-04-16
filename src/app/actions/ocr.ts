"use server"

import { getGeminiModel } from "@/lib/gemini"
import prisma from "@/lib/prisma"
import { getCurrentTenantId } from "@/lib/tenant"
import Decimal from "decimal.js"

export interface OcrResult {
    success: boolean;
    data?: {
        nip: string;
        parsedName: string;
        invoiceNumber: string;
        issueDate: string;
        dueDate: string;
        netAmount: string;
        vatAmount: string;
        grossAmount: string;
        vatRate: string;
        contractorId?: string;
        isNewContractor: boolean;
        isDuplicate: boolean;
        duplicateId?: string;
        bankAccountNumber?: string;
        isCorrection?: boolean;
        correctedInvoiceNumber?: string;
        beforeNetAmount?: string;
        beforeVatAmount?: string;
        beforeGrossAmount?: string;
        afterNetAmount?: string;
        afterVatAmount?: string;
        afterGrossAmount?: string;
        deltaNetAmount?: string;
        deltaVatAmount?: string;
        deltaGrossAmount?: string;
    };
    error?: string;
}

/**
 * scanInvoiceAction (DNA Vector 020)
 * 
 * OCR Engine: Gemini 1.5 Flash
 * Features: Smart Match (NIP), Duplicate Guard (ExternalId)
 */
export async function scanInvoiceAction(base64Data: string, mimeType: string): Promise<OcrResult> {
    const tenantId = await getCurrentTenantId();

    try {
        const model = getGeminiModel();

        const prompt = `
            Extract data from this invoice. Identify if it is a "FAKTURA KORYGUJĄCA" (Correction/Adjustment Invoice).
            Return ONLY a valid JSON object.
            
            Fields:
            - nip: Vendor NIP (only 10 digits)
            - parsedName: Vendor Name
            - invoiceNumber: Current Invoice Number (externalId)
            - issueDate: YYYY-MM-DD
            - dueDate: YYYY-MM-DD
            - isCorrection: boolean (true if title is FAKTURA KORYGUJĄCA or KOREKTA)
            - correctedInvoiceNumber: string (The original invoice number being corrected, if found)
            
            Comparison Values (ONLY for corrections):
            - beforeNetAmount, beforeVatAmount, beforeGrossAmount: strings (Values before correction / "Przed korektą")
            - afterNetAmount, afterVatAmount, afterGrossAmount: strings (Values after correction / "Po korekcie")
            - deltaNetAmount, deltaVatAmount, deltaGrossAmount: strings (The delta/difference / "Różnica" or "Kwota korekty")
            
            Standard Totals (Use these if NOT a correction, or populate from Delta if it is a correction):
            - netAmount: string like "1250.50"
            - vatAmount: string like "287.62"
            - grossAmount: string like "1538.12"
            
            Other:
            - vatRate: string like "0.23" for 23%
            - bankAccountNumber: 26-digit account number (no spaces)
        `;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType
                }
            }
        ]);

        const responseText = result.response.text();
        // Clean markdown blocks if any (Gemini with responseMimeType usually doesn't include them, but safety first)
        const cleanedJson = responseText.replace(/```json\n?|\n?```/g, "").trim();
        const extracted = JSON.parse(cleanedJson);

        // ─── SMART MATCH (NIP) ────────────────────────────────────────────────
        const contractor = await prisma.contractor.findFirst({
            where: {
                tenantId,
                nip: extracted.nip
            }
        });

        const contractorId = contractor?.id;
        const isNewContractor = !contractor;

        // ─── DUPLICATE GUARD ──────────────────────────────────────────────────
        let isDuplicate = false;
        let duplicateId: string | undefined;

        if (contractorId && extracted.invoiceNumber) {
            const existingInvoice = await prisma.invoice.findFirst({
                where: {
                    tenantId,
                    contractorId,
                    externalId: extracted.invoiceNumber,
                    type: "COST"
                }
            });

            if (existingInvoice) {
                isDuplicate = true;
                duplicateId = existingInvoice.id;
            }
        }

        return {
            success: true,
            data: {
                ...extracted,
                contractorId,
                isNewContractor,
                isDuplicate,
                duplicateId
            }
        };

    } catch (error: any) {
        console.error("[OCR_ERROR]", error);
        return {
            success: false,
            error: "Błąd podczas przetwarzania dokumentu AI. Możesz wprowadzić dane ręcznie."
        };
    }
}
