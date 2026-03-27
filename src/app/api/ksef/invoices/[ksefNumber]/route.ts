import { NextRequest, NextResponse } from 'next/server';
import { KSeFClient } from '@/lib/ksef/ksef-client';
import { KSeFMapper } from '@/lib/ksef/ksef-mapper';

const OWNER_NIP = '9542751368';

export async function GET(
    request: NextRequest,
    { params }: { params: { ksefNumber: string } }
) {
    try {
        const ksefNumber = params.ksefNumber;
        if (!ksefNumber) throw new Error('ksefNumber jest wymagany.');

        const client = new KSeFClient();
        const mapper = new KSeFMapper();

        // 1. Authenticate
        await client.authenticate(OWNER_NIP);

        // 2. Download XML
        const xml = await client.downloadInvoice(ksefNumber);

        // 3. Parse XML
        const parsedData = mapper.parseXml(xml, ksefNumber);

        return NextResponse.json({
            ksefNumber,
            rawXml: xml,
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
