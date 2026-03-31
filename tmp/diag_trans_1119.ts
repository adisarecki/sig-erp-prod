import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const transactions = await (prisma as any).transaction.findMany({
    where: {
      amount: 1119
    }
  })

  console.log("Transactions with amount 1119:", JSON.stringify(transactions, null, 2))
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
