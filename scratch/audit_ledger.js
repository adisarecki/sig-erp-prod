
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function audit() {
  console.log('--- STARTING FINANCIAL AUDIT ---');
  
  const entries = await prisma.ledgerEntry.findMany();
  const invoices = await prisma.invoice.findMany({ select: { id: true, invoiceNumber: true, externalId: true } });
  const invoiceIds = new Set(invoices.map(i => i.id));
  
  const transactions = await prisma.transaction.findMany({ select: { id: true } });
  const transactionIds = new Set(transactions.map(t => t.id));

  const bankTransactions = await prisma.bankTransactionRaw.findMany({ select: { id: true } });
  const bankIds = new Set(bankTransactions.map(b => b.id));

  console.log(`Total Ledger Entries: ${entries.length}`);
  console.log(`Total Invoices: ${invoices.length}`);
  
  const orphans = entries.filter(e => {
    if (e.source === 'INVOICE') return !invoiceIds.has(e.sourceId);
    if (e.source === 'BANK_PAYMENT' || e.source === 'SHADOW_COST') return !transactionIds.has(e.sourceId);
    return false;
  });

  if (orphans.length === 0) {
    console.log('✅ No orphan entries found based on SourceId mapping.');
  } else {
    console.log(`❌ Found ${orphans.length} ORPHAN entries:`);
    orphans.forEach(o => {
      console.log(`[ORPHAN] ID: ${o.id} | Source: ${o.source} | SourceId: ${o.sourceId} | Amount: ${o.amount} | Type: ${o.type}`);
    });
  }

  // Check for 10,000 PLN entry specifically as mentioned by user
  const matchingEntries = entries.filter(e => Math.abs(Number(e.amount)) === 10000);
  console.log(`\nEntries matching 10,000 PLN: ${matchingEntries.length}`);
  matchingEntries.forEach(e => {
    const exists = e.source === 'INVOICE' ? invoiceIds.has(e.sourceId) : transactionIds.has(e.sourceId);
     console.log(`ID: ${e.id} | Source: ${e.source} | SourceId: ${e.sourceId} | Exists: ${exists} | Type: ${e.type}`);
  });

  process.exit(0);
}

audit().catch(err => {
  console.error(err);
  process.exit(1);
});
