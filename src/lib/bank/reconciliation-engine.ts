import prisma from "@/lib/prisma";
import Decimal from "decimal.js";
import { normalizeText, calculateSimilarity } from "../reconciliation";
import { performLiquidityCheckPost } from "../finance/liquidity-alerts";

export class ReconciliationEngine {
    /**
     * Main entry point for processing the BankInbox.
     * Implements Master Stabilization Protocol (Vectors 104, 105).
     */
    static async processBankStaging(tenantId: string) {
        // @ts-ignore
        const inboxItems = await prisma.bankStaging.findMany({
            where: { tenantId, status: 'PENDING' }
        });

        const unpaidInvoices = await prisma.invoice.findMany({
            // @ts-ignore
            where: { 
                tenantId, 
                status: 'ACTIVE', 
                OR: [
                    { paymentStatus: 'UNPAID' },
                    { 
                        paymentStatus: 'PAID',
                        reconciliationStatus: 'PENDING'
                    }
                ]
            },
            include: { 
                contractor: true,
                project: {
                    select: {
                        id: true,
                        retentionShortTermRate: true,
                        retentionLongTermRate: true,
                        retentionBase: true
                    }
                }
            }
        });

        // VECTOR 104: Specyficzny Regex dla Col 8
        const invoiceRegex = /(?:FV|FA|FAKTURA|RACH)\s?([\w\d\/]+)/i;

        for (const item of inboxItems) {
            let bestSuggestion = null;
            let bestConfidence = 0;

            const title = item.title || "";
            const match = title.match(invoiceRegex);
            let extractedInvoiceNumber = match ? match[1].trim() : null;

            for (const inv of unpaidInvoices as any[]) {
                const netAmount = new Decimal(String(inv.amountNet));
                const grossAmount = new Decimal(String(inv.amountGross));
                const transAmount = new Decimal(String(item.amount)).abs();

                // Vector 117/120: Calculate expected amount with retention
                let expectedAmount = grossAmount;
                if (inv.project) {
                    const shortRate = new Decimal(String(inv.project.retentionShortTermRate || 0));
                    const longRate = new Decimal(String(inv.project.retentionLongTermRate || 0));
                    const totalRate = shortRate.plus(longRate);

                    if (totalRate.gt(0)) {
                        const base = inv.project.retentionBase || 'GROSS';
                        if (base === 'NET') {
                            const retentionAmount = netAmount.mul(totalRate);
                            expectedAmount = grossAmount.minus(retentionAmount);
                        } else {
                            expectedAmount = grossAmount.mul(new Decimal(1).minus(totalRate));
                        }
                    }
                }

                // Check amounts
                const tolerance = new Decimal('0.01');
                const isAmountMatch = transAmount.minus(grossAmount).abs().lte(tolerance);
                const isRetentionMatch = transAmount.minus(expectedAmount).abs().lte(tolerance);

                let confidence = 0;

                // Level 1: Invoice Number matches perfectly
                if (extractedInvoiceNumber && (inv.invoiceNumber === extractedInvoiceNumber || (inv.invoiceNumber && extractedInvoiceNumber.length > 3 && inv.invoiceNumber.includes(extractedInvoiceNumber)))) {
                    confidence += 50;
                }

                // Level 2: Amount Match
                if (isAmountMatch) confidence += 30;
                if (isRetentionMatch && expectedAmount.lt(grossAmount)) confidence += 40; // High confidence for retention match!

                // Level 3: Counterparty Name Match
                const similarity = calculateSimilarity(inv.contractor.name, item.counterpartyName);
                if (similarity > 0.8) {
                    confidence += 20;
                }

                if (confidence > bestConfidence) {
                    bestConfidence = confidence;
                    bestSuggestion = inv.id;
                }
            }

            if (bestSuggestion && bestConfidence >= 40) {
                // @ts-ignore
                await prisma.bankStaging.update({
                    where: { id: item.id },
                    data: {
                        status: 'SUGGESTED',
                        suggestionId: bestSuggestion,
                        matchConfidence: bestConfidence > 100 ? 100 : bestConfidence
                    }
                });
            } else if (this.isShadowCost(item.counterpartyName, item.title || "")) {
                // We keep it PENDING, but UI will label it as a Shadow Cost
                await prisma.bankStaging.update({
                    where: { id: item.id },
                    data: {
                        status: 'PENDING',
                        matchConfidence: 0.1 // Small flag for UI to prioritize it for on-the-fly create
                    }
                });
            }
        }
    }

    private static isShadowCost(name: string, title: string): boolean {
        const normalized = normalizeText(name + " " + title);
        return normalized.includes("zus") || 
               normalized.includes("urzad skarbowy") || 
               normalized.includes("zabka") || 
               normalized.includes("tax") ||
               normalized.includes("podatek");
    }

    /**
     * VECTOR 105: Auto-classify Shadow Costs as DirectExpense.
     * Direct expense auto-creation is disabled in Vector 120.
     * It's handled manually via "On-The-Fly Create" in BankReconciliationHub
     */

    /**
     * Executes automatic reconciliation (Auto-Match).
     * Updates Invoice status and creates ledger entries.
     * 
     * [VECTOR 117] Retention-Aware Auto-Match
     * Calculates expected payment amount based on retentionBase (NET or GROSS)
     * and automatically creates RETENTION_LOCK entries when retention applies.
     */
    static async executeAutoMatch(inboxItem: any, invoiceId: string) {
        const result = await prisma.$transaction(async (tx) => {
            const invoice = await tx.invoice.findUnique({
                where: { id: invoiceId },
                include: { 
                    contractor: true,
                    project: {
                        select: {
                            id: true,
                            retentionShortTermRate: true,
                            retentionLongTermRate: true,
                            retentionBase: true
                        }
                    }
                }
            });

            if (!invoice) return null;

            const paidAmount = new Decimal(String(inboxItem.amount)).abs();
            const netAmount = new Decimal(String(invoice.amountNet));
            const grossAmount = new Decimal(String(invoice.amountGross));

            // --- VECTOR 117: Calculate Expected Payment Amount ---
            let expectedAmount = grossAmount; // Default (full payment, no retention)
            let retentionAmount = new Decimal(0);
            let retentionSettled = false;

            if (invoice.project) {
                const shortRate = new Decimal(String(invoice.project.retentionShortTermRate || 0));
                const longRate = new Decimal(String(invoice.project.retentionLongTermRate || 0));
                const totalRate = shortRate.plus(longRate);

                if (totalRate.gt(0)) {
                    const base = invoice.project.retentionBase || 'GROSS';

                    if (base === 'NET') {
                        // Formula: Expected = Brutto - (Net * Rate)
                        retentionAmount = netAmount.mul(totalRate);
                        expectedAmount = grossAmount.minus(retentionAmount);
                    } else {
                        // Formula: Expected = Brutto * (1 - Rate)
                        expectedAmount = grossAmount.mul(new Decimal(1).minus(totalRate));
                        retentionAmount = grossAmount.mul(totalRate);
                    }

                    // Check if payment matches expected amount (within tolerance of 1 cent)
                    const tolerance = new Decimal('0.01');
                    retentionSettled = paidAmount.minus(expectedAmount).abs().lte(tolerance);
                }
            }

            // 1. Update Invoice Status (based on retention logic)
            let newStatus = "PARTIALLY_PAID";
            let newPaymentStatus = "PARTIALLY_PAID";

            if (retentionSettled && retentionAmount.gt(0)) {
                newStatus = "PAID"; // Payment matched expected (with retention)
                newPaymentStatus = "PAID";
            } else if (paidAmount.gte(grossAmount)) {
                newStatus = "PAID"; // Full payment or overpayment
                newPaymentStatus = "PAID";
            }

            // @ts-ignore
            await tx.invoice.update({
                where: { id: invoice.id },
                data: {
                    status: newStatus,
                    paymentStatus: newPaymentStatus,
                    reconciliationStatus: 'MATCHED'
                }
            });

            // --- VECTOR 118: Replace Manual/Shadow Costs ---
            // If this invoice was manually marked as PAID, it likely has a SHADOW_COST entry.
            // We delete it because the BANK_PAYMENT created below is the new "Truth".
            await tx.ledgerEntry.deleteMany({
                where: {
                    tenantId: invoice.tenantId,
                    source: 'SHADOW_COST',
                    sourceId: invoice.id
                }
            });

            // 2. Create Transaction
            const transaction = await tx.transaction.create({
                data: {
                    tenantId: invoice.tenantId,
                    projectId: invoice.projectId,
                    amount: inboxItem.amount,
                    type: invoice.type === "SPRZEDAŻ" ? "INCOME" : "EXPENSE",
                    transactionDate: inboxItem.date,
                    category: invoice.type === "SPRZEDAŻ" ? "SPRZEDAŻ" : "ZAKUP",
                    description: `Automatyczne rozliczenie (Vector 117 - Retention-Aware): ${inboxItem.title || 'Wyciąg bankowy'}`,
                    source: "BANK_IMPORT",
                    status: "ACTIVE",
                    matchedContractorId: invoice.contractorId,
                    title: inboxItem.title,
                    classification: "PROJECT_COST"
                }
            });

            // 3. Link via InvoicePayment (Ledger)
            await tx.invoicePayment.create({
                data: {
                    invoiceId: invoice.id,
                    transactionId: transaction.id,
                    amountApplied: paidAmount
                }
            });

            // --- VECTOR 107: Central Ledger Entry (Compensating Cash Entry) ---
            // @ts-ignore
            await tx.ledgerEntry.create({
                data: {
                    tenantId: invoice.tenantId,
                    projectId: invoice.projectId,
                    source: "BANK_PAYMENT",
                    sourceId: transaction.id,
                    amount: inboxItem.amount, // Positive for INCOME, Negative for EXPENSE
                    type: invoice.type === "SPRZEDAŻ" ? "INCOME" : "EXPENSE",
                    date: inboxItem.date
                }
            });

            // --- VECTOR 117: Automatic Retention Settlement ---
            // If payment matches expected amount and retention applies, lock it in The Vault
            if (retentionSettled && retentionAmount.gt(0)) {
                // Create RETENTION_LOCK ledger entry (The Vault)
                // @ts-ignore
                await tx.ledgerEntry.create({
                    data: {
                        tenantId: invoice.tenantId,
                        projectId: invoice.projectId,
                        source: "INVOICE",
                        sourceId: invoice.id,
                        amount: retentionAmount,
                        type: "RETENTION_LOCK",
                        date: inboxItem.date
                    }
                });

                // Optionally, create or update a Retention record for tracking
                await tx.retention.create({
                    data: {
                        tenantId: invoice.tenantId,
                        projectId: invoice.projectId,
                        contractorId: invoice.contractorId,
                        invoiceId: invoice.id,
                        amount: retentionAmount,
                        type: invoice.project?.retentionShortTermRate ? "SHORT_TERM" : "LONG_TERM",
                        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year default
                        source: "PROJECT",
                        status: "ACTIVE",
                        description: `Automatyczne naliczenie kaucji (Vector 117) dla FV ${invoice.invoiceNumber}`
                    }
                });
            }

            // 4. Mark Staging Item as PROCESSED
            // @ts-ignore
            await tx.bankStaging.update({
                where: { id: inboxItem.id },
                data: {
                    status: 'PROCESSED',
                    processedAt: new Date()
                }
            });

            return {
                invoiceId: invoice.id,
                tenantId: invoice.tenantId,
                projectId: invoice.projectId || undefined,
                invoiceNumber: invoice.invoiceNumber || undefined,
                expectedAmount,
                paidAmount,
                retentionBase: invoice.project?.retentionBase || 'GROSS'
            };
        });

        // --- VECTOR 117: Post-Match Liquidity Check ---
        // Run outside transaction to avoid deadlocks
        if (result) {
            performLiquidityCheckPost({
                tenantId: result.tenantId,
                invoiceId: result.invoiceId,
                projectId: result.projectId,
                expectedAmount: result.expectedAmount,
                receivedAmount: result.paidAmount,
                retentionBase: result.retentionBase,
                invoiceNumber: result.invoiceNumber || "STN"
            }).catch(err => console.error("[LIQUIDITY_CHECK] Error:", err));
        }

        return result;
    }

    /**
     * VECTOR 106: The "Truth" Engine.
     * Compares system ledger sum with the physical bank balance anchor.
     */
    static async verifyIntegrity(tenantId: string, physicalBalance: Decimal) {
        const transactions = await prisma.transaction.findMany({
            where: { tenantId, status: 'ACTIVE' }
        });

        const ledgerSum = transactions.reduce((sum, tx) => {
            const amount = new Decimal(String(tx.amount));
            return tx.type === 'INCOME' ? sum.plus(amount) : sum.minus(amount.abs());
        }, new Decimal(0));

        const delta = ledgerSum.minus(physicalBalance).abs();
        const status = delta.isZero() ? 'VERIFIED_STABLE' : 'DISCREPANCY_ALERT';

        // Update the Anchor
        try {
            // @ts-ignore
            await prisma.bankBalanceState.create({
                data: {
                    tenantId,
                    verifiedBalance: physicalBalance,
                    source: "PKO_BP_CSV",
                    verificationTimestamp: new Date()
                }
            });
        } catch (err) {
            console.error("CRITICAL: Failed to update BankBalanceState anchor. Tables might be missing.", err);
        }

        return {
            ledgerSum,
            physicalBalance,
            delta,
            status
        };
    }
}
