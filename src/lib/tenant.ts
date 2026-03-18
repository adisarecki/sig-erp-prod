import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

/**
 * getCurrentTenantId
 * 
 * Centralized utility to get the current tenant ID.
 * DEV BYPASS: Falls back to 'dev-tenant-id' if no tenant is found in the database.
 * This unblocks development and testing in environments without a seeded database.
 */
export async function getCurrentTenantId() {
  try {
    const tenant = await prisma.tenant.findFirst()
    if (!tenant) {
      // PROD WARNING: In production, this should likely throw or handle session-based lookup.
      // For now, it unblocks development as requested by the CEO.
      return "dev-tenant-id"
    }
    return tenant.id
  } catch (error) {
    console.warn("[TenantUtility] Error fetching tenant, falling back to dev-tenant-id", error)
    return "dev-tenant-id"
  }
}
