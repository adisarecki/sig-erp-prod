import prisma from "@/lib/prisma";
import Decimal from "decimal.js";
import { normalizeText, calculateSimilarity } from "../reconciliation";

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
            if (this.isShadowCost(item.counterpartyName, item.title)) {
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
        await prisma.transaction.create({
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
     */
    static async executeAutoMatch(inboxItem: any, invoiceId: string) {
        return await prisma.$transaction(async (tx) => {
            const invoice = await tx.invoice.findUnique({
                where: { id: invoiceId },
                include: { contractor: true }
            });

            if (!invoice) return;

            const paidAmount = new Decimal(String(inboxItem.amount)).abs();
            const grossAmount = new Decimal(String(invoice.amountGross));

            // 1. Update Invoice Status
            const newStatus = paidAmount.gte(grossAmount) ? "PAID" : "PARTIALLY_PAID";
            await tx.invoice.update({
                where: { id: invoice.id },
                data: {
                    status: newStatus,
                    paymentStatus: paidAmount.gte(grossAmount) ? "PAID" : "PARTIALLY_PAID"
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
                    description: `Automatyczne rozliczenie (Vector 104): ${inboxItem.title || 'Wyciąg bankowy'}`,
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

            // 4. Mark Inbox Item as PROCESSED
            // @ts-ignore
            await tx.bankInbox.update({
                where: { id: inboxItem.id },
                data: {
                    status: 'PROCESSED',
                    processedAt: new Date()
                }
            });
        });
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
        // @ts-ignore
        await prisma.bankBalanceState.create({
            data: {
                tenantId,
                verifiedBalance: physicalBalance,
                source: "PKO_BP_CSV",
                verificationTimestamp: new Date()
            }
        });

        return {
            ledgerSum,
            physicalBalance,
            delta,
            status
        };
    }
}
