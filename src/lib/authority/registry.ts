/**
 * [VECTOR 109] Data Authority Registry
 * Defines the Absolute Source of Truth (SSoT) for each domain.
 */

export type DataDomain = 
  | 'FINANCIAL'          // Absolute Truth: PostgreSQL (LedgerEntry)
  | 'OPERATIONAL_ASSET'  // Operational state: Firestore (Registry, Vehicle Info)
  | 'KSEF_METADATA'      // Authority: External KSeF XML
  | 'BANK_RECONCILIATION'// Authority: External Bank Statement
  | 'CONTRACTOR'         // Master: PostgreSQL (Prisma)
  | 'PROJECT'            // Master: PostgreSQL (Prisma)

export type AuthoritySide = 'POSTGRES' | 'FIRESTORE' | 'EXTERNAL'

export type WriteFlow = 
  | 'PG_TO_FS'           // Postgres is authority, sync to Firestore
  | 'FS_TO_PG'           // Firestore is authority, sync to Postgres
  | 'EXT_TO_INT'         // External is authority, sync to both

export interface DomainAuthorityConfig {
  domain: DataDomain
  primaryAuthority: AuthoritySide
  writeFlow: WriteFlow
  reconciliationPolicy: 'AUTO_REPAIR_FROM_PRIMARY' | 'MANUAL_REVIEW' | 'CANONICAL_FORCE'
}

export const AUTHORITY_REGISTRY: Record<DataDomain, DomainAuthorityConfig> = {
  FINANCIAL: {
    domain: 'FINANCIAL',
    primaryAuthority: 'POSTGRES',
    writeFlow: 'PG_TO_FS',
    reconciliationPolicy: 'AUTO_REPAIR_FROM_PRIMARY'
  },
  OPERATIONAL_ASSET: {
    domain: 'OPERATIONAL_ASSET',
    primaryAuthority: 'FIRESTORE',
    writeFlow: 'FS_TO_PG',
    reconciliationPolicy: 'MANUAL_REVIEW'
  },
  KSEF_METADATA: {
    domain: 'KSEF_METADATA',
    primaryAuthority: 'EXTERNAL',
    writeFlow: 'EXT_TO_INT',
    reconciliationPolicy: 'CANONICAL_FORCE'
  },
  BANK_RECONCILIATION: {
    domain: 'BANK_RECONCILIATION',
    primaryAuthority: 'EXTERNAL',
    writeFlow: 'EXT_TO_INT',
    reconciliationPolicy: 'CANONICAL_FORCE'
  },
  CONTRACTOR: {
    domain: 'CONTRACTOR',
    primaryAuthority: 'POSTGRES',
    writeFlow: 'PG_TO_FS',
    reconciliationPolicy: 'AUTO_REPAIR_FROM_PRIMARY'
  },
  PROJECT: {
    domain: 'PROJECT',
    primaryAuthority: 'POSTGRES',
    writeFlow: 'PG_TO_FS',
    reconciliationPolicy: 'AUTO_REPAIR_FROM_PRIMARY'
  }
}

/**
 * Returns the configured authority for a given domain.
 */
export function getDomainAuthority(domain: DataDomain): DomainAuthorityConfig {
  return AUTHORITY_REGISTRY[domain]
}
