import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const today = new Date("2026-04-02");
    const tomorrow = new Date("2026-04-03");

    console.log(`🧹 Czyszczenie danych z dnia ${today.toISOString().split('T')[0]}...`);

    try {
        const lCount = await prisma.ledgerEntry.deleteMany({
            where: { date: { gte: today, lt: tomorrow } }
        });
        console.log(`✅ Usunięto ${lCount.count} wpisów w Ledgerze.`);

        const pCount = await prisma.invoicePayment.deleteMany({
            where: { createdAt: { gte: today, lt: tomorrow } }
        });
        console.log(`✅ Usunięto ${pCount.count} płatności.`);

        const tCount = await prisma.transaction.deleteMany({
            where: { createdAt: { gte: today, lt: tomorrow } }
        });
        console.log(`✅ Usunięto ${tCount.count} transakcji.`);

        const iCount = await prisma.invoice.deleteMany({
            where: { createdAt: { gte: today, lt: tomorrow } }
        });
        console.log(`✅ Usunięto ${iCount.count} faktur.`);

        console.log("✨ Dane wyczyszczone. System gotowy do ponownego testu.");
    } catch (e) {
        console.error("❌ Błąd:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
