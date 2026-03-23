
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDemetrixNew() {
  try {
    const c = await prisma.contractor.findFirst({
      where: { name: { contains: 'DEMETRIX', mode: 'insensitive' } },
      include: { invoices: true }
    });

    if (!c) {
      console.log("DEMETRIX not found");
      return;
    }

    console.log("Contractor Found:", c.name, "(ID:", c.id, ")");
    console.log("Total Invoices:", c.invoices.length);
    c.invoices.forEach(inv => {
      console.log(`- EXT_ID: ${inv.externalId || 'N/A'}, TYPE: ${inv.type}, STATUS: ${inv.status}, GROSS: ${inv.amountGross}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkDemetrixNew();
