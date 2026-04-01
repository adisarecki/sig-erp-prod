import prisma from "../src/lib/prisma";
import Decimal from "decimal.js";
import { PkoBpCsvAdapter } from "../src/lib/bank/pko-bp-adapter";
import { ReconciliationEngine } from "../src/lib/bank/reconciliation-engine";

async function verifyStabilization() {
    console.log("🔭 FINAL VERIFICATION: Master Stabilization Protocol");

    const tenant = await prisma.tenant.findFirst();
    if (!tenant) return console.error("No tenant found");
    const tenantId = tenant.id;

    const projectId = "general-test-project"; // Assuming a project exists or creating a dummy
    
    // Cleanup from previous runs to ensure idempotency
    const testInvNumbers = ["INV/T1/001", "INV/T1/DUP", "INV/T2/UNIQUE", "FV/MATCH/123"];
    
    await prisma.invoicePayment.deleteMany({
        where: { invoice: { invoiceNumber: { in: testInvNumbers } } }
    });

    await prisma.transaction.deleteMany({
        where: { description: { contains: "Automatyczne rozliczenie" } }
    });

    await prisma.invoice.deleteMany({
        where: {
            OR: [
                { ksefId: "TEST-KSEF-STABIL-001" },
                { invoiceNumber: { in: testInvNumbers } }
            ]
        }
    });

    await prisma.contractor.deleteMany({
        where: { nip: "1111111111" }
    });

    // @ts-ignore
    await prisma.bankInbox.deleteMany({
        where: { title: { in: ["Zapłata za FV/MATCH/123", "Składka ZUS kwiwieć", "Hot-dog"] } }
    });
    console.log("🛡️ Testing Tier 1 Shield (KSeF Id)...");
    const ksefId = "TEST-KSEF-STABIL-001";
    
    try {
        // First create contractor to avoid nested create issues with multi-tenancy scalars
        const c1 = await prisma.contractor.create({
            data: { tenantId, name: "Test Vendor Tier 1", nip: "1111111111", type: "DOSTAWCA" }
        });

        await prisma.invoice.create({
            data: {
                tenantId,
                contractorId: c1.id,
                type: "EXPENSE",
                amountNet: new Decimal(100),
                amountGross: new Decimal(123),
                taxRate: new Decimal(0.23),
                issueDate: new Date(),
                dueDate: new Date(),
                ksefId,
                invoiceNumber: "INV/T1/001"
            }
        });
        console.log("✅ Row 1 created.");

        // Attempt duplicate
        await prisma.invoice.create({
            data: {
                tenantId,
                contractorId: c1.id,
                type: "EXPENSE",
                amountNet: new Decimal(200),
                amountGross: new Decimal(246),
                taxRate: new Decimal(0.23),
                issueDate: new Date(),
                dueDate: new Date(),
                ksefId,
                invoiceNumber: "INV/T1/DUP"
            }
        });
    } catch (e: any) {
        if (e.code === 'P2002') console.log("✅ Tier 1 Shield SUCCESS: Blocked duplicate ksefId.");
        else console.error("❌ Tier 1 Shield FAILED:", e.message);
    }

    // 2. Double-Shield Tier 2 ([contractorId, invoiceNumber])
    console.log("🛡️ Testing Tier 2 Shield (Composite Key)...");
    const contractor = await prisma.contractor.findFirst({ where: { nip: "1111111111" } });
    const invoiceNumber = "INV/T2/UNIQUE";
    
    try {
        await prisma.invoice.create({
            data: {
                tenantId,
                contractorId: contractor!.id,
                type: "EXPENSE",
                amountNet: new Decimal(100),
                amountGross: new Decimal(123),
                taxRate: new Decimal(0.23),
                issueDate: new Date(),
                dueDate: new Date(),
                invoiceNumber
            }
        });
        console.log("✅ Row 2 created.");

        await prisma.invoice.create({
            data: {
                tenantId,
                contractorId: contractor!.id,
                type: "EXPENSE",
                amountNet: new Decimal(100),
                amountGross: new Decimal(123),
                taxRate: new Decimal(0.23),
                issueDate: new Date(),
                dueDate: new Date(),
                invoiceNumber
            }
        });
    } catch (e: any) {
        if (e.code === 'P2002') console.log("✅ Tier 2 Shield SUCCESS: Blocked duplicate [contractorId, invoiceNumber].");
        else console.error("❌ Tier 2 Shield FAILED:", e.message);
    }

    // 3. Bank Engine - Vector 104/105 (Auto-Match & Shadow Costs)
    console.log("🏦 Testing Bank Engine (Auto-Match & Shadow Costs)...");
    
    // Create another invoice to match
    const matchInvoice = await prisma.invoice.create({
        data: {
            tenantId,
            contractorId: contractor!.id,
            type: "EXPENSE",
            invoiceNumber: "FV/MATCH/123",
            amountNet: new Decimal(1000),
            amountGross: new Decimal(1230),
            taxRate: new Decimal(0.23),
            issueDate: new Date(),
            dueDate: new Date(),
            status: "ACTIVE",
            paymentStatus: "UNPAID"
        }
    });

    const csvContent = `Data operacji,Data waluty,Typ transakcji,Kwota,Waluta,Opis operacji,Rachunek odbiorcy,Nazwa odbiorcy,Tytuł
2026-04-01,2026-04-01,PRZELEW,-1230.00,PLN,Przelew,,Test Vendor Tier 1,Zapłata za FV/MATCH/123
2026-04-01,2026-04-01,PRZELEW,-50.00,PLN,Przelew,,ZUS,Składka ZUS kwiwieć
2026-04-01,2026-04-01,PRZELEW,-12.30,PLN,Karta,,Żabka,Hot-dog`;

    const bankTransactions = PkoBpCsvAdapter.parse(csvContent);
    for (const tx of bankTransactions) {
        // @ts-ignore - Prisma might still show lints in IDE but it will work
        await prisma.bankInbox.create({
            data: {
                tenantId,
                date: tx.date,
                amount: tx.amount,
                rawType: tx.rawType,
                counterpartyName: tx.counterpartyName,
                title: tx.title,
                status: 'NEW'
            }
        });
    }

    await ReconciliationEngine.processBankInbox(tenantId);

    const updatedInvoice = await prisma.invoice.findUnique({ where: { id: matchInvoice.id } });
    console.log(`📊 Auto-Match Result: Status = ${updatedInvoice?.status} (Expected: PAID)`);

    const shadowCosts = await prisma.transaction.findMany({
        where: { classification: "DirectExpense" }
    });
    console.log(`📊 Shadow Costs Result: Found ${shadowCosts.length} DirectExpense transactions (Expected: 2 - ZUS and Żabka)`);

    if (updatedInvoice?.status === 'PAID' && shadowCosts.length >= 2) {
        console.log("✨ MASTER STABILIZATION VERIFIED!");
    } else {
        console.log("❌ VERIFICATION FAILED.");
    }
}

verifyStabilization().catch(console.error).finally(() => prisma.$disconnect());
