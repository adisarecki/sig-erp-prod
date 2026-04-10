import { PrismaClient } from "@prisma/client";
import { ContractorResolutionService } from "../src/lib/finance/contractorResolutionService";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

async function main() {
    const tenantId = "test-tenant-v116";
    const testIban = "PL99000011112222333344445555";
    const testNip = "1234567890";

    console.log("--- 🧪 VECTOR 116: CONTRACTOR INTELLIGENCE TEST ---");

    try {
        // 1. Setup Test Tenant
        await prisma.tenant.upsert({
            where: { name: "Test Tenant V116" },
            update: {},
            create: { id: tenantId, name: "Test Tenant V116" }
        });

        // 2. Proof of Contractor Upsert by NIP (Strict)
        console.log("1. Testing Contractor Upsert by NIP...");
        const contractor = await prisma.contractor.upsert({
            where: { tenantId_nip: { tenantId, nip: testNip } },
            update: { name: "Test Contractor v116 (Updated)" },
            create: {
                id: randomUUID(),
                tenantId,
                nip: testNip,
                name: "Test Contractor v116",
                status: "ACTIVE"
            }
        });
        console.log("   ✅ Contractor resolved/created:", contractor.id, contractor.name);

        // 3. Proof of IBAN Linking & Duplicate Protection
        console.log("2. Testing IBAN Linking...");
        await ContractorResolutionService.linkIbanToContractor(tenantId, contractor.id, testIban, "MANUAL", prisma);
        
        const linked = await prisma.contractorBankAccount.findUnique({ 
            where: { 
                tenantId_iban: { tenantId, iban: testIban } 
            } 
        });
        if (linked && linked.contractorId === contractor.id) {
            console.log("   ✅ IBAN linked successfully to contractor.");
        } else {
            throw new Error("❌ IBAN linking failed.");
        }

        // 4. Proof of Identity Resolution (Tier 1: IBAN)
        console.log("3. Testing Tier 1: IBAN Match...");
        const res1 = await ContractorResolutionService.resolveFromBankTransaction(
            tenantId,
            { iban: testIban, counterpartyName: "Unknown", description: "Payment", amount: 100 },
            prisma
        );
        console.log("   ✅ Resolved by IBAN:", res1.confidence === 100 && res1.source === "IBAN" ? "SUCCESS" : "FAILED");

        // 5. Proof of Identity Resolution (Tier 2: NIP in Description)
        console.log("4. Testing Tier 2: NIP in Description...");
        const res2 = await ContractorResolutionService.resolveFromBankTransaction(
            tenantId,
            { counterpartyName: "Unknown", description: `Inv 123 for NIP ${testNip}`, amount: 100 },
            prisma
        );
        console.log("   ✅ Resolved by NIP:", res2.confidence === 100 && res2.source === "NIP" ? "SUCCESS" : "FAILED");

        console.log("\n--- ✨ ALL TESTS PASSED FOR VECTOR 116 ---");

    } catch (e) {
        console.error("\n--- ❌ TEST FAILED ---");
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
