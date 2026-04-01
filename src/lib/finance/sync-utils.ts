import { getAdminDb } from "@/lib/firebaseAdmin";
import prisma from "@/lib/prisma";
import Decimal from "decimal.js";

/**
 * [ARMORED_SYNC] Armored Database Synchronization Utility
 * Ensures that every document in Prisma has a perfect shadow in Firestore.
 */

export interface SyncContractorData {
    id: string;
    tenantId: string;
    nip: string | null;
    name: string;
    type: string;
    status: string;
    address?: string | null;
}

export interface SyncInvoiceData {
    id: string;
    tenantId: string;
    contractorId: string;
    projectId?: string | null;
    type: string; // REVENUE / EXPENSE
    amountNet: number | Decimal;
    amountGross: number | Decimal;
    taxRate: number | Decimal;
    issueDate: Date | string;
    dueDate: Date | string;
    status: string;
    externalId?: string | null;
    ksefId?: string | null;
    retainedAmount?: number | Decimal | null;
    retentionReleaseDate?: Date | string | null;
    createdAt: Date | string;
}

export interface SyncAssetData {
    id: string;
    tenantId: string;
    
    sourceType: 'KSEF_LINKED' | 'MANUAL';
    sourceInvoiceId?: string | null;
    sourceDocumentNumber?: string | null;
    sourceDocumentDate?: Date | string | null;

    name: string;
    category: 'vehicle' | 'tool' | 'it' | 'equipment';
    subcategory?: string | null;
    brand?: string | null;
    model?: string | null;
    serialNumber?: string | null;

    // vehicle-specific
    registrationNumber?: string | null;
    vin?: string | null;
    insuranceEndDate?: Date | string | null;
    inspectionDate?: Date | string | null;
    mileage?: number | null;

    // operational ownership
    location?: string | null;
    assignedTo?: string | null;
    assignedProjectId?: string | null;

    // purchase / value
    purchaseDate: Date | string;
    purchaseNet: number | Decimal;
    purchaseGross: number | Decimal;
    vatAmount: number | Decimal;
    initialValue: number | Decimal;
    currentValue: number | Decimal;

    supplierId?: string | null;
    
    // lifecycle
    warrantyEndDate?: Date | string | null;
    serviceDueDate?: Date | string | null;
    status: 'ACTIVE' | 'INACTIVE' | 'DAMAGED' | 'SOLD';

    // future-ready depreciation fields
    depreciationMethod?: string | null;
    depreciationRate?: number | Decimal | null;
    depreciationStartDate?: Date | string | null;
    monthlyDepreciation?: number | Decimal | null;

    notes?: string | null;
    createdAt: Date | string;
}

/**
 * Synchronizes a Contractor from Prisma-style data to Firestore.
 */
export async function syncContractorToFirestore(data: SyncContractorData) {
    const adminDb = getAdminDb();
    console.log(`[ARMORED_SYNC] Syncing Contractor: ${data.name} (${data.id})`);
    
    await adminDb.collection("contractors").doc(data.id).set({
        tenantId: data.tenantId,
        nip: data.nip || null,
        name: data.name,
        type: data.type,
        status: data.status,
        address: data.address || null,
        updatedAt: new Date().toISOString()
    }, { merge: true });
}

/**
 * Synchronizes an Invoice from Prisma-style data to Firestore.
 */
export async function syncInvoiceToFirestore(data: SyncInvoiceData) {
    const adminDb = getAdminDb();
    console.log(`[ARMORED_SYNC] Syncing Invoice Header: ${data.externalId || data.id} (${data.id})`);

    // Standardize dates
    const issueDateStr = typeof data.issueDate === 'string' ? data.issueDate : data.issueDate.toISOString();
    const dueDateStr = typeof data.dueDate === 'string' ? data.dueDate : data.dueDate.toISOString();
    const createdAtStr = typeof data.createdAt === 'string' ? data.createdAt : data.createdAt.toISOString();

    // Mapping SQL type (REVENUE/EXPENSE) to Firestore labels (SPRZEDAŻ/EXPENSE)
    const fsType = data.type === 'REVENUE' ? 'SPRZEDAŻ' : 'EXPENSE';

    await adminDb.collection("invoices").doc(data.id).set({
        tenantId: data.tenantId,
        contractorId: data.contractorId,
        projectId: data.projectId || '',
        type: fsType,
        amountNet: Number(data.amountNet),
        amountGross: Number(data.amountGross),
        taxRate: Number(data.taxRate),
        issueDate: issueDateStr,
        dueDate: dueDateStr,
        status: data.status,
        externalId: data.externalId || null,
        ksefId: data.ksefId || null,
        retainedAmount: data.retainedAmount ? Number(data.retainedAmount) : null,
        retentionReleaseDate: data.retentionReleaseDate ? (typeof data.retentionReleaseDate === 'string' ? data.retentionReleaseDate : data.retentionReleaseDate.toISOString()) : null,
        createdAt: createdAtStr,
        updatedAt: new Date().toISOString()
    }, { merge: true });
}

/**
 * Synchronizes an Asset from Prisma-style data to Firestore.
 */
export async function syncAssetToFirestore(data: SyncAssetData) {
    const adminDb = getAdminDb();
    console.log(`[ARMORED_SYNC] Syncing Asset: ${data.name} (${data.id})`);

    const purchaseDateStr = typeof data.purchaseDate === 'string' ? data.purchaseDate : data.purchaseDate.toISOString();
    const createdAtStr = typeof data.createdAt === 'string' ? data.createdAt : data.createdAt.toISOString();
    
    const warrantyDateStr = data.warrantyEndDate ? (typeof data.warrantyEndDate === 'string' ? data.warrantyEndDate : data.warrantyEndDate.toISOString()) : null;
    const depStartDateStr = data.depreciationStartDate ? (typeof data.depreciationStartDate === 'string' ? data.depreciationStartDate : data.depreciationStartDate.toISOString()) : null;
    
    const docDateStr = data.sourceDocumentDate ? (typeof data.sourceDocumentDate === 'string' ? data.sourceDocumentDate : data.sourceDocumentDate.toISOString()) : null;
    const insuranceDateStr = data.insuranceEndDate ? (typeof data.insuranceEndDate === 'string' ? data.insuranceEndDate : data.insuranceEndDate.toISOString()) : null;
    const inspectionDateStr = data.inspectionDate ? (typeof data.inspectionDate === 'string' ? data.inspectionDate : data.inspectionDate.toISOString()) : null;
    const serviceDateStr = data.serviceDueDate ? (typeof data.serviceDueDate === 'string' ? data.serviceDueDate : data.serviceDueDate.toISOString()) : null;

    await adminDb.collection("assets").doc(data.id).set({
        tenantId: data.tenantId,
        
        sourceType: data.sourceType,
        sourceInvoiceId: data.sourceInvoiceId || null,
        sourceDocumentNumber: data.sourceDocumentNumber || null,
        sourceDocumentDate: docDateStr,

        name: data.name,
        category: data.category,
        subcategory: data.subcategory || null,
        brand: data.brand || null,
        model: data.model || null,
        serialNumber: data.serialNumber || null,

        // vehicle specific
        registrationNumber: data.registrationNumber || null,
        vin: data.vin || null,
        insuranceEndDate: insuranceDateStr,
        inspectionDate: inspectionDateStr,
        mileage: data.mileage || null,

        // operational
        location: data.location || null,
        assignedTo: data.assignedTo || null,
        assignedProjectId: data.assignedProjectId || null,

        purchaseDate: purchaseDateStr,
        purchaseNet: Number(data.purchaseNet),
        purchaseGross: Number(data.purchaseGross),
        vatAmount: Number(data.vatAmount),
        initialValue: Number(data.initialValue),
        currentValue: Number(data.currentValue),

        supplierId: data.supplierId || null,

        status: data.status,
        warrantyEndDate: warrantyDateStr,
        serviceDueDate: serviceDateStr,
        
        notes: data.notes || null,
        createdAt: createdAtStr,
        updatedAt: new Date().toISOString(),

        // Phase 2 Fields
        depreciationMethod: data.depreciationMethod || 'LINEAR',
        depreciationRate: data.depreciationRate ? Number(data.depreciationRate) : null,
        depreciationStartDate: depStartDateStr,
        monthlyDepreciation: data.monthlyDepreciation ? Number(data.monthlyDepreciation) : null
    }, { merge: true });
}
