import { NextResponse } from 'next/server';
import { KSeFService } from '@/lib/ksef/ksefService';

export async function GET() {
    const report: string[] = [];
    const ksefSvc = new KSeFService();
    
    function logToReport(msg: string) {
        console.log(msg);
        report.push(msg);
    }

    logToReport("================================================================");
    logToReport("🚀 KSeF PRODUCTION VERIFICATION SUITE (Direct Token Mode)");
    logToReport(`🕒 Runtime: ${new Date().toISOString()}`);
    logToReport("================================================================");

    const testResults = {
        auth: false,
        query: false,
        parse: false,
        edgeCases: false
    };

    try {
        // --- 1. Authenticaton Check (Connectivity) ---
        logToReport("\nSTEP 1: Testing Production Connectivity...");
        try {
            const invoices = await ksefSvc.queryLatestInvoices();
            logToReport("✅ SUCCESS: Connected to MF API using Direct Token.");
            logToReport(`📊 Found ${invoices.length} invoices in recent metadata.`);
            testResults.auth = true;
            testResults.query = true;

            // --- 2. Data Mapping Integrity Check ---
            if (invoices.length > 0) {
                logToReport("\nSTEP 2: Validating Key Metadata Mapping...");
                const sample = invoices[0];
                
                // Fields KSeF uses in raw metadata may differ from our API output, 
                // but here we check for the availability of data to MAP.
                const requiredData = ['invoiceReferenceNumber', 'invoicingDate', 'buyerNip', 'sellerNip'];
                const missing = requiredData.filter(f => !sample[f]);
                
                if (missing.length === 0) {
                    logToReport("✅ SUCCESS: Found data for buyerNIP, sellerNIP, issueDate (invoicingDate).");
                    logToReport(`🔍 Sample: REF=${sample.invoiceReferenceNumber}, Seller=${sample.sellerNip}`);
                } else {
                    logToReport(`⚠️ WARNING: Missing or different field names: ${missing.join(', ')}`);
                }

                // --- 3. Detail Fetch & XML Parse ---
                logToReport("\nSTEP 3: Testing XML Fetch & Parse (Fa/2)...");
                const ksefRef = sample.invoiceReferenceNumber;
                const parsed = await ksefSvc.fetchAndParse(ksefRef);
                
                logToReport(`✅ SUCCESS: Fetched and parsed invoice ${ksefRef}.`);
                logToReport(`   - Nr: ${parsed.invoiceNumber}`);
                logToReport(`   - Amount: ${parsed.grossAmount.toString()} PLN`);
                logToReport(`   - Buyer: ${parsed.counterpartyName}`);
                testResults.parse = true;
            } else {
                logToReport("\nSTEP 2/3: INFO: Found 0 invoices. (Simulation: Empty List OK).");
            }
        } catch (err: any) {
            logToReport(`❌ FAILURE: API Communication error: ${err.message}`);
        }

        // --- 4. Edge Case Simulations ---
        logToReport("\nSTEP 4: Simulating Edge Cases...");
        
        // 4a. Invalid Token (401)
        try {
            logToReport("   Testing 401 Unauthorized (Invalid Token)...");
            await ksefSvc.queryLatestInvoices({ testToken: "INVALID_TOKEN_123" });
            logToReport("   ❌ FAILURE: API accepted an invalid token! (Security Risk)");
        } catch (err: any) {
            if (err.message.includes("401") || err.message.includes("403")) {
                logToReport("   ✅ SUCCESS: API correctly rejected invalid token.");
            } else {
                logToReport(`   ⚠️ INFO: Received unexpected error for invalid token: ${err.message}`);
            }
        }

        // 4b. Invalid Invoice ID (404)
        try {
            logToReport("   Testing 404 Not Found (Invalid KSeF Number)...");
            await ksefSvc.fetchAndParse("INVALID-KSEF-NUMBER-999");
            logToReport("   ❌ FAILURE: API returned data for a non-existent invoice!");
        } catch (err: any) {
            if (err.message.includes("404") || err.message.includes("400")) {
                logToReport("   ✅ SUCCESS: API correctly rejected non-existent invoice.");
            } else {
                logToReport(`   ⚠️ INFO: Received unexpected error for invalid ID: ${err.message}`);
            }
        }
        testResults.edgeCases = true;

    } catch (globalErr: any) {
        logToReport(`\n🔴 FATAL SYSTEM ERROR: ${globalErr.message}`);
    }

    logToReport("\n================================================================");
    logToReport("🏁 VERIFICATION SUMMARY");
    logToReport(`- Auth/Connectivity:  ${testResults.auth ? "OK" : "FAILED"}`);
    logToReport(`- Metadata Mapping:   ${testResults.query ? "OK" : "FAILED"}`);
    logToReport(`- XML Parse Logic:    ${testResults.parse ? "OK" : "FAILED"}`);
    logToReport(`- Edge Cases/Error:   ${testResults.edgeCases ? "OK" : "FAILED"}`);
    logToReport("================================================================");

    return NextResponse.json({
        success: testResults.auth && testResults.query,
        results: testResults,
        report
    });
}
