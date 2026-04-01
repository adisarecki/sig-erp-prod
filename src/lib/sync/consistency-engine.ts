import { getAdminDb } from "@/lib/firebaseAdmin";
import prisma from "@/lib/prisma";
const db = prisma as any;
import Decimal from "decimal.js";
import { SyncAssetData } from "@/lib/finance/sync-utils";

export type SyncStatus =
  | 'IN_SYNC'
  | 'MISSING_IN_FIRESTORE'
  | 'MISSING_IN_POSTGRES'
  | 'FIELD_MISMATCH'
  | 'SYNC_ERROR'
  | 'PENDING_RESYNC'

export type SyncDiffField = {
  field: string
  firestoreValue: any
  postgresValue: any
}

export type ConsistencyResult = {
  entityType: 'asset'
  entityId: string
  syncStatus: SyncStatus
  diffFields: SyncDiffField[]
  lastCheckedAt: string
}

/**
 * [VECTOR 108] Consistency Engine
 * Compares Firestore (Primary) vs PostgreSQL (Mirror)
 */
export async function checkAssetConsistency(assetId: string): Promise<ConsistencyResult> {
    try {
        const adminDb = getAdminDb();
        const tenantId = ""; // Contextually needed if multi-tenant scoped, but assetId is Global Unique usually
        
        // 1. Fetch from PostgreSQL
        const pgAsset = await db.asset.findUnique({
            where: { id: assetId },
            include: { project: true, contractor: true }
        });

        // 2. Fetch from Firestore
        const fsDoc = await adminDb.collection("assets").doc(assetId).get();
        const fsAsset = fsDoc.exists ? fsDoc.data() : null;

        // 3. Status logic
        if (!pgAsset && !fsAsset) {
            throw new Error(`Asset ${assetId} not found in either database.`);
        }

        if (!fsAsset) {
            return {
                entityType: 'asset',
                entityId: assetId,
                syncStatus: 'MISSING_IN_FIRESTORE',
                diffFields: [],
                lastCheckedAt: new Date().toISOString()
            };
        }

        if (!pgAsset) {
            return {
                entityType: 'asset',
                entityId: assetId,
                syncStatus: 'MISSING_IN_POSTGRES',
                diffFields: [],
                lastCheckedAt: new Date().toISOString()
            };
        }

        // 4. Detailed Field Comparison
        const diffFields: SyncDiffField[] = [];
        
        // Define fields to compare
        const fieldsToCompare = [
            'name', 'category', 'status', 'sourceType', 'purchaseNet', 'purchaseGross', 
            'initialValue', 'currentValue', 'registrationNumber', 'vin', 'location', 'assignedTo'
        ];

        for (const field of fieldsToCompare) {
            let pgVal = (pgAsset as any)[field];
            let fsVal = fsAsset[field];

            // Normalize Decimals
            if (pgVal instanceof Decimal) pgVal = pgVal.toNumber();
            if (typeof fsVal === 'string' && !isNaN(Number(fsVal)) && fieldsToCompare.includes(field)) {
                // Potential number stored as string in older records or firestore quirks
            }

            // Normalizacja null/undefined
            const normalizedPg = pgVal === null || pgVal === undefined ? null : pgVal;
            const normalizedFs = fsVal === null || fsVal === undefined ? null : fsVal;

            if (normalizedPg !== normalizedFs) {
                diffFields.push({
                    field,
                    firestoreValue: normalizedFs,
                    postgresValue: normalizedPg
                });
            }
        }

        // Handle Dates separately (ISO comparison)
        const dateFields = ['purchaseDate', 'warrantyEndDate', 'insuranceEndDate', 'inspectionDate'];
        for (const field of dateFields) {
            const pgDate = (pgAsset as any)[field];
            const fsDate = fsAsset[field];

            const pgIso = pgDate instanceof Date ? pgDate.toISOString().split('T')[0] : (pgDate ? new Date(pgDate).toISOString().split('T')[0] : null);
            const fsIso = fsDate ? new Date(fsDate).toISOString().split('T')[0] : null;

            if (pgIso !== fsIso) {
                diffFields.push({
                    field,
                    firestoreValue: fsIso,
                    postgresValue: pgIso
                });
            }
        }

        const syncStatus: SyncStatus = diffFields.length > 0 ? 'FIELD_MISMATCH' : 'IN_SYNC';

        // 5. Update/Persist Audit Record (SQL Mirror)
        await db.syncAuditRecord.upsert({
            where: { entityType_entityId: { entityType: 'asset', entityId: assetId } },
            create: {
                entityType: 'asset',
                entityId: assetId,
                syncStatus,
                diffFields: diffFields as any,
                lastCheckedAt: new Date()
            },
            update: {
                syncStatus,
                diffFields: diffFields as any,
                lastCheckedAt: new Date()
            }
        });

        return {
            entityType: 'asset',
            entityId: assetId,
            syncStatus,
            diffFields,
            lastCheckedAt: new Date().toISOString()
        };

    } catch (error: any) {
        console.error("[CONSISTENCY_ENGINE_ERROR]", error);
        return {
            entityType: 'asset',
            entityId: assetId,
            syncStatus: 'SYNC_ERROR',
            diffFields: [],
            lastCheckedAt: new Date().toISOString()
        };
    }
}
