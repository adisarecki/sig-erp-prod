/**
 * KSeF 2.0 Web API Client (Read-Only)
 * Implementation of the authentication and retrieval logic for Polish National e-Invoice System.
 */

import { Decimal } from 'decimal.js';

const KSEF_BASE_URL = process.env.KSEF_BASE_URL || 'https://api-demo.ksef.mf.gov.pl';
const KSEF_TOKEN = process.env.KSEF_TOKEN;

/**
 * KSeF Session State
 */
interface KSeFSession {
    sessionId: string;
    token: string;
    expiresAt: number;
}

let currentSession: KSeFSession | null = null;

/**
 * Low-level KSeF Client
 */
export class KSeFClient {
    private baseUrl: string;
    private token: string | undefined;

    constructor() {
        this.baseUrl = KSEF_BASE_URL.replace(/\/$/, '');
        this.token = KSEF_TOKEN;
    }

    /**
     * Authenticate and get a session ID
     */
    async authenticate(nip: string): Promise<string> {
        if (!this.token) {
            throw new Error('KSEF_TOKEN is not configured in environment variables.');
        }

        // 1. Get Challenge
        const challengeResponse = await fetch(`${this.baseUrl}/online/Session/AuthorisationChallenge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contextIdentifier: {
                    type: 'on',
                    identifier: nip
                }
            })
        });

        if (!challengeResponse.ok) {
            const error = await challengeResponse.text();
            throw new Error(`KSeF Challenge Failed: ${challengeResponse.status} - ${error}`);
        }

        const { challenge, timestamp } = await challengeResponse.json();

        // 2. Initialize Session with Token
        // NOTE: In a real production scenario, we would need to generate a signed XML (InitSessionTokenRequest) 
        // with the token encrypted using the KSeF Public Key.
        // For the purpose of this implementation, we assume a simplified authentication or helper 
        // that handles the XML wrapping.
        
        // Mocking the XML InitSessionTokenRequest logic
        const initResponse = await fetch(`${this.baseUrl}/online/Session/InitToken`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/octet-stream', // KSeF often uses binary/xml for init
                'Accept': 'application/json'
            },
            body: this.generateInitTokenXml(nip, this.token, challenge, timestamp)
        });

        if (!initResponse.ok) {
            const error = await initResponse.text();
            throw new Error(`KSeF Session Init Failed: ${initResponse.status} - ${error}`);
        }

        const sessionData = await initResponse.json();
        const sessionId = sessionData.sessionToken.token;

        currentSession = {
            sessionId: sessionId,
            token: this.token,
            expiresAt: Date.now() + 3600000 // Assume 1 hour session
        };

        return sessionId;
    }

    /**
     * Search for invoices
     */
    async queryInvoices(sessionId: string, params: { dateFrom: string, dateTo: string }) {
        const response = await fetch(`${this.baseUrl}/online/Query/Invoice/Sync?PageSize=100&PageOffset=0`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'SessionToken': sessionId
            },
            body: JSON.stringify({
                queryCriteria: {
                    type: 'incremental',
                    acquisitionTimestampThresholdFrom: params.dateFrom,
                    acquisitionTimestampThresholdTo: params.dateTo
                }
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`KSeF Query Failed: ${response.status} - ${error}`);
        }

        return await response.json();
    }

    /**
     * Download specific invoice XML
     */
    async downloadInvoice(sessionId: string, ksefNumber: string): Promise<string> {
        const response = await fetch(`${this.baseUrl}/online/Query/Invoice/Get/${ksefNumber}`, {
            method: 'GET',
            headers: {
                'SessionToken': sessionId,
                'Accept': 'application/octet-stream'
            }
        });

        if (!response.ok) {
            throw new Error(`KSeF Download Failed for ${ksefNumber}: ${response.status}`);
        }

        return await response.text(); // Raw XML (FA(3))
    }

    /**
     * Generate the XML needed for InitToken
     * This is a simplified placeholder. Real KSeF requires a binary signed/encrypted XML.
     */
    private generateInitTokenXml(nip: string, token: string, challenge: string, timestamp: string): string {
        // In real FA(3) integration, this would use a library to build the signed XML.
        // For the sake of this service structure:
        return `<?xml version="1.0" encoding="UTF-8"?>
<InitSessionTokenRequest xmlns="http://ksef.mf.gov.pl/schema/gtw/svc/online/types/2021/10/01/0001">
    <Context>
        <Identifier xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="IdentifierNIPType">${nip}</Identifier>
        <Token>${token}</Token>
        <Challenge>${challenge}</Challenge>
        <Timestamp>${timestamp}</Timestamp>
    </Context>
</InitSessionTokenRequest>`;
    }
}
