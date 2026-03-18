import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function nuclearReset() {
    console.log("☢️  EXECUING DEFINITIVE NUCLEAR RESET V4...")
    const tables = [
        '"Payment"', '"Transaction"', '"Invoice"', '"ProjectStage"',
        '"Project"', '"Object"', '"Contact"', '"Contractor"',
        '"BankTransactionRaw"', '"BankAccount"', '"Liability"', '"AuditLog"'
    ]
    try {
        for (const table of tables) {
            console.log(`Truncating ${table}...`)
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE;`)
        }
        console.log("✅ ALL TABLES TRUNCATED.")
        console.log("\n📊 Final Verification:")
        for (const table of tables) {
            const count: any = await prisma.$queryRawUnsafe(`SELECT count(*) FROM ${table};`)
            console.log(`${table}: ${count[0].count} records`)
        }
    } catch (e) {
        console.error("❌ ERROR DURING RESET:", e)
    } finally {
        await prisma.$disconnect()
    }
}
nuclearReset()
