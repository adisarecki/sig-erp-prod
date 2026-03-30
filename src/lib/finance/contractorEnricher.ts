import prisma from "@/lib/prisma";
import { KsefParsedInvoice } from "@/lib/ksef/ksefService";

export interface EnrichmentDiff {
    field: string;
    oldValue: string | string[];
    newValue: string | string[];
}

/**
 * Porównuje dane z faktury KSeF z danymi w bazie i tworzy powiadomienie o propozycji aktualizacji.
 */
export async function compareAndNotify(invoice: KsefParsedInvoice, tenantId: string) {
    try {
        // Znajdź kontrahenta w bazie po NIP
        const contractor = await prisma.contractor.findUnique({
            where: {
                tenantId_nip: {
                    tenantId,
                    nip: invoice.sellerNip
                }
            }
        });

        if (!contractor) return;

        const diffs: EnrichmentDiff[] = [];

        // 1. Porównaj Adres
        const dbAddress = (contractor.address || '').trim().toLowerCase();
        const xmlAddress = (invoice.sellerAddress || '').trim().toLowerCase();
        
        if (xmlAddress && dbAddress !== xmlAddress) {
            diffs.push({
                field: 'address',
                oldValue: contractor.address || 'Brak',
                newValue: invoice.sellerAddress
            });
        }

        // 2. Porównaj Konto Bankowe
        const xmlAccount = (invoice.sellerBankAccount || '').replace(/\s+/g, '');
        const dbAccounts = (contractor.bankAccounts as string[] || []).map(a => a.replace(/\s+/g, ''));
        
        if (xmlAccount && !dbAccounts.includes(xmlAccount)) {
            diffs.push({
                field: 'bankAccount',
                oldValue: contractor.bankAccounts.length > 0 ? contractor.bankAccounts : ['Brak'],
                newValue: invoice.sellerBankAccount!
            });
        }

        if (diffs.length === 0) return;

        // 3. Sprawdź czy już nie wysłaliśmy takiego powiadomienia (blokada spamu)
        const title = `Propozycja aktualizacji: ${contractor.name}`;
        const existingNotification = await (prisma as any).notification.findFirst({
            where: {
                tenantId,
                title,
                isRead: false,
                type: 'ENRICHMENT_PROPOSAL'
            }
        });

        if (existingNotification) {
            // Jeśli istnieje, aktualizujemy metadata (może doszły nowe unikalne zmiany)
            await (prisma as any).notification.update({
                where: { id: existingNotification.id },
                data: {
                    metadata: { diffs, contractorId: contractor.id },
                    createdAt: new Date()
                }
            });
            return;
        }

        // 4. Stwórz nowe powiadomienie
        await (prisma as any).notification.create({
            data: {
                tenantId,
                type: 'ENRICHMENT_PROPOSAL',
                priority: 'NORMAL',
                title,
                message: `Wykryto nowsze dane dla ${contractor.name} w fakturze KSeF. Kliknij aby zaktualizować kartotekę.`,
                metadata: { diffs, contractorId: contractor.id }
            }
        });

        console.log(`[ENRICHER] Created enrichment proposal for ${contractor.name} (Diffs: ${diffs.length})`);

    } catch (error) {
        console.error("[ENRICHER_ERROR]", error);
    }
}
