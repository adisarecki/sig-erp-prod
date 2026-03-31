import { PrismaClient } from '@prisma/client'
import { getAdminDb, initFirebaseAdmin } from '../src/lib/firebaseAdmin'
import Decimal from 'decimal.js'

const prisma = new PrismaClient()

async function main() {
  console.log("🚀 [OPERATION_CLEAN_CASH_2.0] Integrity Restoration Initiated...")

  const tenantId = 'bb5e0e73-2c99-4389-ac93-6d0f71c89f88' // Sig ERP
  
  // 1. Audit Invoices in Database
  const allInvoices = await prisma.invoice.findMany({
    where: { tenantId }
  })

  const duplicatesByKsefId: string[] = []
  const duplicatesByLegacy: string[] = []
  const seenKsef = new Set<string>()
  const seenLegacy = new Set<string>()

  for (const inv of allInvoices) {
    if (inv.ksefId) {
        if (seenKsef.has(inv.ksefId)) {
            duplicatesByKsefId.push(inv.id)
        } else {
            seenKsef.add(inv.ksefId)
        }
    } else {
        // Legacy/Manual duplicate check: Contractor + Amount + Date
        const sig = `${inv.contractorId}-${inv.amountGross.toString()}-${inv.issueDate.toISOString().split('T')[0]}`
        if (seenLegacy.has(sig)) {
            duplicatesByLegacy.push(inv.id)
        } else {
            seenLegacy.add(sig)
        }
    }
  }

  const allDupIds = [...duplicatesByKsefId, ...duplicatesByLegacy]

  if (allDupIds.length === 0) {
    console.log("✅ [CLEANUP] Prisma database is clean. No duplicates found.")
  } else {
    console.log(`🧹 [CLEANUP] Found ${allDupIds.length} duplicate records. Purging...`)
    for (const id of allDupIds) {
      await prisma.invoice.delete({ where: { id } })
      console.log(`[SUCCESS] Removed Prisma Invoice: ${id}`)
    }
  }

  // 2. Sync with Firestore (if credentials available)
  try {
      console.log("🕵️ [CLEANUP] Syncing Firestore state...")
      const db = getAdminDb()
      
      for (const id of allDupIds) {
          await db.collection("invoices").doc(id).delete()
          console.log(`[SUCCESS] Removed Firestore Shadow: ${id}`)
      }

      // Check for Orphans in Firestore
      const fsSnap = await db.collection("invoices").where("tenantId", "==", tenantId).get()
      for (const doc of fsSnap.docs) {
          const stillInPrisma = await prisma.invoice.findUnique({ where: { id: doc.id } })
          if (!stillInPrisma) {
              console.warn(`[ORPHAN] Found ghost in Firestore: ${doc.id}. Purging now.`)
              await doc.ref.delete()
          }
      }
      console.log("✅ [CLEANUP] Firestore sync complete.")
  } catch (err) {
      console.warn("⚠️ [CLEANUP] Firestore skip: Missing Admin SDK credentials (Check Vercel env).")
  }

  console.log("🏁 [OPERATION_CLEAN_CASH_2.0] Restore Success. Dashboard health calibrated.")
}

main()
  .catch(e => {
    console.error("❌ [FATAL]", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
