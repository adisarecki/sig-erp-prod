import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
    const tenant = await prisma.tenant.findFirst()
    if (!tenant) {
        console.log("No tenant found. Creating default tenant...")
        await prisma.tenant.create({
            data: {
                name: "Moja Firma",
                nip: "1234567890"
            }
        })
        console.log("Default tenant created.")
    } else {
        console.log(`Tenant exists: ${tenant.name}`)
    }
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
