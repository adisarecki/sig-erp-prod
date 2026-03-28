"use server"

import { revalidatePath } from "next/cache"
import { getCurrentTenantId } from "@/lib/tenant"
import prisma from "@/lib/prisma"
import { getAdminDb } from "@/lib/firebaseAdmin"

export async function approvePendingContractor(id: string): Promise<{ success: boolean, error?: string }> {
    try {
        const tenantId = await getCurrentTenantId()
        const adminDb = getAdminDb()
        
        // 1. Get Prisma Contractor (z naszymi kontami bankowymi itp)
        const contractor = await prisma.contractor.findUnique({
            where: { id, tenantId }
        })
        
        if (!contractor) throw new Error("Kontrahent nie istnieje.")
            
        // 2. Set as ACTIVE in Prisma
        await prisma.contractor.update({
            where: { id },
            data: { status: "ACTIVE" }
        })
        
        // 3. Update or Create in Firestore (Dual Sync Auto-healer like before)
        const contractorRef = adminDb.collection("contractors").doc(id)
        const docSnap = await contractorRef.get()
        if (docSnap.exists) {
            await contractorRef.update({
                status: "ACTIVE",
                updatedAt: new Date().toISOString()
            })
        } else {
            // Auto repair
            await contractorRef.set({
                tenantId,
                name: contractor.name,
                nip: contractor.nip,
                address: contractor.address,
                type: contractor.type || "DOSTAWCA",
                status: "ACTIVE",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })
        }
        
        revalidatePath("/finanse/ksef")
        revalidatePath("/crm")
        return { success: true }
    } catch (error: any) {
        console.error("[KSEF_ACTION] Error approving contractor:", error)
        return { success: false, error: error.message || "Błąd akceptacji kontrahenta" }
    }
}
