"use server"

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getAdminDb } from "@/lib/firebaseAdmin"
import { getCurrentTenantId } from "@/lib/tenant"

/**
 * VECTOR 117: Diagnose and fix invoice sync drift
 * 
 * GET: Diagnose which invoices are orphaned
 * DELETE: Fix by deleting orphaned invoices from Firestore
 */

export async function GET(request: NextRequest) {
    try {
        // Get tenantId from query params or use default
        const url = new URL(request.url)
        let tenantId = url.searchParams.get("tenantId")
        
        if (!tenantId) {
            // Try to get from authenticated session
            tenantId = await getCurrentTenantId()
        }

        const adminDb = getAdminDb()

        console.log(`[SYNC_DRIFT] Diagnosing tenant: ${tenantId}`)

        // 1. Get all invoices from both systems
        const fsSnapshot = await adminDb
            .collection("invoices")
            .where("tenantId", "==", tenantId)
            .get()

        const pgInvoices = await prisma.invoice.findMany({
            where: { tenantId },
            select: {
                id: true,
                number: true,
                NetAmount: true,
                GrossAmount: true,
                createdAt: true
            }
        })

        // 2. Convert Firestore docs to simple objects
        const fsInvoices = fsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
        }))

        // 3. Find orphaned invoices
        const pgIds = new Set(pgInvoices.map((inv) => inv.id))
        const orphanedInFs = fsInvoices.filter((inv: any) => !pgIds.has(inv.id))

        const fsIds = new Set(fsInvoices.map((inv: any) => inv.id))
        const orphanedInPg = pgInvoices.filter((inv) => !fsIds.has(inv.id))

        console.log(`[SYNC_DRIFT] FS Invoices: ${fsInvoices.length}`)
        console.log(`[SYNC_DRIFT] PG Invoices: ${pgInvoices.length}`)
        console.log(`[SYNC_DRIFT] Orphaned in FS: ${orphanedInFs.length}`)
        console.log(`[SYNC_DRIFT] Orphaned in PG: ${orphanedInPg.length}`)

        // 4. Format response
        const report = {
            tenantId,
            firestore: {
                total: fsInvoices.length,
                details: fsInvoices.map((inv: any) => ({
                    id: inv.id,
                    number: inv.number,
                    netAmount: inv.NetAmount,
                    grossAmount: inv.GrossAmount,
                    createdAt: inv.createdAt,
                    status: pgIds.has(inv.id) ? "✅ synced" : "❌ ORPHANED"
                }))
            },
            postgres: {
                total: pgInvoices.length,
                details: pgInvoices.map((inv) => ({
                    id: inv.id,
                    number: inv.number,
                    netAmount: inv.NetAmount,
                    grossAmount: inv.GrossAmount,
                    createdAt: inv.createdAt,
                    status: fsIds.has(inv.id) ? "✅ synced" : "⚠️ PG-only"
                }))
            },
            orphaned: {
                inFirestore: orphanedInFs.map((inv: any) => ({
                    id: inv.id,
                    number: inv.number,
                    netAmount: inv.NetAmount,
                    grossAmount: inv.GrossAmount,
                    createdAt: inv.createdAt
                })),
                inPostgres: orphanedInPg.map((inv) => ({
                    id: inv.id,
                    number: inv.number,
                    netAmount: inv.NetAmount,
                    grossAmount: inv.GrossAmount,
                    createdAt: inv.createdAt
                }))
            }
        }

        return NextResponse.json({
            success: true,
            message: "Sync drift diagnostic complete",
            report
        })

    } catch (error: any) {
        console.error("[SYNC_DRIFT_ERROR]", error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const tenantId = await getCurrentTenantId()
        const adminDb = getAdminDb()

        console.log(`[SYNC_DRIFT_FIX] Attempting to fix orphaned invoices for tenant: ${tenantId}`)

        // 1. Get invoices from both systems
        const fsSnapshot = await adminDb
            .collection("invoices")
            .where("tenantId", "==", tenantId)
            .get()

        const pgInvoices = await prisma.invoice.findMany({
            where: { tenantId },
            select: { id: true }
        })

        // 2. Find orphaned in Firestore (in FS but not in PG)
        const pgIds = new Set(pgInvoices.map((inv) => inv.id))
        const orphanedInFs = fsSnapshot.docs.filter((doc) => !pgIds.has(doc.id))

        console.log(`[SYNC_DRIFT_FIX] Found ${orphanedInFs.length} orphaned invoices in Firestore`)

        // 3. Delete each orphaned invoice from Firestore
        let deletedCount = 0
        for (const doc of orphanedInFs) {
            try {
                await adminDb.collection("invoices").doc(doc.id).delete()
                deletedCount++
                console.log(`[SYNC_DRIFT_FIX] Deleted orphaned invoice: ${doc.id}`)
            } catch (err) {
                console.error(`[SYNC_DRIFT_FIX] Failed to delete ${doc.id}:`, err)
            }
        }

        return NextResponse.json({
            success: true,
            message: "Sync drift fix complete",
            deletedCount,
            totalOrphaned: orphanedInFs.length
        })

    } catch (error: any) {
        console.error("[SYNC_DRIFT_FIX_ERROR]", error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
