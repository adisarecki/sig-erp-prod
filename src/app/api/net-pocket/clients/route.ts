import { NextResponse } from "next/server";

const NET_POCKET_API_URL = "https://api.net-pocket.com/api/clients/details";

/**
 * Zewnętrzny Proxy-Hub dla API Net-Pocket (Vector 010)
 * 
 * Służy do omijania polityki CORS narzucanej przez przeglądarkę przy wywołaniu Client Components,
 * oraz izolowania całej aplikacji od niestabilności wywołań API (Decoupling).
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const nip = searchParams.get("nip");

        if (!nip) {
            return NextResponse.json({ success: false, error: "Brak parametru NIP" }, { status: 400 });
        }

        // Kontrolowany limit czasowy dla wywołania (np. zewnętrzna awaria)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 sekund max
        
        const url = `${NET_POCKET_API_URL}?nip=${nip}`;
        
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn(`[NET_POCKET_PROXY] Błąd odpowiedzi dla NIP ${nip}: ${response.status}.`);
            return NextResponse.json({ success: false, data: null }, { status: 200 });
        }

        const data = await response.json();
        
        return NextResponse.json({ success: true, data }, { status: 200 });

    } catch (error: any) {
        if (error.name === "AbortError") {
            console.warn("[NET_POCKET_PROXY] Timeout dla zewnętrznego API.");
        } else {
            console.error("[NET_POCKET_PROXY] Krytyczny błąd:", error);
        }
        
        return NextResponse.json({ success: false, data: null, error: "Net-Pocket Integration Offline" }, { status: 200 });
    }
}
