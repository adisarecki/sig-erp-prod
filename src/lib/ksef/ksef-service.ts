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
     * Main sync function: Fetches recently received/issued invoices from KSeF 
     * and saves them as drafts in our DB.
     */
    async syncInvoices(dateFrom: string, dateTo: string) {
        console.log(`[KSeF_SERVICE] Starting sync from ${dateFrom} to ${dateTo}`);
        
        // 1. Authenticate
        const sessionId = await this.client.authenticate(OWNER_NIP);

        // 2. Query Invoice List
        const searchResult = await this.client.queryInvoices(sessionId, { dateFrom, dateTo });
        const invoiceList = searchResult.invoiceList || [];
        
        console.log(`[KSeF_SERVICE] Found ${invoiceList.length} invoices to process.`);

        const results = [];

        // 3. Process each invoice
        for (const item of invoiceList) {
            try {
                const ksefNumber = item.ksefReferenceNumber;
                
                // Check if already exists in our DB to avoid duplicates
                const existing = await prisma.invoice.findFirst({
                    where: { externalId: ksefNumber }
                });

                if (existing) {
                    console.log(`[KSeF_SERVICE] Invoice ${ksefNumber} already exists. Skipping.`);
                    continue;
                }

                // 4. Download and Parse XML
                const xml = await this.client.downloadInvoice(sessionId, ksefNumber);
                const data = this.mapper.parseXml(xml, ksefNumber);

                // 5. Save to DB
                const savedInvoice = await this.persistInvoice(data);
                results.push(savedInvoice);

            } catch (err) {
                console.error(`[KSeF_SERVICE] Failed to process invoice ${item.ksefReferenceNumber}:`, err);
            }
        }

        return results;
    }

    /**
     * Persist parsed KSeF data into Prisma and Firebase
     */
    private async persistInvoice(data: KSeFInvoiceData) {
        // Find Tenant
        const tenant = await prisma.tenant.findFirst({
            where: { nip: OWNER_NIP }
        });

        if (!tenant) {
            throw new Error(`Tenant with NIP ${OWNER_NIP} not found in database.`);
        }

        const tenantId = tenant.id;

        // Upsert Contractor (The other party)
        const otherPartyNip = data.type === 'INCOME' ? data.buyerNip : data.sellerNip;
        const otherPartyName = data.type === 'INCOME' ? data.buyerName : data.sellerName;
        
        // Use existing createContractor action (handles both DBs)
        const contractorResult = await createContractor({
            name: otherPartyName,
            nip: otherPartyNip,
            type: data.type === 'INCOME' ? 'INWESTOR' : 'DOSTAWCA'
        });

        if (!contractorResult.success || !contractorResult.id) {
            throw new Error(`Failed to identify or create contractor for NIP ${otherPartyNip}`);
        }

        const contractorId = contractorResult.id;

        // Save to Prisma
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
                status: 'UNVERIFIED', // Inbox status (Draft)
                externalId: data.ksefNumber, // Store KSeF number here
            }
        });

        // --- SELF-LEARNING (Bank Account) ---
        if (contractorId && data.bankAccountNumber && data.bankAccountNumber.length >= 10) {
            const contractor = await prisma.contractor.findUnique({
                where: { id: contractorId }
            });
            
            if (contractor && !(contractor as any).bankAccounts.includes(data.bankAccountNumber)) {
                await prisma.contractor.update({
                    where: { id: contractorId },
                    data: { 
                        bankAccounts: { 
                            push: data.bankAccountNumber 
                        } 
                    } as any
                });

                // Firestore Sync
                const adminDb = getAdminDb();
                await adminDb.collection("contractors").doc(contractorId).update({
                    bankAccounts: Array.from(new Set([...((contractor as any).bankAccounts || []), data.bankAccountNumber]))
                });
            }
        }

        // Optional: Also sync to Firestore if needed for real-time legacy support
        // Note: createContractor already synced the contractor. 
        // We usually sync invoices via Server Actions.
        
        return invoice;
    }
}
