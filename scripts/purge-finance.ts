import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("🚀 Rozpoczynanie Operacji Czysta Kasa (Faza 0)...");

    try {
        // Usuwanie w kolejności uwzględniającej klucze obce
        console.log("🧹 Czyszczenie powiązań płatności...");
        await prisma.invoicePayment.deleteMany({});

        console.log("🧹 Czyszczenie rat długów...");
        await prisma.legacyDebtInstallment.deleteMany({});

        console.log("🧹 Czyszczenie długów historycznych...");
        await prisma.legacyDebt.deleteMany({});

        console.log("🧹 Czyszczenie zobowiązań...");
        await prisma.liability.deleteMany({});

        console.log("🧹 Czyszczenie kaucji gwarancyjnych...");
        await prisma.retention.deleteMany({});

        console.log("🧹 Czyszczenie surowych transakcji bankowych...");
        await prisma.bankTransactionRaw.deleteMany({});

        console.log("🧹 Czyszczenie transakcji...");
        await prisma.transaction.deleteMany({});

        console.log("🧹 Czyszczenie faktur...");
        await prisma.invoice.deleteMany({});

        console.log("🧹 Czyszczenie bufora KSeF (Inbox)...");
        await prisma.ksefInvoice.deleteMany({});

        console.log("🧹 Czyszczenie powiadomień...");
        await prisma.notification.deleteMany({});

        console.log("🧹 Czyszczenie zdarzeń procesowanych...");
        await prisma.processedEvent.deleteMany({});

        console.log("✨ Operacja zakończona sukcesem.");
        console.log("🛡️  Zachowano: Kontrahentów, Projekty, Obiekty oraz Konta Użytkowników.");
        
    } catch (error) {
        console.error("❌ Błąd podczas czyszczenia bazy:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
