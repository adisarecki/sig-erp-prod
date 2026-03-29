import { NextResponse } from 'next/server';
import { KSeFService } from '@/lib/ksef/ksefService';

export async function GET() {
    try {
        const ksefSvc = new KSeFService();
        console.log("[KSEF_TEST] Starting handshake verification (v2.0)...");
        
        // 1. Handshake (JWT v2)
        let accessToken: string;
        try {
            accessToken = await ksefSvc.getAccessToken();
        } catch (err: any) {
            console.error("[KSEF_TEST] Handshake failed:", err.message);
            return NextResponse.json({ 
                success: false, 
                error: `Błąd uścisku dłoni JWT v2: ${err.message}` 
            }, { status: 401 });
        }

        // 2. Shallow Sync (Subject2)
        try {
            const metadata = await ksefSvc.fetchInvoiceMetadata({
                accessToken,
                subjectType: 'subject2',
                pageSize: 5
            });

            return NextResponse.json({
                success: true,
                accessToken: `${accessToken.substring(0, 10)}...`,
                metadataCount: metadata.length,
                message: `JWT v2 Standard OK. Znaleziono ${metadata.length} nagłówków faktur (Koszty).`
            });
        } catch (err: any) {
             console.error("[KSEF_TEST] Shallow Sync failed:", err.message);
             return NextResponse.json({ 
                success: false, 
                accessToken: `${accessToken.substring(0, 10)}...`,
                error: `Błąd pobierania metadanych: ${err.message}` 
            }, { status: 500 });
        }


    } catch (error: any) {
        console.error("[KSEF_TEST] Fatal Error during test sync:", error.message);
        return NextResponse.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
}
