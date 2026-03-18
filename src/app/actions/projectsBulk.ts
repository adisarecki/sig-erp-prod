"use server"

import { PrismaClient } from "@prisma/client"
import { revalidatePath } from "next/cache"

const prisma = new PrismaClient()

export async function bulkUpdateProjectLifecycle(projectIds: string[], status: 'ACTIVE' | 'ON_HOLD' | 'ARCHIVED') {
    if (!projectIds || projectIds.length === 0) return { success: false, error: "Brak zaznaczonych projektów." };

    try {
        await prisma.project.updateMany({
            where: {
                id: { in: projectIds }
            },
            data: {
                lifecycleStatus: status
            }
        });

        // Wymuszamy refresh wszystkich stron widocznych dla użytkownika, pobierających projekty
        revalidatePath("/projects");
        revalidatePath("/");
        revalidatePath("/finance");

        return { success: true };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : "Błąd bazy danych podczas aktualizowania statusu projektów." };
    }
}
