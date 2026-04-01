import { DataDomain, getDomainAuthority, AuthoritySide } from "./registry";
import { getAdminDb } from "@/lib/firebaseAdmin";
import prisma from "@/lib/prisma";

const isDev = process.env.NODE_ENV === 'development';

/**
 * [VECTOR 109] Domain Authority Guards
 * Enforces that writes only occur on the side with current authority.
 */

/**
 * Asserts that a financial write is targeting the primary authority side.
 * If violated, triggers a hard exception (Dev) or a secure block and log (Prod).
 */
export async function assertAuthorityWrite(
  domain: DataDomain,
  action: string,
  targetSide: AuthoritySide,
  entityId?: string
) {
  const config = getDomainAuthority(domain);

  if (targetSide !== config.primaryAuthority) {
    const errorMessage = `[AUTHORITY_VIOLATION] Domain: ${domain} | Action: ${action} | Target: ${targetSide} | Authority: ${config.primaryAuthority}`;

    // Hard exception in development for rapid loop correction
    if (isDev) {
      throw new Error(errorMessage);
    }

    // Secure block, log, and audit record in production
    console.error(errorMessage, { domain, action, targetSide, entityId });

    if (entityId) {
      try {
        // Track the violation in SQL for later reconciliation
        const db = prisma as any;
        await db.syncAuditRecord.upsert({
          where: { entityType_entityId: { entityType: domain.toLowerCase(), entityId } },
          create: {
            entityType: domain.toLowerCase(),
            entityId,
            syncStatus: 'INVALID_AUTHORITY_WRITE',
            note: errorMessage,
            lastCheckedAt: new Date()
          },
          update: {
            syncStatus: 'INVALID_AUTHORITY_WRITE',
            note: errorMessage,
            lastCheckedAt: new Date()
          }
        });
      } catch (err) {
        console.error("[AUDIT_RECORD_FAILURE]", err);
      }
    }

    // Return the blocking signal or throw also in production if appropriate
    // Logic: financial truth is sacred, better fail the action than commit a false truth.
    throw new Error(`SIG ERP Internal Integrity Error: Action on domain ${domain} blocked due to Data Authority rules (Vector 109).`);
  }
}

/**
 * Shorthand for financial ledger writes.
 * Must ALWAYS target POSTGRES.
 */
export async function assertFinancialMasterWrite(action: string, entityId?: string) {
  return assertAuthorityWrite('FINANCIAL', action, 'POSTGRES', entityId);
}
