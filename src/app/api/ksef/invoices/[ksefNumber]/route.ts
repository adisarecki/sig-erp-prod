import { NextRequest, NextResponse } from 'next/server';
import { KSeFService } from '@/lib/ksef/ksefService';

const OWNER_NIP = '9542751368';

export async function GET(
    request: NextRequest,
    { params }: { params: { ksefNumber: string } }
) {
    try {
        const ksefNumber = params.ksefNumber;
        const ksefSvc = new KSeFService();

        // 1. Fetch & Parse
        const parsedData = await ksefSvc.fetchAndParse(ksefNumber);

        return NextResponse.json({
            ksefNumber,
            rawXml: parsedData.rawXml,
            parsed: parsedData
        });

    } catch (error: any) {
        console.error(`[KSeF_API_DETAILS] Error for ${params.ksefNumber}:`, error);
        return NextResponse.json(
            { error: error.message || 'Błąd podczas pobierania detali faktury z KSeF' },
            { status: 500 }
        );
    }
}
