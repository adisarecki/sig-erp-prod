import prisma from "../src/lib/prisma";

async function main() {
  const projectIds = [
    'A2wopUYrVdjLFj4KXZw3', // Kopalnia MARCEL
    'e6ec6804-4458-496d-991c-fee2680c760c6' // Nowowiejskiego 2
  ];

  console.log('--- PURGE STARTED ---');

  // 1. Delete LedgerEntries
  const ledgerDel = await prisma.ledgerEntry.deleteMany({
    where: {
      projectId: { in: projectIds }
    }
  });
  console.log(`Deleted ${ledgerDel.count} LedgerEntries.`);

  // 2. Identify KsefInvoices linked via Invoices
  const invoices = await prisma.invoice.findMany({
    where: { projectId: { in: projectIds } },
    select: { ksefId: true }
  });
  const ksefIds = invoices.map(inv => inv.ksefId).filter(Boolean) as string[];

  if (ksefIds.length > 0) {
    const ksefDel = await prisma.ksefInvoice.deleteMany({
      where: { ksefNumber: { in: ksefIds } }
    });
    console.log(`Deleted ${ksefDel.count} KsefInvoices.`);
  } else {
      console.log('No KsefInvoices found linked to these projects.');
  }

  // 3. User also mentioned "Wipe the test data from LedgerEntry" in a general sense
  // but then specified projects. I'll stick to projects to be safe.

  console.log('--- PURGE COMPLETED ---');
}

main().catch(console.error);
