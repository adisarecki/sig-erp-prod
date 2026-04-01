"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
const db = prisma as any;
import { getAdminDb } from "@/lib/firebaseAdmin"
import { syncAssetToFirestore, SyncAssetData } from "@/lib/finance/sync-utils"
import { checkAssetConsistency } from "@/lib/sync/consistency-engine"
import Decimal from "decimal.js"

/**
 * [VECTOR 108] Manual Sync: PostgreSQL -> Firestore
 * Use when SQL is the source of truth.
 */
export async function syncPgToFs(assetId: string) {
    try {
        const pgAsset = await db.asset.findUnique({
            where: { id: assetId }
        });

        if (!pgAsset) throw new Error("Asset not found in PostgreSQL.");

        // Convert Prisma model to SyncAssetData interface
        const syncData: SyncAssetData = {
            ...pgAsset,
            id: pgAsset.id,
            sourceType: pgAsset.sourceType as any,
            category: pgAsset.category as any,
            status: pgAsset.status as any,
            purchaseNet: pgAsset.purchaseNet,
            purchaseGross: pgAsset.purchaseGross,
            vatAmount: pgAsset.vatAmount,
            initialValue: pgAsset.initialValue,
            currentValue: pgAsset.currentValue,
            depreciationRate: pgAsset.depreciationRate,
            monthlyDepreciation: pgAsset.monthlyDepreciation
        };

        await syncAssetToFirestore(syncData);

        // Update Audit
        await db.syncAuditRecord.update({
            where: { entityType_entityId: { entityType: 'asset', entityId: assetId } },
            data: {
                lastSyncedAt: new Date(),
                lastSyncDirection: 'PG_TO_FS'
            }
        });

        await checkAssetConsistency(assetId);
        revalidatePath("/finance/sync-health");
        revalidatePath(`/assets/${assetId}`);

        return { success: true };
    } catch (error: any) {
        console.error("[SYNC_PG_TO_FS_ERROR]", error);
        return { success: false, error: error.message };
    }
}

/**
 * [VECTOR 108] Manual Sync: Firestore -> PostgreSQL
 * Use when Firestore (Primary) is the source of truth.
 */
export async function syncFsToPg(assetId: string) {
    try {
        const adminDb = getAdminDb();
        const doc = await adminDb.collection("assets").doc(assetId).get();
        if (!doc.exists) throw new Error("Asset not found in Firestore.");
        
        const fsData = doc.data()!;

        // Update PostgreSQL
        await db.asset.upsert({
            where: { id: assetId },
            create: {
                id: assetId,
                tenantId: fsData.tenantId,
                name: fsData.name,
                category: fsData.category,
                status: fsData.status,
                sourceType: fsData.sourceType,
                purchaseDate: new Date(fsData.purchaseDate),
                purchaseNet: new Decimal(fsData.purchaseNet),
                purchaseGross: new Decimal(fsData.purchaseGross),
                vatAmount: new Decimal(fsData.vatAmount),
                initialValue: new Decimal(fsData.initialValue),
                currentValue: new Decimal(fsData.currentValue),
                createdAt: new Date(fsData.createdAt),
                updatedAt: new Date(),
                // ... map other fields accordingly
                registrationNumber: fsData.registrationNumber,
                vin: fsData.vin,
                location: fsData.location,
                assignedTo: fsData.assignedTo
            },
            update: {
                name: fsData.name,
                category: fsData.category,
                status: fsData.status,
                purchaseNet: new Decimal(fsData.purchaseNet),
                purchaseGross: new Decimal(fsData.purchaseGross),
                vatAmount: new Decimal(fsData.vatAmount),
                currentValue: new Decimal(fsData.currentValue),
                updatedAt: new Date(),
                registrationNumber: fsData.registrationNumber,
                vin: fsData.vin,
                location: fsData.location,
                assignedTo: fsData.assignedTo
            }
        });

        // Update Audit
        await db.syncAuditRecord.update({
            where: { entityType_entityId: { entityType: 'asset', entityId: assetId } },
            data: {
                lastSyncedAt: new Date(),
                lastSyncDirection: 'FS_TO_PG'
            }
        });

        await checkAssetConsistency(assetId);
        revalidatePath("/finance/sync-health");
        revalidatePath(`/assets/${assetId}`);

        return { success: true };
    } catch (error: any) {
        console.error("[SYNC_FS_TO_PG_ERROR]", error);
        return { success: false, error: error.message };
    }
}
