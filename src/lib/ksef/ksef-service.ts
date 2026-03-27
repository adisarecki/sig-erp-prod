import { KSeFClient } from './ksef-client';
import { KSeFMapper, KSeFInvoiceData } from './ksef-mapper';
import prisma from '@/lib/prisma';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { createContractor } from '@/app/actions/crm';

const OWNER_NIP = '9542751368';

export class KSeFService {
    private client: KSeFClient;
    private mapper: KSeFMapper;

    constructor() {
        this.client = new KSeFClient();
        this.mapper = new KSeFMapper();
    }

    /**
     * Main sync function: Fetches both issued (INCOME) and received (EXPENSE) invoices
     * from KSeF and saves them as UNVERIFIED drafts in our DB.
     * 
     * Uses official v2 API:
     *   Subject1 = issued by us (INCOME)
     *   Subject2 = received by us (EXPENSE)
     */
    async syncInvoices(dateFrom: string, dateTo: string) {
        console.log(`[KSeF_SERVICE] Starting sync from ${dateFrom} to ${dateTo}`);
        
        // 1. Authenticate
        await this.client.authenticate(OWNER_NIP);

        const results = [];

        // 2. Query INCOME invoices (Subject1 - we are the seller)
        try {
            const incomeResult = await this.client.queryInvoices('Subject1', { dateFrom, dateTo });
            const incomeList = incomeResult.invoiceList || incomeResult.items || [];
            console.log(`[KSeF_SERVICE] Found ${incomeList.length} INCOME invoices.`);
            
            for (const item of incomeList) {
                const saved = await this.processInvoice(item, 'INCOME');
                if (saved) results.push(saved);
            }
        } catch (err) {
            console.error('[KSeF_SERVICE] Error querying INCOME invoices:', err);
        }

        // 3. Query EXPENSE invoices (Subject2 - we are the buyer)
        try {
            const expenseResult = await this.client.queryInvoices('Subject2', { dateFrom, dateTo });
            const expenseList = expenseResult.invoiceList || expenseResult.items || [];
            console.log(`[KSeF_SERVICE] Found ${expenseList.length} EXPENSE invoices.`);
            
            for (const item of expenseList) {
                const saved = await this.processInvoice(item, 'EXPENSE');
                if (saved) results.push(saved);
            }
        } catch (err) {
            console.error('[KSeF_SERVICE] Error querying EXPENSE invoices:', err);
        }

        // 4. Terminate session (cleanup)
        await this.client.terminateSession();

        console.log(`[KSeF_SERVICE] Sync complete. ${results.length} new invoices saved.`);
        return results;
    }

    /**
     * Process a single invoice from the KSeF query results.
     */
    private async processInvoice(item: any, forceType: 'INCOME' | 'EXPENSE') {
        try {
            const ksefNumber = item.ksefReferenceNumber || item.ksefNumber;
            if (!ksefNumber) return null;

            // Check for duplicates
            const existing = await prisma.invoice.findFirst({
                where: { externalId: ksefNumber }
            });

            if (existing) {
                console.log(`[KSeF_SERVICE] Invoice ${ksefNumber} already exists. Skipping.`);
                return null;
            }

            // Download and parse XML
            const xml = await this.client.downloadInvoice(ksefNumber);
            const data = this.mapper.parseXml(xml, ksefNumber);

            // Override type based on Subject query direction
            data.type = forceType === 'INCOME' ? 'SPRZEDAŻ' : 'KOSZT';

            // Save to DB
            return await this.persistInvoice(data);
        } catch (err) {
            console.error(`[KSeF_SERVICE] Failed to process invoice:`, err);
            return null;
        }
    }

    /**
     * Persist parsed KSeF data into Prisma and Firebase
     */
    private async persistInvoice(data: KSeFInvoiceData) {
        const tenant = await prisma.tenant.findFirst({
            where: { nip: OWNER_NIP }
        });

        if (!tenant) {
            throw new Error(`Tenant with NIP ${OWNER_NIP} not found in database.`);
        }

        const tenantId = tenant.id;

        // Upsert Contractor (The other party)
        const isIncome = data.type === 'SPRZEDAŻ';
        const otherPartyNip = isIncome ? data.buyerNip : data.sellerNip;
        const otherPartyName = isIncome ? data.buyerName : data.sellerName;
        
        const contractorResult = await createContractor({
            name: otherPartyName,
            nip: otherPartyNip,
            type: isIncome ? 'INWESTOR' : 'DOSTAWCA'
        });

        if (!contractorResult.success || !contractorResult.id) {
            throw new Error(`Failed to create contractor for NIP ${otherPartyNip}`);
        }

        const contractorId = contractorResult.id;

        // Save to Prisma as UNVERIFIED (Phase 12 Inbox)
        const invoice = await prisma.invoice.create({
            data: {
                tenantId,
                contractorId,
                type: data.type,
                amountNet: data.amountNet,
                amountGross: data.amountGross,
                taxRate: data.taxRate,
                issueDate: data.issueDate,
                dueDate: data.dueDate,
                status: 'UNVERIFIED',
                externalId: data.ksefNumber,
            }
        });

        // Self-Learning: Save bank account number to contractor
        if (contractorId && data.bankAccountNumber && data.bankAccountNumber.length >= 10) {
            try {
                const contractor = await prisma.contractor.findUnique({
                    where: { id: contractorId }
                });
                
                if (contractor && !contractor.bankAccounts.includes(data.bankAccountNumber)) {
                    await prisma.contractor.update({
                        where: { id: contractorId },
                        data: { bankAccounts: { push: data.bankAccountNumber } }
                    });

                    // Firestore sync
                    const adminDb = getAdminDb();
                    await adminDb.collection("contractors").doc(contractorId).update({
                        bankAccounts: [...contractor.bankAccounts, data.bankAccountNumber]
                    });
                }
            } catch (err) {
                console.warn('[KSeF_SERVICE] Self-learning bank account failed:', err);
            }
        }

        return invoice;
    }
}
