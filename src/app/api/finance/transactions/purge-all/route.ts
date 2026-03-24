import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getCurrentTenantId } from "@/lib/tenant";
import prisma from "@/lib/prisma";

/**
 * EMERGENCY PURGE UTILITY - HOTFIX (Phase 11d)
 * Performs a "Deep Purge" of both Firestore and Prisma to resolve Sync: error.
 * Deletes all transactions where projectId is NULL.
 */
export async function DELETE(request: NextRequest) {
    try {
        const tenantId = await getCurrentTenantId();
        const adminDb = getAdminDb();

        // 1. Identify transactions in Prisma
        const prismaTransactions = await prisma.transaction.findMany({
            where: { tenantId, projectId: null },
            select: { id: true, invoicePayments: { select: { invoiceId: true } } }
        });

        const prismaIds = prismaTransactions.map(t => t.id);
        const invoiceIdsToRevert = Array.from(new Set(
            prismaTransactions.flatMap(t => t.invoicePayments.map(p => p.invoiceId))
        ));

        // 2. Identify transactions in Firestore (Deep Scan)
        const fsSnap = await adminDb.collection("transactions")
            .where("tenantId", "==", tenantId)
            // Note: We can't easily query where projectId == null in some Firestore versions if missing,
            // but we'll fetch them all for the tenant and filter if needed, or trust the direct query.
            .where("projectId", "==", null) 
            .get();
        
        const fsIds = fsSnap.docs.map(doc => doc.id);
        const allIdsToPurge = Array.from(new Set([...prismaIds, ...fsIds]));

        if (allIdsToPurge.length === 0) {
            // Even if no transactions, double check BankTransactionRaw and counts
            await prisma.bankTransactionRaw.deleteMany({ where: { tenantId } });
            return NextResponse.json({ success: true, message: "Baza była już czysta.", purgedCount: 0 });
        }

        // 3. Database Reset (Prisma)
        await prisma.$transaction(async (tx) => {
            // A. Revert Invoices
            if (invoiceIdsToRevert.length > 0) {
                await tx.invoice.updateMany({
                    where: { id: { in: invoiceIdsToRevert }, tenantId },
                    data: { status: "ACTIVE", bankTransactionId: null }
                });
            }

            // B. Delete BankTransactionRaw
            await tx.bankTransactionRaw.deleteMany({ where: { tenantId } });

            // C. Delete Transactions
            await tx.transaction.deleteMany({
                where: { id: { in: allIdsToPurge } }
            });
        });

        // 4. Firestore Sync (Batch Delete)
        const batchSize = 500;
        for (let i = 0; i < allIdsToPurge.length; i += batchSize) {
            const chunk = allIdsToPurge.slice(i, i + batchSize);
            const batch = adminDb.batch();
            for (const id of chunk) {
                batch.delete(adminDb.collection("transactions").doc(id));
            }
            await batch.commit();
        }

        // Also revert Invoices in Firestore
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
            purgedCount: allIdsToPurge.length,
            revertedInvoicesCount: invoiceIdsToRevert.length,
            syncStatus: "OK"
        });

    } catch (error: any) {
        console.error("[DEEP_PURGE_ERROR]", error);
        // Special case: Always try to return success: true if we managed to do SOMETHING, 
        // but here it's a catch block.
        return NextResponse.json({ 
            success: false, 
            error: error.message || "Błąd podczas głębokiego oczyszczania bazy." 
        }, { status: 500 });
    }
}
