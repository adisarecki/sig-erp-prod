-- CreateEnum
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BankAccountSource') THEN
    CREATE TYPE "BankAccountSource" AS ENUM ('KSEF', 'BANK_MATCH', 'MANUAL');
END IF;

-- CreateTable: ContractorBankAccount (Hardened with Tenant Scope)
CREATE TABLE IF NOT EXISTS "ContractorBankAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "source" "BankAccountSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable: IdentityConflictRecord (Conflict Protocol)
CREATE TABLE IF NOT EXISTS "IdentityConflictRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "detectedContractorId" TEXT NOT NULL,
    "existingContractorId" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityConflictRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX IF NOT EXISTS "ContractorBankAccount_tenantId_iban_key" ON "ContractorBankAccount"("tenantId", "iban");
CREATE INDEX IF NOT EXISTS "ContractorBankAccount_tenantId_idx" ON "ContractorBankAccount"("tenantId");
CREATE INDEX IF NOT EXISTS "ContractorBankAccount_contractorId_idx" ON "ContractorBankAccount"("contractorId");
CREATE INDEX IF NOT EXISTS "IdentityConflictRecord_tenantId_idx" ON "IdentityConflictRecord"("tenantId");
CREATE INDEX IF NOT EXISTS "IdentityConflictRecord_iban_idx" ON "IdentityConflictRecord"("iban");

-- AddForeignKeys
ALTER TABLE "ContractorBankAccount" ADD CONSTRAINT "ContractorBankAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContractorBankAccount" ADD CONSTRAINT "ContractorBankAccount_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IdentityConflictRecord" ADD CONSTRAINT "IdentityConflictRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
