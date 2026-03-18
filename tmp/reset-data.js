const { PrismaClient } = require("@prisma/client")
const fs = require("fs")
const path = require("path")

const logFile = path.join(__dirname, "reset.log")
function log(msg) {
  console.log(msg)
  fs.appendFileSync(logFile, msg + "\n")
}

async function reset() {
  if (fs.existsSync(logFile)) fs.unlinkSync(logFile)

  const prisma = new PrismaClient()

  try {
    let tenantId = "dev-tenant-id"
    const tenant = await prisma.tenant.findFirst()
    if (tenant) {
      tenantId = tenant.id
    }

    log(`[RESET] Rozpoczynam BRUTALNE czyszczenie danych dla tenanta: ${tenantId}...`)

    // Helper do usuwania
    const runDelete = async (table, whereClause = "") => {
      try {
        const sql = `DELETE FROM "${table}" ${whereClause}`
        log(`- Wykonuję: ${sql}`)
        const count = await prisma.$executeRawUnsafe(sql)
        log(`  Sukces, usunięto rekordów: ${count}`)
      } catch (e) {
        log(`  POMINIĘTO: Tabela "${table}" nie istnieje lub błąd: ${e.message.split("\n")[0]}`)
      }
    }

    // Kolejność usuwania (z zachowaniem integralności)

    // 1. Płatności (zależne od faktur i transakcji)
    await runDelete("InvoicePayment", `WHERE "invoiceId" IN (SELECT id FROM "Invoice" WHERE "tenantId" = '${tenantId}')`)
    await runDelete("Payment", `WHERE "invoiceId" IN (SELECT id FROM "Invoice" WHERE "tenantId" = '${tenantId}')`)

    // 2. Faktury i Transakcje
    await runDelete("Invoice", `WHERE "tenantId" = '${tenantId}'`)
    await runDelete("Transaction", `WHERE "tenantId" = '${tenantId}'`)

    // 3. Etapy projektów
    await runDelete("ProjectStage", `WHERE "projectId" IN (SELECT id FROM "Project" WHERE "tenantId" = '${tenantId}')`)

    // 4. Projekty
    await runDelete("Project", `WHERE "tenantId" = '${tenantId}'`)

    // 5. Kontakty i Obiekty kontrahentów
    await runDelete("Contact", `WHERE "contractorId" IN (SELECT id FROM "Contractor" WHERE "tenantId" = '${tenantId}')`)
    await runDelete("Object", `WHERE "contractorId" IN (SELECT id FROM "Contractor" WHERE "tenantId" = '${tenantId}')`)

    // 6. Kontrahenci
    await runDelete("Contractor", `WHERE "tenantId" = '${tenantId}'`)

    // 7. Reszta (Liability, Bank, Logs)
    await runDelete("Liability", `WHERE "tenantId" = '${tenantId}'`)
    await runDelete("BankTransactionRaw", `WHERE "tenantId" = '${tenantId}'`)
    await runDelete("AuditLog", `WHERE "tenantId" = '${tenantId}'`)

    log("[RESET] Sukces! Baza danych została wyczyszczona dla Twojego tenanta.")
  } catch (error) {
    log("[RESET] BŁĄD krytyczny: " + error.message)
    if (error.stack) log(error.stack)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

reset()
