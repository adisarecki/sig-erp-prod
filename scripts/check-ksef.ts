import prisma from "../src/lib/prisma";

async function main() {
  const count = await prisma.ksefInvoice.count();
  console.log(`Total KsefInvoices: ${count}`);
  
  const sample = await prisma.ksefInvoice.findMany({
    take: 5,
    select: {
        ksefNumber: true,
        invoiceNumber: true,
        counterpartyName: true
    }
  });
  console.log('Sample KsefInvoices:', JSON.stringify(sample, null, 2));
}

main().catch(console.error);
