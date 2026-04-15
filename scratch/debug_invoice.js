const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const invoice = await prisma.invoice.findFirst({
    where: {
      OR: [
        { invoiceNumber: { contains: '1/04/2026' } },
        { externalId: { contains: '1/04/2026' } }
      ]
    },
    include: {
      contractor: true
    }
  });

  console.log('Invoice found:', JSON.stringify(invoice, null, 2));

  if (invoice) {
    const entries = await prisma.ledgerEntry.findMany({
      where: { sourceId: invoice.id }
    });
    console.log('Ledger entries:', JSON.stringify(entries, null, 2));

    const totalNet = entries
      .filter(e => e.type === 'INCOME')
      .reduce((sum, e) => sum + Number(e.amount), 0);
    
    const totalVat = entries
      .filter(e => e.type === 'VAT_SHIELD')
      .reduce((sum, e) => sum + Number(e.amount), 0);

    console.log('Ledger Net Sum:', totalNet);
    console.log('Ledger VAT Sum:', totalVat);
  } else {
    console.log('Invoice not found by 1/04/2026. Checking all income invoices...');
    const allIncome = await prisma.invoice.findMany({
      where: { type: { in: ['INCOME', 'SPRZEDAŻ', 'REVENUE'] } },
      take: 10,
      orderBy: { issueDate: 'desc' }
    });
    console.log('Recent Income Invoices:', JSON.stringify(allIncome.map(inv => ({ id: inv.id, num: inv.invoiceNumber || inv.externalId, status: inv.status, paymentStatus: inv.paymentStatus, gross: inv.amountGross })), null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
