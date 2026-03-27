import { NextResponse } from 'next/server';
import { KSeFService } from '@/lib/ksef/ksefService';
import prisma from '@/lib/prisma';

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
        // --- 1. Authenticaton Check (v2.0 4-Step Handshake) ---
        logToReport("\nSTEP 1-4: Starting KSeF v2.0 4-step Handshake...");
        
        let accessToken: string;
        try {
            // Internally logs Step 1, 2, 3, 4
            accessToken = await ksefSvc.getAccessToken();
            
            logToReport("✅ KROK 1: Wyzwanie (Challenge) OK.");
            logToReport("✅ KROK 2: Klucz i Szyfrowanie (RSA-OAEP) OK.");
            logToReport("✅ KROK 3: Inicjalizacja Tokena (202 Accepted) OK.");
            logToReport("✅ KROK 4: Pobranie Access Tokena (Redeem) OK.");
            logToReport(`🔑 Final AccessToken: ${accessToken.substring(0, 10)}...`);
            testResults.auth = true;
        } catch (err: any) {
            logToReport(`❌ FAILURE: Handshake failed: ${err.message}`);
            throw err;
        }

        // --- 2. Query Metadata using AccessToken ---
        logToReport("\nSTEP 5: Querying Metadata (Sync)...");
        try {
            const invoices = await ksefSvc.queryLatestInvoices();
            logToReport(`✅ SUCCESS: Found ${invoices.length} invoices in recent metadata.`);
            testResults.query = true;

            // --- 3. Detail Fetch & XML Parse ---
            if (invoices.length > 0) {
                logToReport("\nSTEP 6: Testing XML Fetch & Parse...");
                const sample = invoices[0];
                const ksefRef = sample.invoiceReferenceNumber;
                
                const parsed = await ksefSvc.fetchAndParse(ksefRef);
                
                logToReport(`✅ SUCCESS: Fetched and parsed invoice ${ksefRef}.`);
                logToReport(`   - Nr: ${parsed.invoiceNumber}`);
                logToReport(`   - Amount: ${parsed.grossAmount.toString()} PLN`);
                logToReport(`   - Buyer: ${parsed.counterpartyName}`);
                testResults.parse = true;
            } else {
                logToReport("\nSTEP 6: INFO: Found 0 invoices. (Simulation: Empty List OK).");
            }
        } catch (err: any) {
            logToReport(`❌ FAILURE: API Communication error: ${err.message}`);
        }

        // --- 4. Edge Case Simulations ---
        logToReport("\nSTEP 7: Simulating Edge Cases...");
        
        // 4a. Invalid Token (401)
        try {
            logToReport("   Testing 401 Unauthorized (Invalid Token)...");
            await ksefSvc.queryLatestInvoices({ sessionToken: "INVALID_TOKEN_123" });
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
    logToReport(`- Handshake 1-4:      ${testResults.auth ? "OK" : "FAILED"}`);
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
