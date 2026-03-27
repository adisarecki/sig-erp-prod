import { NextResponse } from 'next/server';
import { KSeFService } from '@/lib/ksef/ksefService';

export async function GET() {
    try {
        const ksefSvc = new KSeFService();
        
        console.log("[KSEF_TEST] Starting test sync...");
        
        // 1. Query for latest invoices
        const latestInvoices = await ksefSvc.queryLatestInvoices();
        
        if (!latestInvoices || latestInvoices.length === 0) {
            return NextResponse.json({ 
                success: true, 
                message: "Authentication successful, but found 0 invoices in metadata sync." 
            });
        }

        // 3. Fetch & Parse the very first one for test
        const firstRow = latestInvoices[0];
        const ksefNumber = firstRow.ksefReferenceNumber || firstRow.ksefNumber;
        
        const parsedData = await ksefSvc.fetchAndParse(ksefNumber);
        
        // Log results to console as requested
        console.log("[KSEF_TEST] Successfully fetched and parsed one invoice:");
        console.log(`- KSeF ID: ${parsedData.ksefNumber}`);
        console.log(`- Invoice Nr: ${parsedData.invoiceNumber}`);
        console.log(`- Gross Amount: ${parsedData.grossAmount.toString()}`);
        console.log(`- Counterparty: ${parsedData.counterpartyName} (${parsedData.counterpartyNip})`);

        return NextResponse.json({
            success: true,
            summary: {
                ksefNumber: parsedData.ksefNumber,
                invoiceNumber: parsedData.invoiceNumber,
                grossAmount: parsedData.grossAmount.toString(),
                counterparty: parsedData.counterpartyName
            }
        });

    } catch (error: any) {
        console.error("[KSEF_TEST] Fatal Error during test sync:", error.message);
        return NextResponse.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
}
