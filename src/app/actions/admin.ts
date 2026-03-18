"use server"

import { PrismaClient } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { getCurrentTenantId } from "@/lib/tenant"

const prisma = new PrismaClient()

/**
 * FULL RESET: Usuwa wszystkie dane operacyjne dla obecnego tenantId.
 * Uwaga: To jest operacja destrukcyjna!
 */
export async function fullResetTenantData() {
    const tenantId = await getCurrentTenantId()

    if (!tenantId) {
        throw new Error("Brak autoryzacji: Nie znaleziono ID tenanta.")
    }

    try {
        await prisma.$transaction(async (tx) => {
            // 1. InvoicePayments (nie mają tenantId, usuwamy przez relację z fakturą)
            await tx.invoicePayment.deleteMany({
                where: {
                    invoice: {
                        tenantId: tenantId
                    }
                }
            })

            // 2. Invoices & Transactions
            await tx.invoice.deleteMany({ where: { tenantId } })
            await tx.transaction.deleteMany({ where: { tenantId } })

            // 3. Bank & Liabilities
            await tx.bankTransactionRaw.deleteMany({ where: { tenantId } })
            await tx.liability.deleteMany({ where: { tenantId } })

            // 4. Projects (ProjectStage zostanie usunięty kaskadowo)
            await tx.project.deleteMany({ where: { tenantId } })

            // 5. Contractors (Object i Contact zostaną usunięte kaskadowo)
            await tx.contractor.deleteMany({ where: { tenantId } })

            // 6. Audit Logs
            await tx.auditLog.deleteMany({ where: { tenantId } })

            console.log(`[ADMIN] Full Reset completed for tenant: ${tenantId}`)
        })

        revalidatePath("/")
        revalidatePath("/crm")
        revalidatePath("/finance")
        revalidatePath("/projects")

        return { success: true, message: "Baza danych została wyczyszczona." }
    } catch (error) {
        console.error("[ADMIN] Full Reset error:", error)
        throw new Error("Błąd podczas czyszczenia bazy danych.")
    }
}
