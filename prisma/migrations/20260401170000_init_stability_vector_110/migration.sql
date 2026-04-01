-- CreateEnum
CREATE TYPE "KsefInvoiceStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AssetSourceType" AS ENUM ('KSEF_LINKED', 'MANUAL');

-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('vehicle', 'tool', 'it', 'equipment');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DAMAGED', 'SOLD');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('IN_SYNC', 'MISSING_IN_FIRESTORE', 'MISSING_IN_POSTGRES', 'FIELD_MISMATCH', 'SYNC_ERROR', 'PENDING_RESYNC');

-- CreateEnum
CREATE TYPE "SyncDirection" AS ENUM ('PG_TO_FS', 'FS_TO_PG', 'MANUAL_MERGE');

-- CreateEnum
CREATE TYPE "LedgerSource" AS ENUM ('INVOICE', 'BANK_PAYMENT', 'SHADOW_COST');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('INCOME', 'EXPENSE', 'VAT_SHIELD', 'RETENTION_LOCK');

-- CreateEnum
CREATE TYPE "DataDomain" AS ENUM ('FINANCIAL', 'OPERATIONAL_ASSET', 'KSEF_METADATA', 'BANK_RECONCILIATION', 'CONTRACTOR', 'PROJECT');

-- CreateEnum
CREATE TYPE "AuthoritySide" AS ENUM ('POSTGRES', 'FIRESTORE', 'EXTERNAL');

-- CreateTable (BankBalanceState)
CREATE TABLE "BankBalanceState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "verifiedBalance" DECIMAL(12,2) NOT NULL,
    "verificationTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankBalanceState_pkey" PRIMARY KEY ("id")
);

-- CreateTable (LedgerEntry)
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT,
    "source" "LedgerSource" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "type" "LedgerType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable (Asset)
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceType" "AssetSourceType" NOT NULL DEFAULT 'MANUAL',
    "sourceInvoiceId" TEXT,
    "sourceDocumentNumber" TEXT,
    "sourceDocumentDate" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "category" "AssetCategory" NOT NULL,
    "subcategory" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "registrationNumber" TEXT,
    "vin" TEXT,
    "insuranceEndDate" TIMESTAMP(3),
    "inspectionDate" TIMESTAMP(3),
    "mileage" INTEGER,
    "location" TEXT,
    "assignedTo" TEXT,
    "assignedProjectId" TEXT,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "purchaseNet" DECIMAL(12,2) NOT NULL,
    "purchaseGross" DECIMAL(12,2) NOT NULL,
    "vatAmount" DECIMAL(12,2) NOT NULL,
    "initialValue" DECIMAL(12,2) NOT NULL,
    "currentValue" DECIMAL(12,2) NOT NULL,
    "supplierId" TEXT,
    "warrantyEndDate" TIMESTAMP(3),
    "serviceDueDate" TIMESTAMP(3),
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "depreciationMethod" TEXT DEFAULT 'LINEAR',
    "depreciationRate" DECIMAL(5,4),
    "depreciationStartDate" TIMESTAMP(3),
    "monthlyDepreciation" DECIMAL(12,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable (SyncAuditRecord)
CREATE TABLE "SyncAuditRecord" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "domain" "DataDomain" NOT NULL DEFAULT 'FINANCIAL',
    "authoritySide" "AuthoritySide" NOT NULL DEFAULT 'POSTGRES',
    "syncStatus" "SyncStatus" NOT NULL,
    "diffFields" JSONB,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncDirection" "SyncDirection",
    "note" TEXT,

    CONSTRAINT "SyncAuditRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankBalanceState_tenantId_idx" ON "BankBalanceState"("tenantId");
CREATE INDEX "BankBalanceState_verificationTimestamp_idx" ON "BankBalanceState"("verificationTimestamp");

-- CreateIndex
CREATE INDEX "LedgerEntry_tenantId_idx" ON "LedgerEntry"("tenantId");
CREATE INDEX "LedgerEntry_projectId_idx" ON "LedgerEntry"("projectId");
CREATE INDEX "LedgerEntry_sourceId_idx" ON "LedgerEntry"("sourceId");
CREATE INDEX "LedgerEntry_type_idx" ON "LedgerEntry"("type");
CREATE INDEX "LedgerEntry_date_idx" ON "LedgerEntry"("date");

-- CreateIndex
CREATE INDEX "Asset_tenantId_idx" ON "Asset"("tenantId");
CREATE INDEX "Asset_status_idx" ON "Asset"("status");
CREATE INDEX "Asset_category_idx" ON "Asset"("category");
CREATE INDEX "Asset_sourceInvoiceId_idx" ON "Asset"("sourceInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncAuditRecord_entityType_entityId_key" ON "SyncAuditRecord"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "BankBalanceState" ADD CONSTRAINT "BankBalanceState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_sourceInvoiceId_fkey" FOREIGN KEY ("sourceInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_assignedProjectId_fkey" FOREIGN KEY ("assignedProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
