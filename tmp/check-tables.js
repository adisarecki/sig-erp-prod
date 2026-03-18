const { PrismaClient } = require("@prisma/client")
const fs = require("fs")
const path = require("path")

const logFile = path.join(__dirname, "tables.log")
function log(msg) {
  console.log(msg)
  fs.appendFileSync(logFile, msg + "\n")
}

async function checkTables() {
  if (fs.existsSync(logFile)) fs.unlinkSync(logFile)
  
  const prisma = new PrismaClient()
  
  try {
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `
    log("Tabele w bazie: " + JSON.stringify(tables, null, 2))
  } catch (error) {
    log("BŁĄD: " + error.message)
    if (error.stack) log(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

checkTables()
