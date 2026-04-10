"use server"

import { PrismaClient } from "@prisma/client"
import { revalidatePath } from "next/cache"

const prisma = new PrismaClient()

export async function mergeContractorsBulk(primaryId: string, secondaryIds: string[]) {
    if (!primaryId || secondaryIds.length === 0) return { success: false, error: "Wybierz poprawne rekordy do złączenia." };

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Przepięcie Faktur Cost / Income
            await tx.invoice.updateMany({
                where: { contractorId: { in: secondaryIds } },
                data: { contractorId: primaryId }
            });

            // 2. Opcjonalnie przepięcie Projektów jeżeli są powiązane i tworzą relacje inwestorskie
            await tx.project.updateMany({
                where: { contractorId: { in: secondaryIds } },
                data: { contractorId: primaryId }
            });

            // 3. Po bezpiecznym przeniesieniu odciętych kończyn, usuwamy trwale zduplikowane wpisy
            await tx.contractor.deleteMany({
                where: { id: { in: secondaryIds } }
            });
        });

        revalidatePath("/crm");
        revalidatePath("/finanse");
        revalidatePath("/projects");
        
        return { success: true };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : "Błąd bazy danych podczas scalania relacji." };
    }
}
