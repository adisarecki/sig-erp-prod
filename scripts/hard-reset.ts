import prisma from "../src/lib/prisma";

async function hardReset() {
    console.log("⚠️ PHASE 0.1: DATABASE HARD RESET (Stabilization Protocol)");
    
    try {
        // Truncate tables in order to respect constraints if any
        // Order: Linked payments/inbox first, then Invoices and Transactions
        console.log("📝 Truncating InvoicePayment...");
        await prisma.invoicePayment.deleteMany({});
        
        console.log("📝 Truncating BankInbox...");
        await (prisma as any).bankInbox.deleteMany({});
        
        console.log("📝 Truncating KsefInvoice...");
        await prisma.ksefInvoice.deleteMany({});
        
        console.log("📝 Truncating Invoice...");
        await prisma.invoice.deleteMany({});
        
        console.log("📝 Truncating Transaction...");
        await prisma.transaction.deleteMany({});

        console.log("✅ Hard Reset Completed Successfully.");
        console.log("🛡️ Contractors and Projects preserved (Marcel, Demetrix).");
    } catch (error) {
        console.error("❌ Hard Reset Failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

hardReset();
