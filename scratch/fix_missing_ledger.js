const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const Decimal = require('decimal.js');

// Helper to simulate recordInvoiceToLedger logic if import fails in script environment
// or we can just implement the same logic here to be safe and standalone.
async function repair() {
  const invoices = await prisma.invoice.findMany({
    where: {
      paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
      status: { in: ['ACTIVE', 'XML_MISSING', 'PENDING'] }
    }
  });

  console.log(`Checking ${invoices.length} invoices for missing ledger entries...`);

  for (const inv of invoices) {
    const entries = await prisma.ledgerEntry.findMany({
      where: { sourceId: inv.id, source: 'INVOICE' }
    });

    if (entries.length === 0) {
      console.log(`REPAIRING: Invoice ${inv.invoiceNumber || inv.id} (Type: ${inv.type})`);
      
      const isIncome = ['INCOME', 'SPRZEDAŻ', 'REVENUE'].includes(inv.type);
      const amountNet = new Decimal(String(inv.amountNet));
      const amountGross = new Decimal(String(inv.amountGross));
      const vatAmount = amountGross.minus(amountNet);
      const retainedAmount = inv.retainedAmount ? new Decimal(String(inv.retainedAmount)) : null;

      const tenantId = inv.tenantId;
      const projectId = inv.projectId;
      const date = inv.issueDate;

      await prisma.$transaction(async (tx) => {
        // [VECTOR 160.1] Implementation logic mirrored from ledger-manager.ts
        
        // 1. Net Entry
        await tx.ledgerEntry.create({
          data: {
            tenantId,
            projectId,
            source: 'INVOICE',
            sourceId: inv.id,
            amount: isIncome ? amountNet.abs() : amountNet.abs().neg(),
            type: isIncome ? 'INCOME' : 'EXPENSE',
            date
          }
        });

        // 2. VAT Entry
        const vatSignMultiplier = isIncome ? -1 : 1;
        await tx.ledgerEntry.create({
          data: {
            tenantId,
            projectId,
            source: 'INVOICE',
            sourceId: inv.id,
            amount: vatAmount.abs().mul(vatSignMultiplier),
            type: 'VAT_SHIELD',
            date
          }
        });

        // 3. Retention Entry
        if (retainedAmount && retainedAmount.gt(0)) {
          await tx.ledgerEntry.create({
            data: {
              tenantId,
              projectId,
              source: 'INVOICE',
              sourceId: inv.id,
              amount: retainedAmount.abs(),
              type: 'RETENTION_LOCK',
              date
            }
          });
        }
      });
      console.log(`SUCCESS: Created ledger entries for ${inv.invoiceNumber || inv.id}`);
    }
  }
}

repair()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
