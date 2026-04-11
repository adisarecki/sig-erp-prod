"use server"

import { revalidatePath } from "next/cache"
import { getCurrentTenantId } from "@/lib/tenant"
import prisma from "@/lib/prisma"
import { startOfDay, subDays } from "date-fns"

export type CreateVehicleInput = {
    make: string
    model: string
    plates: string
    vin?: string
    status?: 'ACTIVE' | 'SERVICE' | 'INACTIVE'
    notes?: string
    assignedProjectId?: string
}

export async function createVehicle(input: CreateVehicleInput) {
    try {
        const tenantId = await getCurrentTenantId()
        
        const vehicle = await prisma.vehicle.create({
            data: {
                tenantId,
                ...input
            }
        })

        revalidatePath("/fleet-and-tools")
        return { success: true, vehicle }
    } catch (error: any) {
        console.error("[CREATE_VEHICLE_ERROR]", error)
        return { success: false, error: error.message }
    }
}

export async function getFleetSummary() {
    try {
        const tenantId = await getCurrentTenantId()
        const thirtyDaysAgo = subDays(new Date(), 30)

        const vehicles = await prisma.vehicle.findMany({
            where: { tenantId },
            include: {
                invoices: {
                    where: {
                        issueDate: { gte: thirtyDaysAgo }
                    },
                    select: { amountGross: true }
                },
                transactions: {
                    where: {
                        transactionDate: { gte: thirtyDaysAgo }
                    },
                    select: { amount: true }
                }
            }
        })

        const summary = await Promise.all(vehicles.map(async (v) => {
            // [HARDENED RULE] Operational Cost (Accrual) = Invoices only
            const operationalCost30d = v.invoices.reduce((sum, inv) => sum + Number(inv.amountGross), 0)
            
            // [HARDENED RULE] Cash Outflow (Payment) = Transactions only
            const cashOutflow30d = v.transactions.reduce((sum, tx) => sum + Number(tx.amount), 0)
            
            // [HARDENED RULE] Fuel detection: Structured Category as primary source
            const FUEL_CATEGORIES = ["PALIWO", "PALIWO_PROJEKT"]

            const latestFuelTx = await prisma.transaction.findFirst({
                where: {
                    vehicleId: v.id,
                    category: { in: FUEL_CATEGORIES }
                },
                orderBy: { transactionDate: 'desc' }
            })

            const latestFuelInvoice = await prisma.invoice.findFirst({
                where: {
                    vehicleId: v.id,
                    OR: [
                        // Primary: Normalized classification (handled via 'type' if exact)
                        { type: { in: FUEL_CATEGORIES } },
                        // Fallback: legacy text matching (isolated)
                        { type: { contains: "PALIWO", mode: 'insensitive' } },
                    ]
                },
                orderBy: { issueDate: 'desc' }
            })

            let latestFuelDate: Date | null = null
            if (latestFuelInvoice && latestFuelTx) {
                latestFuelDate = latestFuelInvoice.issueDate > latestFuelTx.transactionDate 
                    ? latestFuelInvoice.issueDate 
                    : latestFuelTx.transactionDate
            } else {
                latestFuelDate = latestFuelInvoice?.issueDate || latestFuelTx?.transactionDate || null
            }

            return {
                ...v,
                operationalCost30d,
                cashOutflow30d: Math.abs(cashOutflow30d), // Use absolute for display if negative
                latestFuelDate
            }
        }))

        return { success: true, summary }
    } catch (error: any) {
        console.error("[GET_FLEET_SUMMARY_ERROR]", error)
        return { success: false, error: error.message }
    }
}

/**
 * Fetch all active vehicles for the current tenant.
 */
export async function getVehicles() {
    try {
        const tenantId = await getCurrentTenantId()
        const vehicles = await prisma.vehicle.findMany({
            where: { tenantId, status: 'ACTIVE' },
            orderBy: { plates: 'asc' }
        })
        return vehicles
    } catch (error) {
        console.error("[GET_VEHICLES_ERROR]", error)
        return []
    }
}
