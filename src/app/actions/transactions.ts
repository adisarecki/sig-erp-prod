"use server"

import { revalidatePath } from "next/cache"
import { getCurrentTenantId } from "@/lib/tenant"
import { getAdminDb } from "@/lib/firebaseAdmin"
import prisma from "@/lib/prisma"
import Decimal from "decimal.js"
import { recalculateProjectBudget } from "./projects"
import { syncRetentionsFromProject } from "./retentions"
import { recordLedgerEntry } from "@/lib/finance/ledger-manager"
import { assertFinancialMasterWrite } from "@/lib/authority/guards"
import { randomUUID } from "crypto"

export async function deleteTransaction(id: string): Promise<{ success: boolean, error?: string }> {
    try {
        const tenantId = await getCurrentTenantId()
        const adminDb = getAdminDb()

        // 1. PG-Master Delete
        await assertFinancialMasterWrite('DELETE_TRANSACTION', id);
        await prisma.transaction.delete({ where: { id, tenantId } })

        // 2. FS-Mirror Sync
        await adminDb.collection("transactions").doc(id).delete()

        revalidatePath("/finanse")
        revalidatePath("/projects")
        revalidatePath("/")

        return { success: true }
    } catch (error: any) {
        console.error("[TRANSACTION_DELETE_ERROR]", error)
        return { success: false, error: error.message || "Błąd podczas usuwania transakcji." }
    }
}

export async function addTransaction(formData: FormData): Promise<{ success: boolean, error?: string }> {
    try {
        const adminDb = getAdminDb()
        const amountStr = formData.get("amount") as string
        const dateStr = formData.get("date") as string
        const category = formData.get("category") as string
        const rawProjectId = formData.get("projectId") as string
        const description = formData.get("description") as string
        const type = formData.get("type") as string || "KOSZT"
        const source = formData.get("source") as string || "MANUAL"

        if (!amountStr || !dateStr || !category) {
            return { success: false, error: "Pola Kwota, Data i Kategoria są wymagane." }
        }

        const tenantId = await getCurrentTenantId()
        const amount = Number(amountStr)
        const transactionDate = new Date(dateStr)
        const projectId = (!rawProjectId || rawProjectId === "none" || rawProjectId === "NONE" || rawProjectId === "GENERAL" || rawProjectId === "INTERNAL") ? null : rawProjectId;
        const classification = projectId ? "PROJECT_COST" : "GENERAL_COST";

        // 1. Financial Master Write (POSTGRES)
        await assertFinancialMasterWrite('CREATE_TRANSACTION', description || 'MANUAL');
        
        const transactionId = randomUUID();
        
        await prisma.$transaction(async (tx: any) => {
            // A. Create Transaction
            await tx.transaction.create({
                data: {
                    id: transactionId,
                    tenantId,
                    projectId,
                    classification,
                    amount: amount,
                    type,
                    transactionDate,
                    category,
                    status: "ACTIVE",
                    source,
                    description: description || null
                }
            });

            // B. record to Ledger
            await recordLedgerEntry({
                tenantId,
                projectId: projectId || undefined,
                source: source === 'BANK_PAYMENT' ? 'BANK_PAYMENT' : 'SHADOW_COST',
                sourceId: transactionId,
                amount: new Decimal(amount).mul(type === 'PRZYCHÓD' || type === 'INCOME' ? 1 : -1),
                type: type === 'PRZYCHÓD' || type === 'INCOME' ? 'INCOME' : 'EXPENSE',
                date: transactionDate
            }, tx);
        });

        // 2. Operational Mirror Sync (FIRESTORE)
        await adminDb.collection("transactions").doc(transactionId).set({
            tenantId,
            projectId,
            classification,
            amount,
            type,
            transactionDate: transactionDate.toISOString(),
            category,
            status: "ACTIVE",
            source,
            description: description || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        revalidatePath("/")
        revalidatePath("/projects")
        revalidatePath("/finanse")

        return { success: true }
    } catch (error: any) {
        console.error("[TRANSACTION_ADD_ERROR]", error)
        return { success: false, error: error.message || "Błąd podczas dodawania transakcji." }
    }
}
export async function assignTransactionToProject(transactionId: string, projectId: string) {
    if (!transactionId || !projectId || projectId === "none" || projectId === "NONE" || projectId === "GENERAL" || projectId === "INTERNAL") {
        throw new Error("ID transakcji oraz ID projektu są wymagane.")
    }

    try {
        const adminDb = getAdminDb()
        const tenantId = await getCurrentTenantId()

        // 1. Firestore Update
        await adminDb.collection("transactions").doc(transactionId).update({
            projectId,
            classification: "PROJECT_COST",
            updatedAt: new Date().toISOString()
        })

        // 2. Prisma Sync
        await prisma.transaction.update({
            where: { id: transactionId },
            data: {
                projectId,
                classification: "PROJECT_COST"
            }
        })

        await recalculateProjectBudget(projectId)

        return { success: true }
    } catch (error: any) {
        console.error("[ASSIGN_TRANSACTION_ERROR]", error)
        return { success: false, error: error.message || "Nie udało się przypisać transakcji do projektu." }
    }
}
