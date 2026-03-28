import { KSeFService } from "../src/lib/ksef/ksefService";
import crypto from 'crypto';

const KSEF_BASE_URL = 'https://api.ksef.mf.gov.pl/api';
const targetNip = '9542751368';
const targetToken = '20260327-EC-2A60C1F000-54605D3620-82|nip-9542751368|3293bfc8e66e44959e2afada4a7fbc0a981c736be3274b4682bc6bbeab1b3e05';

async function testInit() {
    try {
        console.log("Step 1: Challenge");
        const challengeRes = await fetch(`${KSEF_BASE_URL}/online/Session/AuthorisationChallenge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contextIdentifier: { type: "NIP", identifier: targetNip } })
        });
        const cData = await challengeRes.json();
        console.log("Challenge:", cData);

        const challengeUrl2 = `${KSEF_BASE_URL}/v2/auth/challenge`;
        const challengeRes2 = await fetch(challengeUrl2, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nip: targetNip }),
        });
        console.log("Challenge V2 Status:", challengeRes2.status);
        if (challengeRes2.ok) {
           console.log("Challenge V2:", await challengeRes2.json());
        }

    } catch (e: any) {
        console.error(e.message);
    }
}

testInit();
