import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const trans = await (prisma as any).transaction.findMany({
    where: {
      amount: 1119
    }
  })
  console.log("Transactions with amount 1119:", JSON.stringify(trans, null, 2))
  
  const inv = await prisma.invoice.findMany({
      where: { amountGross: 1119 }
  })
  console.log("Invoices with amount 1119:", JSON.stringify(inv, null, 2))
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
