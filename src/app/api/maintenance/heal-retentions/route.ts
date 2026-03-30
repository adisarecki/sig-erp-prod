import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminDb } from "@/lib/firebaseAdmin";
import Decimal from "decimal.js";

export async function GET() {
    try {
        const adminDb = getAdminDb();
        
        // 1. Znajdź wszystkie faktury z kaucją
        const invoices = await prisma.invoice.findMany({
            where: {
                retainedAmount: { gt: 0 },
                retentionReleaseDate: { not: null }
            }
        });

        console.log(`[HEALER] Found ${invoices.length} invoices with retentions.`);
        let createdCount = 0;
        let skippedCount = 0;

        for (const inv of invoices) {
            // Sprawdź czy kaucja już istnieje dla tej faktury
            const existingRetention = await (prisma as any).retention.findFirst({
                where: { invoiceId: inv.id }
            });

            if (existingRetention) {
                skippedCount++;
                continue;
            }

            // Stwórz wpis w Firestore i Prisma
            const retentionRef = adminDb.collection("retentions").doc();
            const retentionData = {
                tenantId: inv.tenantId,
                projectId: inv.projectId || null,
                contractorId: inv.contractorId,
                invoiceId: inv.id,
                amount: Number(inv.retainedAmount),
                type: "SHORT_TERM",
                expiryDate: inv.retentionReleaseDate?.toISOString(),
                source: "INVOICE",
                description: `Kaucja z faktury (Healer): ${inv.invoiceNumber || inv.externalId || inv.id}`,
                status: "ACTIVE",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            await retentionRef.set(retentionData);

            await (prisma as any).retention.create({
                data: {
                    id: retentionRef.id,
                    tenant: { connect: { id: inv.tenantId } },
                    project: inv.projectId ? { connect: { id: inv.projectId } } : undefined,
                    contractor: { connect: { id: inv.contractorId } },
                    // @ts-ignore
                    invoice: { connect: { id: inv.id } },
                    amount: inv.retainedAmount,
                    type: "SHORT_TERM",
                    expiryDate: inv.retentionReleaseDate!,
                    source: "INVOICE",
                    description: `Kaucja z faktury (Healer): ${inv.invoiceNumber || inv.externalId || inv.id}`,
                    status: "ACTIVE"
                }
            });

            createdCount++;
        }

        return NextResponse.json({
            success: true,
            message: `Healer finished. Created: ${createdCount}, Skipped: ${skippedCount}`,
            scannedInvoices: invoices.length
        });
    } catch (error: any) {
        console.error("[HEALER_ERROR]", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
