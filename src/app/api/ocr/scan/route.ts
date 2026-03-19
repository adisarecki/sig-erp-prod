export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    try {
        console.log("[OCR] Odbieranie pliku...");

        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ success: false, error: "Brak pliku w żądaniu." }, { status: 400 });
        }

        console.log(`[OCR] Przetwarzanie: ${file.name} (${file.type})`);

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ success: false, error: "Brak klucza API Gemini w systemie." }, { status: 500 });
        }

        // Zamieniamy plik na bufor, a bufor na base64 - tak jak lubi Gemini
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64Data = buffer.toString("base64");

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        console.log("[OCR] Wysyłanie natywnego pliku do Gemini...");

        const result = await model.generateContent([
            `Jesteś ekspertem księgowym. Wyciągnij dane z załączonej faktury. Zwróć WYŁĄCZNIE czysty JSON, bez znaczników markdown.
            Struktura:
            {
                "nip": "10 cyfr bez myślników (np. 9542751368)",
                "parsedName": "Pełna nazwa sprzedawcy",
                "issueDate": "YYYY-MM-DD",
                "dueDate": "YYYY-MM-DD lub null",
                "netAmount": "kwota netto z kropką",
                "grossAmount": "kwota brutto z kropką",
                "vatAmount": "kwota VAT z kropką",
                "invoiceNumber": "numer faktury",
                "type": "COST",
                "vatRate": "stawka vat jako ułamek (np. 0.23)",
                "ocrConfidence": 0.99
            }`,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: file.type // "application/pdf" lub "image/jpeg"
                }
            }
        ]);

        let responseText = result.response.text().trim();

        // Czasami AI lubi dodać ```json na początku. Usuwamy to.
        responseText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();

        const parsedData = JSON.parse(responseText);
        console.log("[OCR] Sukces! Wykryto NIP:", parsedData.nip);

        return NextResponse.json({ success: true, data: parsedData });

    } catch (error: any) {
        console.error("[OCR API ERROR]:", error);
        return NextResponse.json({
            success: false,
            error: error.message || "Błąd wewnętrzny serwera."
        }, { status: 500 });
    }
}