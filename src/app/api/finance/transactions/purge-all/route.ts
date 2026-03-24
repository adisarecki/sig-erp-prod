import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getCurrentTenantId } from "@/lib/tenant";
import prisma from "@/lib/prisma";

/**
 * EMERGENCY PURGE UTILITY (Phase 11c)
 * Deletes all transactions where projectId is NULL (Bank noise / Management costs).
 * Resets linked invoices to ACTIVE (Unpaid) and clears bankTransactionId.
 */
export async function DELETE(request: NextRequest) {
    try {
        const tenantId = await getCurrentTenantId();
        const adminDb = getAdminDb();

        // 1. Identify transactions to purge (projectId is null)
        const transactionsToPurge = await prisma.transaction.findMany({
            where: {
                tenantId,
                projectId: null
            },
            include: {
                invoicePayments: true
            }
        });

        if (transactionsToPurge.length === 0) {
            return NextResponse.json({ message: "Brak transakcji do wyczyszczenia." });
        }

        const transactionIds = transactionsToPurge.map(t => t.id);
        const invoiceIdsToRevert = Array.from(new Set(
            transactionsToPurge.flatMap(t => t.invoicePayments.map(p => p.invoiceId))
        ));

        // 2. Database Reset (Prisma Transaction)
        await prisma.$transaction(async (tx) => {
            // A. Revert Invoices
            if (invoiceIdsToRevert.length > 0) {
                await tx.invoice.updateMany({
                    where: {
                        id: { in: invoiceIdsToRevert },
                        tenantId
                    },
                    data: {
                        status: "ACTIVE",
                        bankTransactionId: null
                    }
                });
            }

            // B. Delete BankTransactionRaw (all for tenant to be safe)
            await tx.bankTransactionRaw.deleteMany({
                where: { tenantId }
            });

            // C. Delete Transactions (Cascade will handle InvoicePayment)
            await tx.transaction.deleteMany({
                where: {
                    id: { in: transactionIds }
                }
            });
        });

        // 3. Firestore Sync (Clean up mirrored data)
        const batchSize = 500;
        for (let i = 0; i < transactionIds.length; i += batchSize) {
            const chunk = transactionIds.slice(i, i + batchSize);
            const batch = adminDb.batch();
            
            for (const id of chunk) {
                batch.delete(adminDb.collection("transactions").doc(id));
            }
            
            await batch.commit();
        }

        // Also update Invoices in Firestore
        for (let i = 0; i < invoiceIdsToRevert.length; i += batchSize) {
            const chunk = invoiceIdsToRevert.slice(i, i + batchSize);
            const batch = adminDb.batch();
            
            for (const id of chunk) {
                batch.update(adminDb.collection("invoices").doc(id), {
                    status: "ACTIVE",
                    bankTransactionId: null,
                    updatedAt: new Date().toISOString()
                });
            }
            
            await batch.commit();
        }

        return NextResponse.json({ 
            success: true, 
            purgedCount: transactionIds.length,
            revertedInvoicesCount: invoiceIdsToRevert.length
        });

    } catch (error: any) {
        console.error("[PURGE_ERROR]", error);
        return NextResponse.json({ error: error.message || "Błąd podczas czyszczenia bazy." }, { status: 500 });
    }
}
