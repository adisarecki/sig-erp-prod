import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId: 'bb5e0e73-2c99-4389-ac93-6d0f71c89f88'
    },
    select: {
        id: true,
        invoiceNumber: true,
        amountGross: true,
        ksefId: true,
        status: true,
        paymentStatus: true,
        type: true
    }
  })

  console.log("All Invoices for Tenant:", JSON.stringify(invoices, null, 2))
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
