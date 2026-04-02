import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    try {
        console.log("📊 SYNC DRIFT DIAGNOSTIC\n");

        // Get all tenants
        const tenants = await prisma.tenant.findMany();
        console.log(`Found ${tenants.length} tenants:\n`);

        for (const tenant of tenants) {
            // Count invoices in Prisma
            const pgCount = await prisma.invoice.count({
                where: { tenantId: tenant.id }
            });

            console.log(`🏢 Tenant: ${tenant.name} (ID: ${tenant.id})`);
            console.log(`   PostgreSQL Invoice Count: ${pgCount}`);

            // Get invoice details if any exist
            if (pgCount > 0) {
                const invoices = await prisma.invoice.findMany({
                    where: { tenantId: tenant.id },
                    select: {
                        id: true,
                        invoiceNumber: true,
                        amountNet: true,
                        amountGross: true,
                        createdAt: true
                    },
                    take: 5 // Show first 5
                });

                console.log(`   Recent invoices:`);
                invoices.forEach((inv) => {
                    console.log(`   - ${inv.invoiceNumber} (${inv.id}): ${inv.amountNet} PLN net`);
                });
            }
            console.log();
        }

        console.log("\n✅ NOTE: This shows PostgreSQL data only.");
        console.log("   To see Firestore data and sync status, call:");
        console.log("   GET /api/maintenance/sync-drift?tenantId=<TENANT_ID>");
        console.log("   Or visit: https://your-domain/dashboard and check the sync indicator");

    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
