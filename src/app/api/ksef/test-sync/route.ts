import { NextResponse } from 'next/server';
import { KSeFService } from '@/lib/ksef/ksefService';
import { KsefSessionManager } from '@/lib/ksef/ksefSessionManager';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const ksefSvc = new KSeFService();
        const sessionMgr = new KsefSessionManager();

        // Podnieś pierwszą firmę dla testu
        const tenant = await prisma.tenant.findFirst();
        if (!tenant) throw new Error('Brak Tenant w bazie danych dla testu.');

        console.log(`[KSEF_TEST] Starting JWT Manager verification for Tenant: ${tenant.name}...`);
        
        // 1. Handshake (JWT Manager / Check & Refresh Logic)
        let accessToken: string;
        try {
            accessToken = await sessionMgr.ensureAccessToken(tenant.id);
        } catch (err: any) {
            console.error("[KSEF_TEST] JWT Manager failed:", err.message);
            return NextResponse.json({ 
                success: false, 
                error: `Błąd JWT Manager: ${err.message}` 
            }, { status: 401 });
        }

        // 2. Shallow Sync (Subject2) - Last 48 Hours
        try {
            const dateFrom = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
            const metadata = await ksefSvc.fetchInvoiceMetadata({
                accessToken,
                subjectType: 'subject2',
                dateFrom,
                pageSize: 10
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
