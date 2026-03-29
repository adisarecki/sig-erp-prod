/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient, Tenant } from '@prisma/client';
import { KSeFService } from './ksefService';

const prisma = new PrismaClient();

// Extracted from schema.prisma (to bypass stale Prisma Client types in IDE)
interface TenantWithKsef extends Tenant {
    ksefAccessToken: string | null;
    ksefRefreshToken: string | null;
    ksefTokenExpiresAt: Date | null;
}

export class KsefSessionManager {
    /**
     * Decode JWT without external libraries to check exp
     */
    private decodeJwt(token: string) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8')) as unknown as { exp?: number };
            return payload;
        } catch (e: unknown) {
            return null;
        }
    }

    /**
     * Check if token is still valid (with 5-minute buffer)
     */
    private isTokenValid(token: string | null): boolean {
        if (!token) return false;
        const decoded = this.decodeJwt(token);
        if (!decoded || !decoded.exp) return false;

        const now = Math.floor(Date.now() / 1000);
        return (decoded.exp ?? 0) > (now + 300); // 5 mins buffer
    }

    /**
     * Ensure a valid Access Token for a given Tenant
     */
    async ensureAccessToken(tenantId: string): Promise<string> {
        const tenantRaw = await prisma.tenant.findUnique({
            where: { id: tenantId }
        });

        if (!tenantRaw) throw new Error(`Tenant ${tenantId} not found`);
        const tenant = tenantRaw as TenantWithKsef;

        // 1. Check if current Access Token is valid
        if (this.isTokenValid(tenant.ksefAccessToken as string | null)) {
            console.log(`[KSeF_MANAGER] Using existing Access Token for Tenant: ${tenant.name}`);
            return tenant.ksefAccessToken as string;
        }

        // 2. Try Refreshing if Refresh Token exists
        if (tenant.ksefRefreshToken) {
            console.log(`[KSeF_MANAGER] Access Token expired. Attempting Refresh for: ${tenant.name}...`);
            try {
                const newTokens = await this.refreshKSeFToken(tenant.ksefRefreshToken as string);
                await prisma.tenant.update({
                    where: { id: tenantId },
                    data: {
                        ksefAccessToken: newTokens.accessToken,
                        ksefRefreshToken: newTokens.refreshToken,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ksefTokenExpiresAt: new Date(this.decodeJwt(newTokens.accessToken)!.exp! * 1000)
                    } as any
                });
                return newTokens.accessToken;
        } catch (err: unknown) {
            console.warn(`[KSeF_MANAGER] Refresh failed, falling back to full handshake. Error:`, err);
        }
        }

        // 3. Fallback to Full Handshake (Sztafeta V2.1)
        console.log(`[KSeF_MANAGER] Initiating full handshake for: ${tenant.name}...`);
        const ksefSvc = new KSeFService();

        // Full handshake returns both tokens in KSeF v2.1 (Redeem step)
        // Note: I'll need to update KSeFService.getAccessToken to return the full redeem data or update it separately.
        // For now, I'll use a specialized method or refactor.
        const authData = await ksefSvc.performFullHandshake(tenant.nip!, tenant.ksefToken!);

        await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                ksefAccessToken: authData.accessToken,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ksefTokenExpiresAt: new Date(this.decodeJwt(authData.accessToken)!.exp! * 1000)
            } as any
        });

        return authData.accessToken;
    }

    /**
     * KSeF Refresh Strategy: POST /v2/auth/token/refresh
     */
    private async refreshKSeFToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
        const KSEF_BASE_URL = (process.env.KSEF_BASE_URL || 'https://api.ksef.mf.gov.pl/api').replace(/\/$/, '');

        const res = await fetch(`${KSEF_BASE_URL}/v2/auth/token/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${refreshToken}`
            },
            body: JSON.stringify({}),
            signal: AbortSignal.timeout(25000)
        });

        const text = await res.text();
        if (!res.ok) throw new Error(`KSeF Refresh Failed (${res.status}): ${text}`);

        const data = JSON.parse(text) as unknown as { accessToken?: { token: string }; refreshToken?: { token: string } };
        const accessToken = data.accessToken?.token;
        const newRefreshToken = data.refreshToken?.token;

        if (!accessToken) throw new Error('No accessToken found in refresh response');
        
        return {
            accessToken,
            refreshToken: newRefreshToken || refreshToken // Fallback to original if not rotated
        };
    }
}