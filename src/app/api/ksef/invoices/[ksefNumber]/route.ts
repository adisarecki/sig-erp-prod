import { NextRequest, NextResponse } from 'next/server';
import { KSeFService } from '@/lib/ksef/ksefService';

const OWNER_NIP = '9542751368';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ ksefNumber: string }> }
) {
    const { ksefNumber } = await params;
    try {
        const ksefSvc = new KSeFService();

        // 1. Session Handshake (v2.0)
        const sessionToken = await ksefSvc.getSessionToken();

        // 2. Fetch & Parse using SessionToken
        const parsedData = await ksefSvc.fetchAndParse(ksefNumber, { accessToken: sessionToken });

        return NextResponse.json({
            success: true,
            ksefNumber,
            rawXml: parsedData.rawXml,
            parsed: parsedData
        });


    } catch (error: any) {
        console.error(`[KSeF_API_DETAILS] Error for ${ksefNumber}:`, error);
        return NextResponse.json(
            { error: error.message || 'Błąd podczas pobierania detali faktury z KSeF' },
            { status: 500 }
        );
    }
}
