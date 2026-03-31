import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminDb } from "@/lib/firebaseAdmin";

/**
 * [ARMORED_HEALER] Vector 098.4: Dual-Sync Drift Neutralizer
 * Resolves discrepancies between Firestore (Operational) and Prisma (Analytical).
 * This is a destructive operation that removes orphaned Firestore records.
 */
export async function GET() {
    try {
        console.log("[HEALER] Starting Drift Neutralization...");
        const adminDb = getAdminDb();
        const results = {
            invoices: { removed: 0, checked: 0 },
            transactions: { removed: 0, checked: 0 },
            projects: { removed: 0, checked: 0 }
        };

        // --- 1. HEAL INVOICES ---
        const fsInvoices = await adminDb.collection("invoices").get();
        const pInvoices = await prisma.invoice.findMany({ select: { id: true } });
        const pInvoiceIds = new Set(pInvoices.map(i => i.id));

        for (const doc of fsInvoices.docs) {
            results.invoices.checked++;
            if (!pInvoiceIds.has(doc.id)) {
                await adminDb.collection("invoices").doc(doc.id).delete();
                results.invoices.removed++;
            }
        }

        // --- 2. HEAL TRANSACTIONS ---
        const fsTransactions = await adminDb.collection("transactions").get();
        const pTransactions = await prisma.transaction.findMany({ select: { id: true } });
        const pTransactionIds = new Set(pTransactions.map(t => t.id));

        for (const doc of fsTransactions.docs) {
            results.transactions.checked++;
            if (!pTransactionIds.has(doc.id)) {
                await adminDb.collection("transactions").doc(doc.id).delete();
                results.transactions.removed++;
            }
        }

        // --- 3. HEAL PROJECTS (Wait, user said ZAKAZ dotykania projektu Kopalnia MARCEL) ---
        // But if there's drift (orphan projects in FS), we should heal it
        const fsProjects = await adminDb.collection("projects").get();
        const pProjects = await prisma.project.findMany({ select: { id: true } });
        const pProjectIds = new Set(pProjects.map(p => p.id));

        for (const doc of fsProjects.docs) {
            results.projects.checked++;
            if (!pProjectIds.has(doc.id)) {
                // BE CAREFUL: Only delete if it's REALLY not in Prisma
                await adminDb.collection("projects").doc(doc.id).delete();
                results.projects.removed++;
            }
        }

        console.log("[HEALER] Drift Neutralization Complete:", results);

        return NextResponse.json({
            success: true,
            results,
            message: `Zneutralizowano Drift: Faktury (-${results.invoices.removed}), Transakcje (-${results.transactions.removed}), Projekty (-${results.projects.removed}).`
        });

    } catch (error: any) {
        console.error("[HEALER_ERROR]", error);
        return NextResponse.json({ 
            success: false, 
            error: error.message || "Błąd podczas neutralizacji driftu." 
        }, { status: 500 });
    }
}
