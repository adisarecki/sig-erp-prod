import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Starting Hard Reset (Vector 098.3)...");
    
    // Ordered deletion to handle foreign keys
    await prisma.invoicePayment.deleteMany();
    console.log("✓ Deleted InvoicePayments");
    
    await prisma.retention.deleteMany();
    console.log("✓ Deleted Retentions");
    
    await prisma.invoice.deleteMany();
    console.log("✓ Deleted Invoices");
    
    await prisma.transaction.deleteMany();
    console.log("✓ Deleted Transactions");
    
    await prisma.ksefInvoice.deleteMany();
    console.log("✓ Deleted KSeF Inbox Buffer");
    
    console.log("Hard Reset Complete. Field is clean.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
