import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("[PRISMA_CHECK] Initializing...");
    try {
        const tenant = await prisma.tenant.findFirst();
        if (tenant) {
            console.log("[PRISMA_CHECK] Found Tenant Fields:", Object.keys(tenant));
        } else {
            console.log("[PRISMA_CHECK] No tenant found in DB, can't check keys.");
        }
    } catch (e: any) {
        console.error("[PRISMA_CHECK] Error:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
