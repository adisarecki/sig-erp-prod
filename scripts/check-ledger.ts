import prisma from "../src/lib/prisma";

async function main() {
  const count = await prisma.ledgerEntry.count();
  console.log(`Total LedgerEntries: ${count}`);
  
  const groups = await prisma.ledgerEntry.groupBy({
    by: ['projectId'],
    _count: true
  });
  console.log('Groups by projectId:', JSON.stringify(groups, null, 2));

  const sample = await prisma.ledgerEntry.findMany({
    take: 5
  });
  console.log('Sample Entries:', JSON.stringify(sample, null, 2));
}

main().catch(console.error);
