"use server"

import { PrismaClient } from "@prisma/client"
import { revalidatePath } from "next/cache"

const prisma = new PrismaClient()

export async function deleteContractorsBulk(contractorIds: string[]) {
    if (!contractorIds || contractorIds.length === 0) return { success: false, error: "Brak zaznaczonych rekordów." };

    try {
        // Zliczamy naruszenia - nie wolno usuwać firm, które mają przypisane faktury Cost/Income
        const violations = await prisma.invoice.count({
            where: {
                contractorId: { in: contractorIds }
            }
        });

        if (violations > 0) {
            return { 
                success: false, 
                error: `System zabezpieczający: Wykryto ${violations} przypisanych dokumentów księgowych. Nie można trwale usunąć kontrahenta powiązanego z Cash Flow.` 
            };
        }

        // Hard Delete
        await prisma.contractor.deleteMany({
            where: {
                id: { in: contractorIds }
            }
        });

        revalidatePath("/crm");
        revalidatePath("/projects");
        
        return { success: true };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : "Błąd podczas usuwania." };
    }
}
