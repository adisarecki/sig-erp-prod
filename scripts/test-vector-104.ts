import prisma from "../src/lib/prisma";
import Decimal from "decimal.js";
import { PkoBpCsvAdapter } from "../src/lib/bank/pko-bp-adapter";
import { ReconciliationEngine } from "../src/lib/bank/reconciliation-engine";

async function test() {
    console.log("🚀 Testing Vector 104: PKO BP Reconciliation Engine");

    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
        console.error("❌ No tenant found. Create a tenant first.");
        return;
    }
    const tenantId = tenant.id;

    // 1. Create a mock contractor and invoice
    console.log("📝 Creating mock data...");
    const contractor = await prisma.contractor.create({
        data: {
            tenantId,
            name: "Budimex SA",
            nip: "5260007455",
            type: "DOSTAWCA"
        }
    });

    const invoice = await prisma.invoice.create({
        data: {
            tenantId,
            contractorId: contractor.id,
            invoiceNumber: "9/02/2026",
            amountNet: new Decimal("1000.00"),
            amountGross: new Decimal("1230.00"),
            taxRate: new Decimal("0.23"),
            issueDate: new Date("2026-02-09"),
            dueDate: new Date("2026-03-09"),
            type: "KOSZT",
            status: "ACTIVE"
        }
    });

    console.log(`✅ Invoice created: ${invoice.invoiceNumber}, Amount: ${invoice.amountGross}`);

    // 2. Mock CSV content (PKO BP Format - Vector 104)
    // Col 0: Data
    // Col 3: Kwota
    // Col 5: Opis (rawType) -> Przelew krajowy
    // Col 6: Nadawca (counterpartyName) -> Budimex S.A.
    // Col 8: Tytuł (title) -> Zapłata za FV 9/02/2026
    const csvContent = `Data operacji,Data waluty,Typ transakcji,Kwota,Waluta,Opis operacji,Rachunek odbiorcy,Nazwa odbiorcy,Tytuł
2026-03-10,2026-03-10,PRZELEW,-1230.00,PLN,Przelew krajowy,,Budimex S.A.,Zapłata za FV 9/02/2026`;

    console.log("📥 Parsing CSV...");
    const transactions = PkoBpCsvAdapter.parse(csvContent);
    console.log(`✅ Parsed ${transactions.length} transactions.`);

    // 3. Save to BankInbox
    console.log("💾 Saving to BankInbox...");
    for (const tx of transactions) {
        await (prisma as any).bankInbox.create({
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

    // 4. Run Reconciliation Engine
    console.log("⚙️ Running Reconciliation Engine...");
    await ReconciliationEngine.processBankInbox(tenantId);

    // 5. Verify results
    const updatedInvoice = await prisma.invoice.findUnique({
        where: { id: invoice.id }
    });

    console.log(`📊 Result: Invoice Status = ${updatedInvoice?.status}`);

    if (updatedInvoice?.status === 'PAID') {
        console.log("✨ SUCCESS: Vector 104 Auto-Match verified!");
    } else {
        console.log("❌ FAILURE: Invoice was not marked as PAID.");
    }

    // Cleanup (optional)
    // await prisma.bankInbox.deleteMany({ where: { tenantId } });
}

test()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
