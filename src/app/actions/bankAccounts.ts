"use server"

import prisma from "@/lib/prisma"
import { getCurrentTenantId } from "@/lib/tenant"

/**
 * Fetches all bank accounts for the current tenant.
 */
export async function getBankAccounts() {
    const tenantId = await getCurrentTenantId()
    
    try {
        const accounts = await prisma.bankAccount.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'asc' }
        })
        
        return { success: true, data: accounts }
    } catch (error: any) {
        console.error("[GET_BANK_ACCOUNTS_ERROR]", error)
        return { success: false, error: "Nie udało się pobrać listy kont bankowych." }
    }
}
