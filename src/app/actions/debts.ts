"use server"

import { revalidatePath } from "next/cache"
import Decimal from "decimal.js"
import { getCurrentTenantId } from "@/lib/tenant"
import { getAdminDb } from "@/lib/firebaseAdmin"
import { FieldValue } from "firebase-admin/firestore"

/**
 * addLegacyDebt
 */
export async function addLegacyDebt(formData: FormData) {
    const adminDb = getAdminDb()
    const tenantId = await getCurrentTenantId()
    const creditor = formData.get("creditor") as string
    const name = formData.get("name") as string
    const totalAmountStr = formData.get("totalAmount") as string
    const installmentsCount = parseInt(formData.get("installmentsCount") as string || "1")
    const startDateStr = formData.get("startDate") as string

    if (!creditor || !name || !totalAmountStr || !startDateStr) {
        throw new Error("Wierzyciel, nazwa, kwota i data startu są wymagane.")
    }

    const totalAmount = new Decimal(totalAmountStr)
    const installmentAmount = totalAmount.dividedBy(installmentsCount).toDecimalPlaces(2)

    await adminDb.runTransaction(async (transaction) => {
        const debtRef = adminDb.collection("legacy_debts").doc()
        transaction.set(debtRef, {
            tenantId,
            creditor,
            name,
            totalAmount: totalAmount.toNumber(),
            remainingAmount: totalAmount.toNumber(),
            createdAt: new Date().toISOString()
        })

        // Generujemy raty (co miesiąc)
        for (let i = 0; i < installmentsCount; i++) {
            const dueDate = new Date(startDateStr)
            dueDate.setMonth(dueDate.getMonth() + i)
            
            const instRef = adminDb.collection("legacy_debt_installments").doc()
            const amount = i === installmentsCount - 1 ? totalAmount.minus(installmentAmount.times(i)) : installmentAmount
            
            transaction.set(instRef, {
                debtId: debtRef.id,
                amount: amount.toNumber(),
                dueDate: dueDate.toISOString(),
                status: "ACTIVE",
                createdAt: new Date().toISOString()
            })
        }
    })

    revalidatePath("/")
    revalidatePath("/finance")
    return { success: true }
}

/**
 * markInstallmentAsPaid
 */
export async function markInstallmentAsPaid(installmentId: string, paymentDateStr?: string) {
    const adminDb = getAdminDb()
    const tenantId = await getCurrentTenantId()
    const paymentDate = paymentDateStr ? new Date(paymentDateStr) : new Date()
    
    await adminDb.runTransaction(async (transaction) => {
        const instRef = adminDb.collection("legacy_debt_installments").doc(installmentId)
        const instDoc = await transaction.get(instRef)
        
        if (!instDoc.exists) throw new Error("Rata nie istnieje.")
        const inst = instDoc.data()!
        if (inst.status === "PAID") return

        const debtRef = adminDb.collection("legacy_debts").doc(inst.debtId)
        const debtDoc = await transaction.get(debtRef)
        const debt = debtDoc.data()!
        if (debt.tenantId !== tenantId) throw new Error("Brak dostępu.")

        // 1. Tworzymy transakcję (Zmniejszenie Bilansu)
        const transRef = adminDb.collection("transactions").doc()
        transaction.set(transRef, {
            tenantId,
            amount: inst.amount,
            type: "KOSZT",
            transactionDate: paymentDate.toISOString(),
            category: "DŁUG_HISTORYCZNY",
            description: `Spłata raty długu: ${debt.name} (${debt.creditor})`,
            status: "ACTIVE",
            source: "MANUAL",
            createdAt: new Date().toISOString()
        })

        // 2. Aktualizujemy ratę
        transaction.update(instRef, {
            status: "PAID",
            paidAt: new Date().toISOString(),
            transactionId: transRef.id,
            updatedAt: new Date().toISOString()
        })

        // 3. Aktualizujemy saldo długu
        transaction.update(debtRef, {
            remainingAmount: FieldValue.increment(-inst.amount),
            updatedAt: new Date().toISOString()
        })
    })

    revalidatePath("/")
    revalidatePath("/finance")
    return { success: true }
}
