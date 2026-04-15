const fs = require('fs');
let code = fs.readFileSync('src/app/actions/invoices.ts', 'utf8');

const startIndex = code.indexOf('export async function checkDuplicateInvoice(');
if (startIndex !== -1) {
    // Cut the code at the start of checkDuplicateInvoice
    code = code.substring(0, startIndex);
    
    // Append the new functions
    const newCode = `export async function checkDuplicateInvoice(
    invoiceNumber: string | null | undefined, 
    nip: string | null | undefined,
    grossAmountStr?: string
): Promise<{ isDuplicate: boolean, duplicateId?: string }> {
    if (!invoiceNumber || !nip || !grossAmountStr) return { isDuplicate: false };
    
    try {
        const tenantId = await getCurrentTenantId();
        const cleanNip = nip.replace(/\\D/g, "");
        const cleanNumber = invoiceNumber.trim();
        const { Prisma } = require('@prisma/client');
        const grossAmount = new Prisma.Decimal(grossAmountStr.replace(',', '.').replace(/[^0-9.]/g, ''));
        
        const existing = await prisma.invoice.findFirst({
            where: {
                tenantId,
                contractor: { nip: cleanNip },
                amountGross: grossAmount,
                OR: [
                    { externalId: cleanNumber },
                    { externalId: { contains: cleanNumber } }
                ]
            },
            select: { id: true }
        });
        
        return { 
            isDuplicate: !!existing,
            duplicateId: existing?.id
        };
    } catch (error) {
        console.error("[CHECK_DUPLICATE_ERROR]", error);
        return { isDuplicate: false };
    }
}

/**
 * VECTOR 180: DATA ISOLATION VAULT
 * Commits raw drafts directly to PostgreSQL with isAudit = true.
 * Records are isolated from the main dashboard metrics.
 */
export async function bulkCommitToAudit(draftInvoices: any[]) {
    try {
        const tenantId = await getCurrentTenantId();
        const { Prisma } = require('@prisma/client');
        const { randomUUID } = require('crypto');
        
        const result = await prisma.$transaction(async (tx: any) => {
            let processedCount = 0;
            for (const draft of draftInvoices) {
                let contractorId = draft.contractorId;
                if (!contractorId) {
                    const cleanNip = draft.nip?.replace(/\\D/g, "");
                    if (cleanNip) {
                        const localContractor = await tx.contractor.findFirst({
                            where: { tenantId, nip: cleanNip }
                        });
                        if (localContractor) contractorId = localContractor.id;
                    }
                }
                
                if (!contractorId) {
                    continue; // Skip
                }
                
                const id = randomUUID();
                const type = draft.type === "INCOME" ? "SPRZEDAŻ" : "KOSZT";
                const date = draft.issueDate ? new Date(draft.issueDate) : new Date();
                
                await tx.invoice.create({
                    data: {
                        id,
                        tenantId,
                        contractorId,
                        type,
                        amountNet: new Prisma.Decimal((draft.netAmount || "0").replace(',', '.').replace(/[^0-9.]/g, '') || "0"),
                        amountGross: new Prisma.Decimal((draft.grossAmount || "0").replace(',', '.').replace(/[^0-9.]/g, '') || "0"),
                        taxRate: new Prisma.Decimal("0.23"),
                        issueDate: date,
                        dueDate: draft.dueDate ? new Date(draft.dueDate) : date,
                        status: "ACTIVE",
                        paymentStatus: "UNPAID",
                        invoiceNumber: draft.invoiceNumber,
                        externalId: draft.invoiceNumber,
                        rawOcrData: draft as any,
                        isAudit: true, // VECTOR 180: ISOLATION FLAG
                        auditDiscrepancy: true 
                    } as any
                });
                
                await tx.ledgerEntry.create({
                    data: {
                        tenantId,
                        source: 'INVOICE',
                        sourceId: id,
                        amount: new Prisma.Decimal((draft.netAmount || "0").replace(',', '.').replace(/[^0-9.]/g, '') || "0"),
                        type: draft.type === "INCOME" ? 'INCOME' : 'EXPENSE',
                        date: date,
                        isAudit: true, // VECTOR 180
                        rawOcrData: draft as any
                    }
                });
                processedCount++;
            }
            return processedCount;
        });
        
        const { revalidatePath } = require('next/cache');
        revalidatePath("/finanse/audit");
        return { success: true, count: result };
    } catch (e: any) {
        console.error("[AUDIT_VAULT_COMMIT_ERROR]", e);
        return { success: false, error: e.message };
    }
}
`;
    fs.writeFileSync('src/app/actions/invoices.ts', code + newCode, 'utf8');
    console.log("SUCCESS!!!");
} else {
    console.log("indexOf FAILED to match.");
}
