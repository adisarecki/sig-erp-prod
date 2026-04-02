import prisma from "@/lib/prisma";
import Decimal from "decimal.js";
import { normalizeText, calculateSimilarity } from "../reconciliation";
import { performLiquidityCheckPost } from "../finance/liquidity-alerts";

export class ReconciliationEngine {
    /**
     * Main entry point for processing the BankInbox.
     * Implements Master Stabilization Protocol (Vectors 104, 105).
     */
    static async processBankInbox(tenantId: string) {
        // @ts-ignore
        const inboxItems = await prisma.bankInbox.findMany({
            where: { tenantId, status: 'NEW' }
        });

        const unpaidInvoices = await prisma.invoice.findMany({
            where: { 
                tenantId, 
                status: 'ACTIVE', 
                paymentStatus: 'UNPAID' 
            },
            include: { contractor: true }
        });

        // VECTOR 104: Specyficzny Regex dla Col 8
        const invoiceRegex = /(?:FV|FA|FAKTURA|RACH)\s?([\w\d\/]+)/i;

        for (const item of inboxItems) {
            // VECTOR 105: SHADOW COSTS (Direct debits)
            if (this.isShadowCost(item.counterpartyName, item.title || "")) {
                await this.processDirectExpense(item);
                continue;
            }

            let matched = false;

            // --- Level 1: Invoice Number Extraction (High Confidence) ---
            const title = item.title || "";
            const match = title.match(invoiceRegex);
            if (match) {
                const extractedInvoiceNumber = match[1].trim();
                const invoice = unpaidInvoices.find(inv => 
                    inv.invoiceNumber === extractedInvoiceNumber || 
                    (inv.invoiceNumber && extractedInvoiceNumber.length > 3 && inv.invoiceNumber.includes(extractedInvoiceNumber))
                );

                if (invoice) {
                    await this.executeAutoMatch(item, invoice.id);
                    matched = true;
                }
            }

            if (matched) continue;

            // --- Level 2: Fuzzy Counterparty & Amount (Medium Confidence) ---
            let bestSuggestion = null;
            let bestConfidence = 0;

            for (const inv of unpaidInvoices) {
                const invoiceAmount = new Decimal(String(inv.amountGross));
                const transAmount = new Decimal(String(item.amount)).abs();
                
                if (invoiceAmount.equals(transAmount)) {
                    const similarity = calculateSimilarity(inv.contractor.name, item.counterpartyName);
                    
                    if (similarity > 0.8) {
                        if (similarity > bestConfidence) {
                            bestConfidence = similarity;
                            bestSuggestion = inv.id;
                        }
                    }
                }
            }

            if (bestSuggestion) {
                // @ts-ignore
                await prisma.bankInbox.update({
                    where: { id: item.id },
                    data: {
                        status: 'SUGGESTED',
                        suggestionId: bestSuggestion,
                        matchConfidence: bestConfidence
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
     */
    private static async processDirectExpense(inboxItem: any) {
        const transaction = await prisma.transaction.create({
            data: {
                tenantId: inboxItem.tenantId,
                amount: inboxItem.amount,
                type: "EXPENSE",
                transactionDate: inboxItem.date,
                category: "KOSZTY_OPERACYJNE",
                description: `${inboxItem.counterpartyName}: ${inboxItem.title}`,
                source: "BANK_IMPORT",
                status: "ACTIVE",
                classification: "DirectExpense" // Vector 105 Protocol
            }
        });

        // --- VECTOR 107: Central Ledger Entry (SSoT) ---
        // @ts-ignore
        await prisma.ledgerEntry.create({
            data: {
                tenantId: inboxItem.tenantId,
                projectId: null, // Direct Expenses are usually General
                source: "SHADOW_COST",
                sourceId: transaction.id,
                amount: inboxItem.amount, // Negative if it's an expense
                type: "EXPENSE",
                date: inboxItem.date
            }
        });

        // @ts-ignore
        await prisma.bankInbox.update({
            where: { id: inboxItem.id },
            data: {
                status: 'PROCESSED',
                processedAt: new Date()
            }
        });
    }

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

            await tx.invoice.update({
                where: { id: invoice.id },
                data: {
                    status: newStatus,
                    paymentStatus: newPaymentStatus
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

            // 4. Mark Inbox Item as PROCESSED
            // @ts-ignore
            await tx.bankInbox.update({
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
