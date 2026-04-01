import prisma from "@/lib/prisma"
import { getAdminDb } from "@/lib/firebaseAdmin"
import Decimal from "decimal.js"

/**
 * INTEGRITY MONITOR (Vector 110.3)
 * Detects data drift between Firestore (Mirror) and PostgreSQL (SSoT).
 */
export class IntegrityMonitor {
    /**
     * Compares invoice totals and statuses between PostgreSQL and Firestore.
     */
    static async checkInvoiceIntegrity() {
        const adminDb = getAdminDb();
        const results = {
            totalChecked: 0,
            mismatches: [] as { id: string, type: string, pgValue: any, fsValue: any }[],
            missingInFS: [] as string[],
            missingInPG: [] as string[]
        };

        // 1. Get all recent invoices from PG (SSoT)
        const pgInvoices = await prisma.invoice.findMany({
            take: 100, // Limit to recent for performance
            orderBy: { createdAt: 'desc' }
        });

        for (const pgInv of pgInvoices) {
            results.totalChecked++;
            const fsDoc = await adminDb.collection("invoices").doc(pgInv.id).get();

            if (!fsDoc.exists) {
                results.missingInFS.push(pgInv.id);
                continue;
            }

            const fsData = fsDoc.data()!;
            
            // Checks
            if (new Decimal(pgInv.amountGross).toNumber() !== Number(fsData.amountGross)) {
                results.mismatches.push({
                    id: pgInv.id,
                    type: 'GROSS_AMOUNT',
                    pgValue: pgInv.amountGross,
                    fsValue: fsData.amountGross
                });
            }

            if (pgInv.status !== fsData.status) {
                results.mismatches.push({
                    id: pgInv.id,
                    type: 'STATUS',
                    pgValue: pgInv.status,
                    fsValue: fsData.status
                });
            }
        }

        return results;
    }

    /**
     * Verifies that all Ledger records have corresponding Transactions (where applicable).
     */
    static async checkLedgerConsistency() {
        // Implementation for future deep-audit
        // Check if Sum(LedgerEntries) == Σ(Transactions) for Bank sources
    }
}
