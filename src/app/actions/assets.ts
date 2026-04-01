"use server"

import { revalidatePath } from "next/cache"
import Decimal from "decimal.js"
import { getCurrentTenantId } from "@/lib/tenant"
import { getAdminDb } from "@/lib/firebaseAdmin"
import prisma from "@/lib/prisma"
// @ts-ignore - Prisma environment lag: Asset model exists in schema.prisma and was generated.
const db = prisma as any;
import { checkAssetConsistency } from "@/lib/sync/consistency-engine"
import { recordLedgerEntry } from "@/lib/finance/ledger-manager"
import { assertAuthorityWrite, assertFinancialMasterWrite } from "@/lib/authority/guards"

export type CreateAssetInput = {
    sourceType: 'KSEF_LINKED' | 'MANUAL'
    sourceInvoiceId?: string
    sourceDocumentNumber?: string
    sourceDocumentDate?: string

    name: string
    category: 'vehicle' | 'tool' | 'it' | 'equipment'
    subcategory?: string
    brand?: string
    model?: string
    serialNumber?: string

    // vehicle-specific
    registrationNumber?: string
    vin?: string
    insuranceEndDate?: string
    inspectionDate?: string
    mileage?: number

    // operational
    location?: string
    assignedTo?: string
    assignedProjectId?: string

    // purchase / value
    purchaseDate: string
    purchaseNet: number
    purchaseGross: number
    vatAmount: number
    initialValue: number
    currentValue: number

    supplierId?: string
    warrantyEndDate?: string
    serviceDueDate?: string
    
    notes?: string
}

export async function createAssetFromKsef(invoiceId: string, input: CreateAssetInput) {
    try {
        const tenantId = await getCurrentTenantId()
        const adminDb = getAdminDb()

        // 1. Walidacja faktury KSeF
        const ksefInvoice = await prisma.ksefInvoice.findUnique({
            where: { id: invoiceId, tenantId }
        })

        if (!ksefInvoice) throw new Error("Nie znaleziono faktury KSeF.")

        // Tier 1 Duplicate Shield: sourceInvoiceId + category + serialNumber
        const existing = await db.asset.findFirst({
            where: {
                tenantId,
                sourceInvoiceId: invoiceId,
                category: input.category as any,
                serialNumber: input.serialNumber || null
            }
        })

        if (existing) {
            return { 
                success: false, 
                warning: true, 
                error: `Środek trwały przypięty do tej faktury już istnieje (ID: ${existing.id}).` 
            }
        }

        const assetId = crypto.randomUUID()

        const assetData = {
            id: assetId,
            tenantId,
            ...input,
            sourceInvoiceId: invoiceId,
            sourceType: 'KSEF_LINKED' as const,
            initialValue: new Decimal(input.purchaseNet),
            currentValue: new Decimal(input.purchaseNet),
            status: 'ACTIVE' as const,
            purchaseDate: new Date(input.purchaseDate),
            sourceDocumentDate: input.sourceDocumentDate ? new Date(input.sourceDocumentDate) : null,
            insuranceEndDate: input.insuranceEndDate ? new Date(input.insuranceEndDate) : null,
            inspectionDate: input.inspectionDate ? new Date(input.inspectionDate) : null,
            warrantyEndDate: input.warrantyEndDate ? new Date(input.warrantyEndDate) : null,
            serviceDueDate: input.serviceDueDate ? new Date(input.serviceDueDate) : null,
            createdAt: new Date(),
            updatedAt: new Date(),
            purchaseNet: new Decimal(input.purchaseNet),
            purchaseGross: new Decimal(input.purchaseGross),
            vatAmount: new Decimal(input.vatAmount)
        }

        // 2. Financial Authority Write (Vector 109)
        // Acquisition cost MUST be recorded in the Ledger
        await recordLedgerEntry({
            tenantId,
            projectId: input.assignedProjectId,
            source: 'INVOICE',
            sourceId: invoiceId,
            amount: new Decimal(input.purchaseNet).negated(), // Acquisition is an expense/asset outflow from cash perspective
            type: 'EXPENSE',
            date: new Date(input.purchaseDate)
        });

        // 3. Operational Authority Write (Firestore wins for non-financial state)
        await assertAuthorityWrite('OPERATIONAL_ASSET', 'CREATE_ASSET', 'FIRESTORE', assetId);
        
        await adminDb.collection("assets").doc(assetId).set({
            ...assetData,
            purchaseDate: assetData.purchaseDate.toISOString(),
            sourceDocumentDate: assetData.sourceDocumentDate?.toISOString() || null,
            insuranceEndDate: assetData.insuranceEndDate?.toISOString() || null,
            inspectionDate: assetData.inspectionDate?.toISOString() || null,
            warrantyEndDate: assetData.warrantyEndDate?.toISOString() || null,
            serviceDueDate: assetData.serviceDueDate?.toISOString() || null,
            createdAt: assetData.createdAt.toISOString(),
            updatedAt: assetData.updatedAt.toISOString(),
            purchaseNet: Number(assetData.purchaseNet),
            purchaseGross: Number(assetData.purchaseGross),
            vatAmount: Number(assetData.vatAmount),
            initialValue: Number(assetData.initialValue),
            currentValue: Number(assetData.currentValue)
        })

        // 4. SQL Operational Mirror
        await db.asset.create({
            data: {
                ...assetData,
                category: input.category as any,
                status: 'ACTIVE' as any,
                // Add domain and authority info to metadata if tracking exists there, 
                // but usually handled via SyncAuditRecord.
            }
        })

        // 5. Trigger Consistency Logic (Vector 108)
        await checkAssetConsistency(assetId)

        revalidatePath("/assets")
        revalidatePath("/finance/ksef")
        
        return { success: true, id: assetId }
    } catch (error: any) {
        console.error("[CREATE_ASSET_FROM_KSEF_ERROR]", error)
        return { success: false, error: error.message }
    }
}

export async function addManualAsset(input: CreateAssetInput) {
    try {
        const tenantId = await getCurrentTenantId()
        const adminDb = getAdminDb()

        // Tier 2 Duplicate Shield: name + purchaseDate + initialValue
        const existing = await db.asset.findFirst({
            where: {
                tenantId,
                name: input.name,
                purchaseDate: new Date(input.purchaseDate),
                initialValue: new Decimal(input.initialValue)
            }
        })

        if (existing) {
             return { 
                success: false, 
                warning: true, 
                error: `Środek trwały o tej samej nazwie, dacie i wartości już istnieje (ID: ${existing.id}).` 
            }
        }

        const assetId = crypto.randomUUID()

        const assetData = {
            id: assetId,
            tenantId,
            ...input,
            sourceType: 'MANUAL' as const,
            initialValue: new Decimal(input.initialValue),
            currentValue: new Decimal(input.currentValue),
            status: 'ACTIVE' as const,
            purchaseDate: new Date(input.purchaseDate),
            sourceDocumentDate: input.sourceDocumentDate ? new Date(input.sourceDocumentDate) : null,
            insuranceEndDate: input.insuranceEndDate ? new Date(input.insuranceEndDate) : null,
            inspectionDate: input.inspectionDate ? new Date(input.inspectionDate) : null,
            warrantyEndDate: input.warrantyEndDate ? new Date(input.warrantyEndDate) : null,
            serviceDueDate: input.serviceDueDate ? new Date(input.serviceDueDate) : null,
            createdAt: new Date(),
            updatedAt: new Date(),
            purchaseNet: new Decimal(input.purchaseNet),
            purchaseGross: new Decimal(input.purchaseGross),
            vatAmount: new Decimal(input.vatAmount)
        }

        // 2. Financial Authority Write (Vector 109)
        await recordLedgerEntry({
            tenantId,
            projectId: input.assignedProjectId,
            source: 'SHADOW_COST',
            sourceId: assetId,
            amount: new Decimal(input.purchaseNet).negated(),
            type: 'EXPENSE',
            date: new Date(input.purchaseDate)
        });

        // 3. Operational Authority Write
        await assertAuthorityWrite('OPERATIONAL_ASSET', 'ADD_MANUAL_ASSET', 'FIRESTORE', assetId);

        // Firestore
        await adminDb.collection("assets").doc(assetId).set({
            ...assetData,
            purchaseDate: assetData.purchaseDate.toISOString(),
            sourceDocumentDate: assetData.sourceDocumentDate?.toISOString() || null,
            insuranceEndDate: assetData.insuranceEndDate?.toISOString() || null,
            inspectionDate: assetData.inspectionDate?.toISOString() || null,
            warrantyEndDate: assetData.warrantyEndDate?.toISOString() || null,
            serviceDueDate: assetData.serviceDueDate?.toISOString() || null,
            createdAt: assetData.createdAt.toISOString(),
            updatedAt: assetData.updatedAt.toISOString(),
            purchaseNet: Number(assetData.purchaseNet),
            purchaseGross: Number(assetData.purchaseGross),
            vatAmount: Number(assetData.vatAmount),
            initialValue: Number(assetData.initialValue),
            currentValue: Number(assetData.currentValue)
        })

        // Prisma Mirror
        await db.asset.create({
            data: {
                ...assetData,
                category: input.category as any,
                status: 'ACTIVE' as any
            }
        })

        // Trigger Consistency Logic (Vector 108)
        await checkAssetConsistency(assetId)

        revalidatePath("/assets")
        return { success: true, id: assetId }
    } catch (error: any) {
        console.error("[ADD_MANUAL_ASSET_ERROR]", error)
        return { success: false, error: error.message }
    }
}

export async function updateAssetStatus(id: string, status: string) {
    try {
        const tenantId = await getCurrentTenantId()
        const adminDb = getAdminDb()

        // Firestore
        await adminDb.collection("assets").doc(id).update({
            status,
            updatedAt: new Date().toISOString()
        })

        // Prisma
        await db.asset.update({
            where: { id, tenantId },
            data: { status }
        })

        revalidatePath("/assets")
        return { success: true }
    } catch (error: any) {
        console.error("[UPDATE_ASSET_STATUS_ERROR]", error)
        return { success: false, error: error.message }
    }
}
