const { getFinancialSnapshot } = require('../src/lib/finance/ledger-service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  const tenantId = 'bb5e0e73-2c99-4389-ac93-6d0f71c89f88';
  console.log('Running Final Verification for Tenant:', tenantId);
  
  const snapshot = await getFinancialSnapshot(tenantId);
  console.log('Snapshot Result:');
  console.log(' - Unpaid Receivables:', snapshot.unpaidReceivables.toString());
  console.log(' - Unpaid Payables:', snapshot.unpaidPayables.toString());

  // Check the specifically repaired invoice
  const invoice = await prisma.invoice.findFirst({
    where: { invoiceNumber: 'FV 1/04/2026' },
    include: { contractor: true }
  });
  
  if (invoice) {
    console.log('\nRepaired Invoice Details:');
    console.log(' - Number:', invoice.invoiceNumber);
    console.log(' - Status:', invoice.status);
    console.log(' - PaymentStatus:', invoice.paymentStatus);
    console.log(' - Gross Value:', invoice.amountGross);
    
    const entries = await prisma.ledgerEntry.findMany({
      where: { sourceId: invoice.id }
    });
    console.log(' - Ledger Entries Count:', entries.length);
    entries.forEach(e => {
      console.log(`   * [${e.type}] ${e.amount}`);
    });
  }
}

verify().catch(console.error).finally(() => prisma.$disconnect());
