import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';

const prisma = new PrismaClient();

async function verify() {
    console.log("Verifying Vector 098.3 Double-Shield Anchor...");

    // 1. Find or create a test contractor
    let contractor = await prisma.contractor.findFirst({ where: { nip: '1234567890' } });
    if (!contractor) {
        const tenant = await prisma.tenant.findFirst();
        if (!tenant) throw new Error("No tenant found");
        contractor = await prisma.contractor.create({
            data: {
                tenantId: tenant.id,
                nip: '1234567890',
                name: 'Polon-Alfa Test',
                type: 'DOSTAWCA'
            }
        });
    }
    console.log("✓ Test Contractor Ready");

    // 2. Create first invoice
    const inv1 = await prisma.invoice.create({
        data: {
            tenantId: contractor.tenantId,
            contractorId: contractor.id,
            invoiceNumber: 'VERIFY-001',
            type: 'EXPENSE',
            amountNet: new Decimal(100),
            amountGross: new Decimal(123),
            taxRate: new Decimal(0.23),
            issueDate: new Date(),
            dueDate: new Date(),
            status: 'ACTIVE'
        }
    });
    console.log("✓ First Invoice Created");

    // 3. Try to create duplicate (Second Line of Defense - DB Level)
    try {
        await prisma.invoice.create({
            data: {
                tenantId: contractor.tenantId,
                contractorId: contractor.id,
                invoiceNumber: 'VERIFY-001', // DUPLICATE
                type: 'EXPENSE',
                amountNet: new Decimal(200),
                amountGross: new Decimal(246),
                taxRate: new Decimal(0.23),
                issueDate: new Date(),
                dueDate: new Date(),
                status: 'ACTIVE'
            }
        });
        console.error("✗ ERROR: Database allowed duplicate [Contractor + Number]!");
    } catch (err: any) {
        if (err.code === 'P2002') {
            console.log("✓ SUCCESS: Database blocked duplicate [Contractor + Number] (Vector 098.3 Anchor Hit)");
        } else {
            console.error("✗ Unexpected error:", err.message);
        }
    }

    // 4. Cleanup test data (optional, but good for local test)
    // await prisma.invoice.delete({ where: { id: inv1.id } });
}

verify()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
