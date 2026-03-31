import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const duplicates = await prisma.invoice.groupBy({
    by: ['ksefId'],
    _count: {
      ksefId: true
    },
    where: {
      ksefId: { not: null }
    },
    having: {
      ksefId: {
        _count: {
          gt: 1
        }
      }
    }
  })

  console.log("Znalezione duplikaty ksefId:", JSON.stringify(duplicates, null, 2))

  if (duplicates.length > 0) {
    for (const dup of duplicates) {
      const records = await prisma.invoice.findMany({
        where: { ksefId: dup.ksefId },
        orderBy: { createdAt: 'asc' }
      })
      console.log(`Faktura ksefId: ${dup.ksefId} ma ${records.length} wpisów.`)
      // Keep the first one, delete others
      const idsToDelete = records.slice(1).map(r => r.id)
      console.log(`Planowane usunięcie ID:`, idsToDelete)
    }
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
