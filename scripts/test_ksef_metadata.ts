import { KSeFService } from "../src/lib/ksef/ksefService";
import fs from "fs";

const TEST_NIP = "9542751368";
const TEST_TOKEN = "20260327-EC-2A60C1F000-54605D3620-82|nip-9542751368|3293bfc8e66e44959e2afada4a7fbc0a981c736be3274b4682bc6bbeab1b3e05";

async function probeMetadataEndpoint() {
    const ksefSvc = new KSeFService();
    try {
        const sessionToken = await ksefSvc.getAccessToken(TEST_NIP, TEST_TOKEN);
        
        const urlWithQuery = "https://api.ksef.mf.gov.pl/api/v2/invoices/query/metadata?PageSize=50&PageOffset=0";
        
        const body = {
            queryCriteria: {
                subjectType: "subject2",
                type: "range",
                acquisitionTimestampThresholdFrom: "2026-01-01T00:00:00Z",
                acquisitionTimestampThresholdTo: "2026-03-28T23:59:59Z"
            }
        };

        console.log(`Sending body to:`, urlWithQuery);

        const res = await fetch(urlWithQuery, {
            method: "POST",
            headers: {
                "SessionToken": sessionToken,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(body)
        });

        console.log("STATUS:", res.status);
        const text = await res.text();
        console.log("RESPONSE:", text.slice(0, 500));

    } catch (e: any) {
        console.error("Error:", e.message);
    }
}

probeMetadataEndpoint();
