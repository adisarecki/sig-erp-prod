import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const invoices = await prisma.invoice.findMany({
    where: {
      amountGross: 1119
    },
    include: {
        contractor: true
    }
  })

  console.log("Invoices with amount 1119:", JSON.stringify(invoices, null, 2))
  
  const allKsef = await prisma.invoice.findMany({
      where: { ksefId: { not: null } },
      select: { ksefId: true, invoiceNumber: true, id: true }
  })
  console.log("All KSeF IDs in DB:", allKsef)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
