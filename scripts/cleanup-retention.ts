import prisma from "../src/lib/prisma"
import { getAdminDb } from "../src/lib/firebaseAdmin"
import Decimal from "decimal.js"

// Mock tenantId for manual script run or fetch from env
const tenantId = process.env.TENANT_ID || "default-tenant-id"

async function cleanup() {
    console.log("Starting Retention Cleanup Script...")
    const adminDb = getAdminDb()

    // 1. Ledger Entries
    const allInvoices = await prisma.invoice.findMany({
        where: { tenantId },
        select: { id: true }
    })
    const validInvoiceIds = new Set(allInvoices.map(i => i.id))

    const ghostLedgerEntries = await prisma.ledgerEntry.findMany({
        where: {
            tenantId,
            type: 'RETENTION_LOCK'
        }
    })

    const entriesToDelete = ghostLedgerEntries.filter(e => !validInvoiceIds.has(e.sourceId))
    
    if (entriesToDelete.length > 0) {
        console.log(`Deleting ${entriesToDelete.length} ghost ledger entries...`)
        await prisma.ledgerEntry.deleteMany({
            where: { id: { in: entriesToDelete.map(e => e.id) } }
        })
    }

    // 2. Retention Records
    // Delete anything with source: PROJECT correctly
    const retentionsToDelete = await (prisma as any).retention.findMany({
        where: {
            tenantId,
            OR: [
                { source: "PROJECT" },
                { invoiceId: null }
            ]
        }
    })

    if (retentionsToDelete.length > 0) {
        console.log(`Deleting ${retentionsToDelete.length} ghost retention records...`)
        const batch = adminDb.batch()
        for (const ret of retentionsToDelete) {
            batch.delete(adminDb.collection("retentions").doc(ret.id))
        }
        await batch.commit()

        await (prisma as any).retention.deleteMany({
            where: { id: { in: retentionsToDelete.map((r: any) => r.id) } }
        })
    }

    console.log("Cleanup completed successfully.")
}

cleanup().catch(console.error)
