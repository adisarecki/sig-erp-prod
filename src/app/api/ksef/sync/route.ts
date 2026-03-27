import { NextResponse } from 'next/server';
import { getCurrentTenantId } from '@/lib/tenant';
import prisma from '@/lib/prisma';
import { KSeFService } from '@/lib/ksef/ksefService';
import { getAdminDb } from '@/lib/firebaseAdmin';

/**
 * GET /api/ksef/sync
 * Manually trigger KSeF invoice synchronization.
 * Fetched invoices are upserted into Prisma and Firestore (Dual-Sync).
 */
export async function GET() {
    try {
        // 1. Initialize Service & Tenant
        const ksefService = new KSeFService();
        const tenantId = await getCurrentTenantId();

        // 2. Get sessionToken (v2.0 handshake with dynamic key)
        let sessionToken: string;
        try {
            sessionToken = await ksefService.getSessionToken();
        } catch (err: any) {
            console.error("[KSeF_SYNC_AUTH_ERROR]", err.message);
            return NextResponse.json(
                { success: false, error: `Błąd autoryzacji KSeF (v2.0): ${err.message}` },
                { status: 401 }
            );
        }

        // 3. Use sessionToken for further requests (fetch invoices)
        const invoiceList = await ksefService.fetchInvoiceMetadata({ sessionToken });
        
        if (!invoiceList || invoiceList.length === 0) {
            console.log("[KSeF_SYNC] No new invoices found in the current period.");
            return NextResponse.json({
                success: true,
                count: 0,
                invoices: [],
                message: "Brak nowych faktur w KSeF w wybranym okresie."
            });
        }

        // 4. Batch Fetch Detail XML & Save to Databases
        const results = [];
        const db = getAdminDb();

        for (const item of invoiceList) {
            try {
                // Fetch full XML details
                const details = await ksefService.fetchAndParse(item.invoiceReferenceNumber, { sessionToken });
                
                // 4a. Prisma Upsert (SQL)
                const savedInvoice = await prisma.ksefInvoice.upsert({
                    where: { ksefNumber: details.ksefNumber },
                    update: {
                        status: 'UNVERIFIED', // Reset to unverified for re-scans if needed
                        updatedAt: new Date(),
                    },
                    create: {
                        tenantId,
                        ksefNumber: details.ksefNumber,
                        invoiceNumber: details.invoiceNumber,
                        issueDate: details.issueDate,
                        counterpartyNip: details.counterpartyNip,
                        counterpartyName: details.counterpartyName,
                        netAmount: details.netAmount,
                        vatAmount: details.vatAmount,
                        grossAmount: details.grossAmount,
                        rawXml: details.rawXml,
                        status: 'UNVERIFIED',
                    }
                });

                // 4b. Firestore Sync (NoSQL)
                // Use doc ID as ksefNumber to avoid duplicates
                const firestoreRef = db.collection('tenants').doc(tenantId).collection('ksefInvoices').doc(details.ksefNumber);
                await firestoreRef.set({
                    ksefNumber: details.ksefNumber,
                    invoiceNumber: details.invoiceNumber,
                    issueDate: details.issueDate.toISOString(),
                    counterpartyNip: details.counterpartyNip,
                    counterpartyName: details.counterpartyName,
                    grossAmount: details.grossAmount.toNumber(),
                    status: 'UNVERIFIED',
                    syncedAt: new Date().toISOString(),
                }, { merge: true });

                results.push({
                    id: savedInvoice.id,
                    ksefNumber: details.ksefNumber,
                    invoiceNumber: details.invoiceNumber,
                    seller: details.counterpartyName,
                    amount: details.grossAmount.toString(),
                    status: "UNVERIFIED"
                });

            } catch (err: any) {
                console.error(`[KSeF_SYNC_DETAIL_ERROR] ${item.invoiceReferenceNumber}:`, err.message);
            }
        }

        return NextResponse.json({
            success: true,
            count: results.length,
            invoices: results,
            message: `Pomyślnie zsynchronizowano i zapisano ${results.length} faktur z KSeF.`
        });

    } catch (error: any) {
        console.error("[KSeF_API_SYNC_ERROR]", error);
        return NextResponse.json(
            { success: false, error: error.message || "Wystąpił błąd podczas synchronizacji z KSeF." },
            { status: 500 }
        );
    }
}
