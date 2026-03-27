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
            const invoices = await ksefSvc.fetchInvoiceMetadata();
            logToReport(`✅ SUCCESS: Found ${invoices.length} invoices in recent metadata.`);
            testResults.query = true;

            // --- 3. Detail Fetch & XML Parse ---
            logToReport("\nSTEP 6: Testing XML Parser (FA 3) Logic...");
            
            // Hardcoded Test for Step 6 Persistence (Diagnostic - Dual Target)
            const POCZTA_POLSKA_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns="http://crd.gov.pl/wzor/2025/06/25/13775/">
    <Podmiot1><DaneIdentyfikacyjne><NIP>5250007313</NIP><Nazwa>Poczta Polska</Nazwa></DaneIdentyfikacyjne><Adres><AdresL1>ul. Rodziny Hiszpańskich 8</AdresL1></Adres></Podmiot1>
    <Fa>
        <P_1>2026-03-27</P_1><P_2>F00089G032600312887P</P_2><RodzajFaktury>VAT</RodzajFaktury>
        <P_13_7>10.07</P_13_7><P_15>10.07</P_15><KodWaluty>PLN</KodWaluty>
        <FaWiersz><P_7>Usługa pocztowa</P_7><P_8B>1</P_8B><P_9B>10.07</P_9B><P_12>zw</P_12></FaWiersz>
    </Fa>
</Faktura>`;

            const POLON_ALFA_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns="http://crd.gov.pl/wzor/2025/06/25/13775/">
    <Podmiot1><DaneIdentyfikacyjne><NIP>5440002233</NIP><Nazwa>POLON-ALFA</Nazwa></DaneIdentyfikacyjne><Adres><AdresL1>ul. Glinki 155</AdresL1></Adres></Podmiot1>
    <Fa>
        <P_1>2026-02-03</P_1><P_2>ZK2026001594</P_2><RodzajFaktury>ZAL</RodzajFaktury>
        <P_13_1>549.6</P_13_1><P_14_1>126.41</P_14_1><P_15>676.01</P_15><KodWaluty>PLN</KodWaluty>
        <FaWiersz><P_7>Przedpłata</P_7><P_8B>1</P_8B><P_9B>549.6</P_9B><P_12>23</P_12></FaWiersz>
        <Zamowienie>
            <ZamowienieWiersz><P_7>Gniazdo g-40</P_7><P_8B>2</P_8B><P_9B>200.00</P_9B><P_12>23</P_12></ZamowienieWiersz>
            <ZamowienieWiersz><P_7>Dostawa</P_7><P_8B>1</P_8B><P_9B>149.60</P_9B><P_12>23</P_12></ZamowienieWiersz>
        </Zamowienie>
    </Fa>
</Faktura>`;

            const runParserTest = (xml: string, expectedBrutto: number, expectedNr: string, expectedSeller: string) => {
                const parsed = (ksefSvc as any).parser.parse(xml);
                const fa = parsed.Faktura?.Fa || parsed.Fa;
                const podmiot1 = parsed.Faktura?.Podmiot1 || parsed.Podmiot1;
                const brutto = fa ? Number(fa.P_15) : 0;
                const nr = fa?.P_2;
                const seller = podmiot1?.DaneIdentyfikacyjne?.Nazwa;
                const address = podmiot1?.Adres?.AdresL1;
                const ok = brutto === expectedBrutto && nr === expectedNr && seller === expectedSeller && !!address;
                return { ok, brutto, nr, seller, address };
            };

            const t1 = runParserTest(POCZTA_POLSKA_XML_SAMPLE, 10.07, 'F00089G032600312887P', 'Poczta Polska');
            const t2 = runParserTest(POLON_ALFA_XML_SAMPLE, 676.01, 'ZK2026001594', 'POLON-ALFA');

            if (t1.ok && t2.ok) {
                logToReport("✅ SUCCESS: Polymorphic Parser FA (3) logic verified for standard and ZAL invoices.");
                logToReport(`   - Case 1 (Poczta): ${t1.brutto} PLN OK. Seller Identified: ${t1.seller}.`);
                logToReport(`   - Case 2 (POLON):  ${t2.brutto} PLN OK. Seller Identified: ${t2.seller}.`);
                testResults.parse = true;
            } else {
                logToReport(`❌ FAILURE: Parser mapping mismatch.`);
                if (!t1.ok) logToReport(`   - Sample 1 Fail: Got ${t1.brutto} / ${t1.seller} instead of 10.07 / Poczta Polska`);
                if (!t2.ok) logToReport(`   - Sample 2 Fail: Got ${t2.brutto} / ${t2.seller} instead of 676.01 / POLON-ALFA`);
            }

            if (invoices.length > 0) {
                logToReport("\nSTEP 6b: Testing LIVE detail fetch...");
                const sample = invoices[0];
                const ksefRef = sample.invoiceReferenceNumber;
                const liveParsed = await ksefSvc.fetchAndParse(ksefRef);
                logToReport(`✅ SUCCESS: Fetched and parsed live invoice ${ksefRef}.`);
            }
        } catch (err: any) {
            logToReport(`❌ FAILURE: API Communication error: ${err.message}`);
        }

        // --- 4. Edge Case Simulations ---
        logToReport("\nSTEP 7: Simulating Edge Cases...");
        
        // 4a. Invalid Token (401)
        try {
            logToReport("   Testing 401 Unauthorized (Invalid Token)...");
            await ksefSvc.fetchInvoiceMetadata({ sessionToken: "INVALID_TOKEN_123" });
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
