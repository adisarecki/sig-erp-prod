import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminDb } from "@/lib/firebaseAdmin";

/**
 * API do czyszczenia duplikatów (Vector 098: Duplicate Shield)
 * Identyfikuje faktury z tym samym ksefId, zostawia najstarszą,
 * usuwa pozostałe wraz z powiązanymi transakcjami.
 */
export async function GET() {
    try {
        const adminDb = getAdminDb();
        
        // 1. Znajdź wszystkie ksefId, które występują więcej niż raz
        const duplicates = await prisma.$queryRaw<Array<{ ksefId: string, count: bigint }>>`
            SELECT "ksefId", COUNT(*) as count
            FROM "Invoice"
            WHERE "ksefId" IS NOT NULL
            GROUP BY "ksefId"
            HAVING COUNT(*) > 1
        `;

        console.log(`[HEALER] Found ${duplicates.length} ksefId groups with duplicates.`);
        
        let totalInvoicesRemoved = 0;
        let totalTransactionsRemoved = 0;
        const details = [];

        for (const group of duplicates) {
            const ksefId = group.ksefId;
            
            // Pobierz wszystkie faktury dla tego ksefId, posortowane po dacie utworzenia
            const invoices = await (prisma as any).invoice.findMany({
                where: { ksefId },
                orderBy: { createdAt: 'asc' },
                include: {
                    payments: {
                        include: {
                            transaction: true
                        }
                    }
                }
            });

            if (invoices.length <= 1) continue;

            const [keepInvoice, ...discardInvoices] = invoices;
            
            console.log(`[HEALER] Processing ksefId: ${ksefId}. Keeping: ${keepInvoice.id}. Discarding: ${discardInvoices.length} records.`);

            for (const discard of discardInvoices) {
                // 1. Znajdź transakcje powiązane z tą fakturą przez InvoicePayment
                const paymentRecords = await prisma.invoicePayment.findMany({
                    where: { invoiceId: discard.id },
                    select: { transactionId: true }
                });

                const transactionIds = paymentRecords.map(p => p.transactionId);

                // 2. Usuń transakcje z Prisma (onDelete: Cascade w InvoicePayment zadba o relacje pośrednie w SQL, 
                // ale tu usuwamy transakcje jawnie zgodnie z polityką Wizjonera)
                if (transactionIds.length > 0) {
                    // Usuwamy z Firestore (jeśli istnieją)
                    for (const tId of transactionIds) {
                        await adminDb.collection("transactions").doc(tId).delete();
                        totalTransactionsRemoved++;
                    }

                    // Usuwamy z Prisma (InvoicePayment zostanie usunięte automatycznie przez onDelete: Cascade)
                    await prisma.transaction.deleteMany({
                        where: { id: { in: transactionIds } }
                    });
                }

                // 3. Usuń fakturę z Firestore
                await adminDb.collection("invoices").doc(discard.id).delete();

                // 4. Usuń fakturę z Prisma
                await prisma.invoice.delete({
                    where: { id: discard.id }
                });

                totalInvoicesRemoved++;
            }

            details.push({
                ksefId,
                keepId: keepInvoice.id,
                removedCount: discardInvoices.length
            });
        }

        return NextResponse.json({
            success: true,
            summary: {
                duplicateGroups: duplicates.length,
                totalInvoicesRemoved,
                totalTransactionsRemoved
            },
            details
        });

    } catch (error: any) {
        console.error("[HEALER_PURGE_ERROR]", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
