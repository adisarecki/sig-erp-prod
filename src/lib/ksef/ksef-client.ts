/**
 * KSeF v2 Web API Client (Read-Only / Pobieranie)
 * 
 * Official API Docs: https://api.ksef.mf.gov.pl/docs/v2/index.html
 * 
 * Flow:
 *   1. POST /v2/auth/challenge → { challenge, timestamp }
 *   2. POST /v2/auth/ksef-token → { authenticationToken.token } (Bearer)
 *   3. POST /v2/invoices/query/metadata → invoice list (Subject1=INCOME, Subject2=EXPENSE)
 *   4. GET  /v2/invoices/ksef/{ksefNumber} → raw XML
 *   5. DELETE /v2/auth/sessions/current → session cleanup
 * 
 * IMPORTANT: This client ONLY reads from KSeF. It NEVER sends invoices.
 */

// Production: https://api.ksef.mf.gov.pl
// Test:       https://api-test.ksef.mf.gov.pl
const KSEF_BASE_URL = process.env.KSEF_BASE_URL || 'https://api-test.ksef.mf.gov.pl';
const KSEF_TOKEN = process.env.KSEF_TOKEN;

export class KSeFClient {
    private baseUrl: string;
    private token: string | undefined;
    private bearerToken: string | null = null;

    constructor() {
        this.baseUrl = KSEF_BASE_URL.replace(/\/$/, '');
        this.token = KSEF_TOKEN;
    }

    /**
     * Full authentication flow (2 steps):
     * Step 1: POST /v2/auth/challenge
     * Step 2: POST /v2/auth/ksef-token
     * Returns: Bearer token string for subsequent API calls.
     */
    async authenticate(nip: string): Promise<string> {
        if (!this.token) {
            throw new Error('KSEF_TOKEN is not configured in environment variables.');
        }

        // --- Step 1: Get Challenge ---
        console.log('[KSeF_CLIENT] Step 1: Requesting challenge...');
        const challengeResponse = await fetch(`${this.baseUrl}/v2/auth/challenge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                contextIdentifier: {
                    type: 'Nip',
                    value: nip
                }
            })
        });

        if (!challengeResponse.ok) {
            const error = await challengeResponse.text();
            throw new Error(`KSeF Challenge Failed: ${challengeResponse.status} - ${error}`);
        }

        const { challenge, timestamp } = await challengeResponse.json();
        console.log('[KSeF_CLIENT] Challenge received.');

        // --- Step 2: Authenticate with Token ---
        // The token must be concatenated with timestamp: "token|timestamp"
        // Then encrypted with RSA-OAEP using KSeF public key and Base64 encoded.
        // NOTE: For test environment, KSeF may accept a simplified token flow.
        // In production, you MUST use the RSA-OAEP encryption.
        const encryptedToken = this.encryptToken(this.token, timestamp);

        console.log('[KSeF_CLIENT] Step 2: Authenticating with token...');
        const authResponse = await fetch(`${this.baseUrl}/v2/auth/ksef-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                challenge: challenge,
                contextIdentifier: {
                    type: 'Nip',
                    value: nip
                },
                encryptedToken: encryptedToken
            })
        });

        if (!authResponse.ok) {
            const error = await authResponse.text();
            throw new Error(`KSeF Auth Failed: ${authResponse.status} - ${error}`);
        }

        const authData = await authResponse.json();
        this.bearerToken = authData.authenticationToken?.token;

        if (!this.bearerToken) {
            throw new Error('KSeF Auth: No authentication token in response.');
        }

        console.log('[KSeF_CLIENT] Authentication successful. Bearer token acquired.');
        return this.bearerToken;
    }

    /**
     * Query invoice metadata.
     * subjectType: 'Subject1' = issued (INCOME), 'Subject2' = received (EXPENSE)
     * 
     * POST /v2/invoices/query/metadata?pageOffset=0&pageSize=100&sortOrder=Descending
     */
    async queryInvoices(
        subjectType: 'Subject1' | 'Subject2',
        params: { dateFrom: string; dateTo: string }
    ) {
        this.ensureAuthenticated();

        const url = `${this.baseUrl}/v2/invoices/query/metadata?pageOffset=0&pageSize=100&sortOrder=Descending`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${this.bearerToken}`
            },
            body: JSON.stringify({
                subjectType: subjectType,
                dateRange: {
                    dateType: 'PermanentStorage',
                    from: params.dateFrom,
                    to: params.dateTo
                }
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`KSeF Query (${subjectType}) Failed: ${response.status} - ${error}`);
        }

        return await response.json();
    }

    /**
     * Download specific invoice XML by its KSeF number.
     * GET /v2/invoices/ksef/{ksefNumber}
     */
    async downloadInvoice(ksefNumber: string): Promise<string> {
        this.ensureAuthenticated();

        const response = await fetch(`${this.baseUrl}/v2/invoices/ksef/${ksefNumber}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.bearerToken}`,
                'Accept': 'application/xml'
            }
        });

        if (!response.ok) {
            throw new Error(`KSeF Download Failed for ${ksefNumber}: ${response.status}`);
        }

        return await response.text();
    }

    /**
     * Terminate the current session.
     * DELETE /v2/auth/sessions/current
     */
    async terminateSession(): Promise<void> {
        if (!this.bearerToken) return;

        try {
            await fetch(`${this.baseUrl}/v2/auth/sessions/current`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.bearerToken}`
                }
            });
            console.log('[KSeF_CLIENT] Session terminated.');
        } catch (err) {
            console.warn('[KSeF_CLIENT] Failed to terminate session:', err);
        } finally {
            this.bearerToken = null;
        }
    }

    /**
     * Encrypt token for KSeF authentication.
     * Format: "token|timestamp" → RSA-OAEP encrypt → Base64
     * 
     * NOTE: In test environment, this may use a simplified flow.
     * For production, implement proper RSA-OAEP encryption with:
     *   - KSeF's public key (fetched from /v2/auth/public-key)
     *   - OAEP with SHA-256 padding
     */
    private encryptToken(token: string, timestamp: string): string {
        // Simplified: Base64 encode "token|timestamp"
        // TODO PRODUCTION: Replace with actual RSA-OAEP encryption
        const payload = `${token}|${timestamp}`;
        return Buffer.from(payload).toString('base64');
    }

    /**
     * Guard: ensure we have a valid bearer token before making API calls.
     */
    private ensureAuthenticated(): void {
        if (!this.bearerToken) {
            throw new Error('KSeF Client: Not authenticated. Call authenticate() first.');
        }
    }
}
