const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const Decimal = require('decimal.js');

async function getFinancialSnapshot(tenantId) {
  const db = prisma;

  // 1. Unrealized Invoices — split into Receivables vs Payables
  const unpaidInvoices = await prisma.invoice.findMany({
    where: { tenantId, paymentStatus: 'UNPAID', status: 'ACTIVE' }
  });

  const SALES_TYPES = new Set(['SPRZEDAŻ', 'INCOME', 'REVENUE']);
  const COST_TYPES  = new Set(['ZAKUP', 'EXPENSE', 'COST', 'KSeF_PURCHASE']);

  // Receivables: money we will RECEIVE — positive (+)
  const unpaidReceivables = unpaidInvoices
    .filter((inv) => SALES_TYPES.has(inv.type))
    .reduce((sum, inv) => {
      const gross = new Decimal(String(inv.amountGross || 0));
      const retention = new Decimal(String(inv.retainedAmount || 0));
      return sum.plus(gross.minus(retention));
    }, new Decimal(0));

  return { unpaidReceivables };
}

async function main() {
  const tenantId = 'bb5e0e73-2c99-4389-ac93-6d0f71c89f88';
  const snapshot = await getFinancialSnapshot(tenantId);
  console.log('Snapshot Unpaid Receivables:', snapshot.unpaidReceivables.toString());
  
  const allInvoices = await prisma.invoice.findMany({ where: { tenantId } });
  console.log('All invoices count:', allInvoices.length);
  console.log('Invoice types:', [...new Set(allInvoices.map(i => i.type))]);
  console.log('Invoice paymentStatuses:', [...new Set(allInvoices.map(i => i.paymentStatus))]);
  console.log('Invoice statuses:', [...new Set(allInvoices.map(i => i.status))]);
}

main().catch(console.error).finally(() => prisma.$disconnect());
