import { NextResponse } from 'next/server';
import { KSeFService } from '@/lib/ksef/ksefService';

export async function GET() {
    try {
        const ksefSvc = new KSeFService();
        console.log("[KSEF_TEST] Starting handshake verification (v2.0)...");
        
        // Handshake
        let sessionToken: string;
        try {
            // Uses KSEF_NIP and KSEF_TOKEN from env
            sessionToken = await ksefSvc.getSessionToken();
        } catch (err: any) {
            console.error("[KSEF_TEST] Handshake failed:", err.message);
            return NextResponse.json({ 
                success: false, 
                error: `Błąd uścisku dłoni: ${err.message}` 
            }, { status: 401 });
        }

        return NextResponse.json({
            success: true,
            sessionToken: `${sessionToken.substring(0, 10)}...`,
            message: "Połączenie z KSeF (v2.0) zestawione pomyślnie."
        });


    } catch (error: any) {
        console.error("[KSEF_TEST] Fatal Error during test sync:", error.message);
        return NextResponse.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
}
