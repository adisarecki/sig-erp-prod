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
                "sellerNip": "NIP sprzedawcy (sprzedającego), 10 cyfr bez myślników",
                "buyerNip": "NIP nabywcy (kupującego), 10 cyfr bez myślników",
                "parsedName": "Nazwa sprzedawcy",
                "issueDate": "YYYY-MM-DD",
                "dueDate": "YYYY-MM-DD lub null",
                "netAmount": "kwota netto",
                "grossAmount": "kwota brutto",
                "vatAmount": "kwota VAT",
                "invoiceNumber": "numer faktury",
                "vatRate": "ułamek np. 0.23",
                "bankAccountNumber": "26 cyfr bez spacji (numer konta do wpłaty)",
                "isPaid": true/false (czy na dokumencie są słowa: Zapłacono, Gotówka, Karta, BLIK, Przelew wykonany itp.),
                "licensePlate": "Numer rejestracyjny pojazdu np. WE452YS (jeśli wykryto na fakturze za paliwo/naprawę)",
                "rawTextKeywords": "Główne pozycje, np. PALIWO, PRZEGLĄD, MATERIAŁY BUDOWLANE"
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

            // --- THE NIP LOGIC (Zadanie 1) ---
            // NIP Wizjonera: 9542751368
            const OWNER_NIP = "9542751368";
            
            parsedData = parsedData.map((item: any) => {
                const sellerNip = (item.sellerNip || "").replace(/\D/g, "");
                const buyerNip = (item.buyerNip || "").replace(/\D/g, "");

                // Auto-Classification Logic (The "Truth" Engine)
                let type = "UNRECOGNIZED_ENTITY";
                if (sellerNip === OWNER_NIP) {
                    type = "INCOME"; // My jesteśmy sprzedawcą
                } else if (buyerNip === OWNER_NIP) {
                    type = "COST";   // My jesteśmy nabywcą
                }

                // --- Business Rule: issueDate == dueDate => PAID ---
                const autoPaid = item.issueDate && item.dueDate && (item.issueDate === item.dueDate);
                
                return {
                    ...item,
                    type,
                    nip: sellerNip, // Fallback dla istniejącego UI (wymaga 'nip' jako NIP kontrahenta)
                    isPaid: item.isPaid || autoPaid,
                    rawOcrData: { ...item } // Store raw data for Audit Reconciliation Layer
                };
            });

            console.log(`[OCR] Sukces! Wykryto ${parsedData.length} dokument(y/ów). Typy: ${parsedData.map((i: { type: string }) => i.type).join(", ")}`);
            return NextResponse.json({ success: true, data: parsedData });
        } catch {
            console.error("[OCR JSON ERROR]", cleanedJson);
            return NextResponse.json({ 
                success: false, 
                error: "AI zwróciło niepoprawny format danych. Spróbuj ponownie lub wprowadź dane ręcznie." 
            }, { status: 422 });
        }

    } catch (error: unknown) {
        console.error("[OCR API CRITICAL ERROR]:", error);
        
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Specyficzna obsługa modelu 404
        if (errorMessage.includes("404") || errorMessage.includes("not found")) {
            return NextResponse.json({
                success: false,
                error: "Błąd konfiguracji modelu AI (Gemini 3 Flash). Skontaktuj się z administratorem lub spróbuj później."
            }, { status: 503 });
        }

        return NextResponse.json({
            success: false,
            error: errorMessage || "Błąd wewnętrzny serwera OCR (Unexpected)."
        }, { status: 500 });
    }
}