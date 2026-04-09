import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Purging LedgerEntry...");
    const deletedLedger = await prisma.ledgerEntry.deleteMany({});
    console.log(`Deleted ${deletedLedger.count} LedgerEntry records.`);

    console.log("Purging BankStaging...");
    const deletedStaging = await prisma.bankStaging.deleteMany({});
    console.log(`Deleted ${deletedStaging.count} BankStaging records.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
