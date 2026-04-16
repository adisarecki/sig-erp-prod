import { NextRequest, NextResponse } from 'next/server';
import { KSeFService } from '@/lib/ksef/ksefService';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ ksefNumber: string }> }
) {
    const { ksefNumber } = await params;
    try {
        const ksefSvc = new KSeFService();

        // Fetch & Parse (Direct Token from .env)
        const parsedData = await ksefSvc.fetchAndParse(ksefNumber);

        return NextResponse.json({
            ksefNumber,
            rawXml: parsedData.rawXml,
            parsed: parsedData
        });

    } catch (error: any) {
        console.error(`[KSeF_API_INVOICE_ALIAS] Error for ${ksefNumber}:`, error.message);
        return NextResponse.json(
            { error: error.message || 'Błąd podczas pobierania faktury z KSeF' },
            { status: 500 }
        );
    }
}
