const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenantId = 'bb5e0e73-2c99-4389-ac93-6d0f71c89f88'; // From previous debug
  const incomeEntries = await prisma.ledgerEntry.findMany({
    where: {
      tenantId,
      type: 'INCOME'
    }
  });

  console.log('Total INCOME Ledger Entries:', incomeEntries.length);
  console.log('Sum:', incomeEntries.reduce((sum, e) => sum + Number(e.amount), 0));
  
  const unpaidInvoices = await prisma.invoice.findMany({
    where: { tenantId, paymentStatus: 'UNPAID', status: 'ACTIVE', type: 'INCOME' }
  });
  console.log('Unpaid Income Invoices count:', unpaidInvoices.length);
  console.log('Unpaid Income Gross Sum:', unpaidInvoices.reduce((sum, inv) => sum + Number(inv.amountGross), 0));
}

main().catch(console.error).finally(() => prisma.$disconnect());
