import prisma from "@/lib/prisma";

export async function diagnoseRetention() {
    const entries = await (prisma as any).ledgerEntry.findMany({
        where: { type: 'RETENTION_LOCK' }
    });
    
    console.log("RETENTION LOCK ENTRIES:", entries.map((e: any) => ({
        id: e.id,
        source: e.source,
        sourceId: e.sourceId,
        amount: e.amount,
        projectId: e.projectId
    })));
    
    return entries;
}
