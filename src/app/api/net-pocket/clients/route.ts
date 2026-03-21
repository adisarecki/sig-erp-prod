import { NextResponse } from "next/server";

const NET_POCKET_API_URL = "https://api.net-pocket.com/api/clients/details";

/**
 * Zewnętrzny Proxy-Hub dla API Net-Pocket (Vector 010)
 * 
 * Służy do omijania polityki CORS narzucanej przez przeglądarkę przy wywołaniu Client Components,
 * oraz izolowania całej aplikacji od niestabilności wywołań API (Decoupling).
 */
export async function GET() {
    try {
        // Kontrolowany limit czasowy dla wywołania (np. zewnętrzna awaria)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 sekund max
        
        const response = await fetch(NET_POCKET_API_URL, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                // "Authorization": `Bearer ${process.env.NET_POCKET_API_KEY}` // Odkomentuj w reaziem potrzeby autoryzacji
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn(`[NET_POCKET_PROXY] Błąd odpowiedzi od zewnętrznego API: ${response.status} ${response.statusText}. Zwracam pustą asercję.`);
            // Zwracamy PUSTĄ TABLICĘ zamiast błędu dla Frontendu z 200 OK w celach bezpieczeństwa ciągłości UI
            return NextResponse.json({ success: false, data: [] }, { status: 200 });
        }

        const data = await response.json();
        
        return NextResponse.json({ success: true, data }, { status: 200 });

    } catch (error: any) {
        if (error.name === "AbortError") {
            console.warn("[NET_POCKET_PROXY] Zewnętrzne serwery osiągnęły limit czasu (Timeout). Zwracam maskę pustych danych.");
        } else {
            console.error("[NET_POCKET_PROXY] Krytyczny błąd połączenia z Net-Pocket:", error);
        }
        
        // Cichy Fallback do renderowania głównego panelu pomimo awarii zewnętrznego API.
        return NextResponse.json({ success: false, data: [], error: "Net-Pocket Integration Offline" }, { status: 200 });
    }
}
