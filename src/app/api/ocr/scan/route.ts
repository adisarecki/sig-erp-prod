export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { initFirebaseAdmin } from "@/lib/firebaseAdmin";
import { getGeminiModel } from "@/lib/gemini";

// Inicjalizacja dla OCR
initFirebaseAdmin();

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

        // Zamieniamy plik na bufor, a bufor na base64
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64Data = buffer.toString("base64");

        // --- UNIFIED GENAI ENGINE (Vector 021) ---
        const model = getGeminiModel();

        console.log(`[OCR] Wysyłanie do Gemini (Model: gemini-3-flash)...`);

        const result = await model.generateContent([
            `Jesteś ekspertem księgowym. Wyciągnij dane z obrazu. Jeśli na zdjęciu znajduje się więcej niż jeden dokument (np. dwa paragony obok siebie), wyodrębnij dane dla każdego z nich osobno.
            Zwróć WYŁĄCZNIE czysty JSON w formacie tablicy obiektów: [{...}, {...}].
            
            Struktura pojedynczego obiektu:
            {
                "nip": "10 cyfr bez myślników",
                "parsedName": "Nazwa sprzedawcy",
                "issueDate": "YYYY-MM-DD",
                "dueDate": "YYYY-MM-DD lub null",
                "netAmount": "kwota netto",
                "grossAmount": "kwota brutto",
                "vatAmount": "kwota VAT",
                "invoiceNumber": "numer faktury",
                "type": "COST",
                "vatRate": "ułamek np. 0.23",
                "isPaid": true/false (czy na dokumencie są słowa: Zapłacono, Gotówka, Karta, BLIK, Przelew wykonany itp.)
            }`,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: file.type
                }
            }
        ]);

        const responseText = result.response.text().trim();
        const cleanedJson = responseText.replace(/```json\n?|\n?```/g, "").trim();
        
        try {
            let parsedData = JSON.parse(cleanedJson);
            
            // Zawsze zwracamy tablicę, nawet jeśli AI zwróciło jeden obiekt
            if (!Array.isArray(parsedData)) {
                parsedData = [parsedData];
            }

            console.log(`[OCR] Sukces! Wykryto ${parsedData.length} dokument(y/ów).`);
            return NextResponse.json({ success: true, data: parsedData });
        } catch (jsonErr) {
            console.error("[OCR JSON ERROR]", cleanedJson);
            return NextResponse.json({ 
                success: false, 
                error: "AI zwróciło niepoprawny format danych. Spróbuj ponownie lub wprowadź dane ręcznie." 
            }, { status: 422 });
        }

    } catch (error: any) {
        console.error("[OCR API CRITICAL ERROR]:", error);
        
        // Specyficzna obsługa modelu 404
        if (error.message?.includes("404") || error.message?.includes("not found")) {
            return NextResponse.json({
                success: false,
                error: "Błąd konfiguracji modelu AI (Gemini 3 Flash). Skontaktuj się z administratorem lub spróbuj później."
            }, { status: 503 });
        }

        return NextResponse.json({
            success: false,
            error: error.message || "Błąd wewnętrzny serwera OCR."
        }, { status: 500 });
    }
}