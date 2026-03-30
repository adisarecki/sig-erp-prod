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
