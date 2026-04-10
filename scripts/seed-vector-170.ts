import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
    console.log("Starting Vector 170 Seed...")
    
    // Get primary tenant
    const tenant = await prisma.tenant.findFirst()
    if (!tenant) {
        throw new Error("No tenant found. Please run ensure-tenant.ts first.")
    }

    console.log(`Seeding for tenant: ${tenant.name} (${tenant.id})`)

    const vehicles = [
        {
            make: "Dacia",
            model: "Dokker",
            plates: "WE452YS",
            status: "ACTIVE",
            notes: "Flota - Vector 170 Stage 1"
        },
        {
            make: "Peugeot",
            model: "Traveller",
            plates: "SK932SK",
            status: "ACTIVE",
            notes: "Flota - Vector 170 Stage 1"
        }
    ]

    for (const vData of vehicles) {
        const vehicle = await prisma.vehicle.upsert({
            where: { plates: vData.plates },
            update: { ...vData },
            create: {
                tenantId: tenant.id,
                ...vData
            }
        })
        console.log(`✅ Vehicle seeded/updated: ${vehicle.make} ${vehicle.model} (${vehicle.plates})`)
    }

    console.log("Vector 170 Seed complete.")
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
