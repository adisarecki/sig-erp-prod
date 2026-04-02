import prisma from "@/lib/prisma";
import Decimal from "decimal.js";

/**
 * [VECTOR 117] Liquidity Warning System
 * 
 * Triggers LIQUIDITY_ALERT notifications when:
 * 1. Client pays Gross - (Gross * Rate) but invoice expected Net - (Net * Rate)
 * 2. Insufficient cash for VAT debt or retention reserves
 * 3. Cash balance falls below critical safety threshold
 */

export type LiquidityAlertLevel = "WARNING" | "CRITICAL" | "INFO";

export interface LiquidityAlertParams {
  tenantId: string;
  projectId?: string;
  invoiceId?: string;
  level: LiquidityAlertLevel;
  title: string;
  message: string;
  metadata?: {
    expectedAmount?: string | number;
    receivedAmount?: string | number;
    difference?: string | number;
    retentionBase?: "NET" | "GROSS";
    vatDebt?: string | number;
    currentCash?: string | number;
    safeToSpend?: string | number;
    lockedRetention?: string | number;
  };
}

/**
 * Create a liquidity alert notification
 */
export async function createLiquidityAlert(params: LiquidityAlertParams) {
  try {
    // @ts-ignore
    await prisma.notification.create({
      data: {
        tenantId: params.tenantId,
        type: "WARNING",
        title: params.title,
        message: params.message,
        priority: params.level === "CRITICAL" ? "HIGH" : "NORMAL",
        isRead: false,
        metadata: params.metadata || {}
      }
    });

    console.log(
      `[LIQUIDITY_ALERT] ${params.level}: ${params.title} (Tenant: ${params.tenantId})`
    );
  } catch (error) {
    console.error("Failed to create liquidity alert:", error);
  }
}

/**
 * Check for retention-related liquidity issues during payment processing
 */
export async function checkRetentionLiquidity(params: {
  tenantId: string;
  invoiceId: string;
  projectId?: string;
  expectedAmount: Decimal | number;
  receivedAmount: Decimal | number;
  retentionBase: "NET" | "GROSS";
  invoiceNumber?: string;
}) {
  const expected = new Decimal(String(params.expectedAmount));
  const received = new Decimal(String(params.receivedAmount));
  const difference = received.minus(expected);

  // Only alert if underpayment is significant (> 100 PLN or > 5%)
  const percentDiff = expected.gt(0) ? difference.div(expected).mul(100) : new Decimal(0);

  if (difference.lt(0) && (difference.abs().gt(100) || percentDiff.lt(-5))) {
    await createLiquidityAlert({
      tenantId: params.tenantId,
      projectId: params.projectId,
      invoiceId: params.invoiceId,
      level: "WARNING",
      title: `⚠️ Niedoplaciła faktury ${params.invoiceNumber || ""}`,
      message:
        `Klient zapłacił ${received.toString()} PLN, ale oczekiwano ${expected.toString()} PLN. ` +
        `Brakuje ${difference.abs().toString()} PLN. ` +
        `Podstawa naliczania kaucji: ${params.retentionBase === "NET" ? "NETTO" : "BRUTTO"}. ` +
        `Sprawdź czy umowa bądź ustawienia projektu są poprawne.`,
      metadata: {
        expectedAmount: expected.toString(),
        receivedAmount: received.toString(),
        difference: difference.toString(),
        retentionBase: params.retentionBase
      }
    });
  }
}

/**
 * Check overall VAT/Retention debt vs available cash
 */
export async function checkCashVsLiabilities(tenantId: string) {
  try {
    // Get current cash position from LedgerEntry
    const entries = await prisma.ledgerEntry.findMany({
      where: { tenantId }
    });

    const realCashBalance = entries
      .filter((e: any) => e.source === "BANK_PAYMENT" || e.source === "SHADOW_COST")
      .reduce((sum: any, e: any) => sum.plus(new Decimal(String(e.amount))), new Decimal(0));

    const vatBalance = entries
      .filter((e: any) => e.type === "VAT_SHIELD")
      .reduce((sum: any, e: any) => sum.plus(new Decimal(String(e.amount))), new Decimal(0));

    const vaultValue = entries
      .filter((e: any) => e.type === "RETENTION_LOCK")
      .reduce((sum: any, e: any) => sum.plus(new Decimal(String(e.amount))), new Decimal(0));

    const vatDebt = vatBalance.lt(0) ? vatBalance.abs() : new Decimal(0);
    const safeToSpend = realCashBalance.minus(vatDebt).minus(vaultValue);

    // Alert if VAT debt exceeds 50% of cash balance
    if (vatDebt.gt(0) && realCashBalance.gt(0)) {
      const vatRatio = vatDebt.div(realCashBalance);

      if (vatRatio.gt(0.5)) {
        const level = vatRatio.gt(0.8) ? "CRITICAL" : "WARNING";
        await createLiquidityAlert({
          tenantId,
          level,
          title: `${level === "CRITICAL" ? "🚨" : "⚠️"} Wysokie Zadłużenie VAT`,
          message:
            `Zadłużenie VAT wynosi ${vatDebt.toString()} PLN (${vatRatio.mul(100).toFixed(1)}% dostępnych środków). ` +
            `Dostępne do wydania: ${safeToSpend.toString()} PLN.`,
          metadata: {
            vatDebt: vatDebt.toString(),
            currentCash: realCashBalance.toString(),
            safeToSpend: safeToSpend.toString()
          }
        });
      }
    }

    // Alert if retention vault exceeds 30% of cash balance
    if (vaultValue.gt(0) && realCashBalance.gt(0)) {
      const vaultRatio = vaultValue.div(realCashBalance);

      if (vaultRatio.gt(0.3)) {
        await createLiquidityAlert({
          tenantId,
          level: "INFO",
          title: `ℹ️ Wysoka Wartość Kaucji w Skarbcu`,
          message:
            `Zamrożone kaucje wynoszą ${vaultValue.toString()} PLN (${vaultRatio.mul(100).toFixed(1)}% dostępnych środków). ` +
            `To pieniądze, które będą zwrócone po realizacji umowy.`,
          metadata: {
            lockedRetention: vaultValue.toString(),
            currentCash: realCashBalance.toString(),
            safeToSpend: safeToSpend.toString()
          }
        });
      }
    }

    // Critical alert if safe to spend is negative
    if (safeToSpend.lt(0)) {
      await createLiquidityAlert({
        tenantId,
        level: "CRITICAL",
        title: `🚨 KRYZYS PŁYNNOŚCI`,
        message:
          `Dostępne środki wynoszą ${safeToSpend.toString()} PLN (BRAKUJE PIENIĘDZY!). ` +
          `Łączne zadłużenie VAT i kaucje przekraczają przepływy pieniężne. ` +
          `Natychmiast skontaktuj się z doradcą finansowym.`,
        metadata: {
          vatDebt: vatDebt.toString(),
          lockedRetention: vaultValue.toString(),
          currentCash: realCashBalance.toString(),
          safeToSpend: safeToSpend.toString()
        }
      });
    }
  } catch (error) {
    console.error("Failed to check cash vs liabilities:", error);
  }
}

/**
 * Convenience function to run full liquidity check after invoice payment
 */
export async function performLiquidityCheckPost(params: {
  tenantId: string;
  invoiceId: string;
  projectId?: string;
  expectedAmount: Decimal | number;
  receivedAmount: Decimal | number;
  retentionBase: "NET" | "GROSS";
  invoiceNumber?: string;
}) {
  await checkRetentionLiquidity(params);
  // Check overall cash health after 3 seconds (allow ledger to settle)
  setTimeout(() => checkCashVsLiabilities(params.tenantId), 3000);
}
