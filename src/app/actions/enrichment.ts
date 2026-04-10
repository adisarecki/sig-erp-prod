"use server"

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function applyContractorUpdate(notificationId: string) {
    try {
        const notification = await (prisma as any).notification.findUnique({
            where: { id: notificationId }
        });

        if (!notification || notification.type !== 'ENRICHMENT_PROPOSAL' || !notification.metadata) {
            throw new Error("Nieprawidłowe powiadomienie.");
        }

        const metadata = notification.metadata as any;
        const diffs = metadata?.diffs || [];
        const contractorId = metadata?.contractorId;

        const contractor = await prisma.contractor.findUnique({
            where: { id: contractorId }
        });

        if (!contractor) throw new Error("Nie znaleziono kontrahenta do aktualizacji.");

        const updateData: any = {};
        
        for (const diff of diffs) {
            if (diff.field === 'address') {
                updateData.address = diff.newValue;
            } else if (diff.field === 'bankAccount') {
                const accounts = [...(contractor.bankAccounts as string[])];
                if (!accounts.includes(diff.newValue)) {
                    accounts.push(diff.newValue);
                }
                updateData.bankAccounts = accounts;
            }
        }

        await prisma.contractor.update({
            where: { id: contractor.id },
            data: updateData
        });

        // Oznacz powiadomienie jako przeczytane lub usuń je
        await prisma.notification.update({
            where: { id: notificationId },
            data: { isRead: true }
        });

        revalidatePath("/");
        revalidatePath("/finanse");
        revalidatePath("/contractors");

        return { success: true, message: `Kartoteka ${contractor.name} została zaktualizowana.` };

    } catch (error: any) {
        console.error("[APPLY_ENRICHMENT_ERROR]", error);
        return { success: false, error: error.message };
    }
}
