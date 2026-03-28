import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { KSeFService } from "@/lib/ksef/ksefService";
import { getCurrentTenantId } from "@/lib/tenant";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        const tenantId = await getCurrentTenantId();
        
        // Szukamy faktur, które wpadły z szybkiego Szybkiego Syncu i nie mają XML'a
        const pendingInvoices = await prisma.invoice.findMany({
            where: {
                tenantId,
                status: "XML_MISSING",
                ksefId: { not: null }
            },
            take: 20 // Ograniczamy do 20, by uniknąć wyjazdu poza 60s Max Duration Vercela
        });

        if (pendingInvoices.length === 0) {
            return NextResponse.json({
                success: true,
                message: "Brak nowych dokumentów 'XML_MISSING' do przeprocesowania."
            });
        }

        const ksefSvc = new KSeFService();
        const sessionToken = await ksefSvc.getSessionToken();
        
        let processed = 0;
        let errors = 0;

        for (const invoice of pendingInvoices) {
            const ksefId = invoice.ksefId!;
            try {
                // Pobieramy pełnego XML'a z KSeF
                const parsed = await ksefSvc.fetchAndParse(ksefId, { sessionToken });
                
                // My pobraliśmy typ z logiki Header - tu go po prostu potwierdzamy / korygujemy
                const myNip = process.env.KSEF_NIP || "";
                const isRevenue = parsed.sellerNip === myNip;
                
                // UZUPEŁNIAMY KONTRAHENTA (Szczegóły jak adres i konto bankowe z XML)
                const counterpartyNip = isRevenue ? parsed.counterpartyNip : parsed.sellerNip;
                const counterpartyName = isRevenue ? parsed.counterpartyName : parsed.sellerName;
                const counterpartyAddress = isRevenue ? "" : parsed.sellerAddress;

                let contractor = await prisma.contractor.findUnique({
                    where: { tenantId_nip: { tenantId, nip: counterpartyNip } }
                });

                if (contractor) {
                    // Update Contractor z XML
                    let updatedBankAccounts = contractor.bankAccounts;
                    let bankAdded = false;

                    // Tylko do dostawców dodajemy konto Sprzedawcy, bo on jest odbiorcą pieniędzy
                    if (!isRevenue && parsed.sellerBankAccount && !contractor.bankAccounts.includes(parsed.sellerBankAccount)) {
                        updatedBankAccounts.push(parsed.sellerBankAccount);
                        bankAdded = true;
                    }

                    // Zaktualizuj address, jeśli puste
                    const currentAddress = contractor.address;
                    const addressUpdated = !currentAddress && counterpartyAddress;

                    if (bankAdded || addressUpdated) {
                        await prisma.contractor.update({
                            where: { id: contractor.id },
                            data: {
                                bankAccounts: updatedBankAccounts,
                                ...(addressUpdated ? { address: counterpartyAddress } : {})
                            }
                        });
                        console.log(`[KSEF_PROCESS] Zaktualizowano kontrahenta z XML: ${counterpartyNip}`);
                    }
                } else {
                    // Fallback w razie jakby ktoś go usunął ręcznie 
                    contractor = await prisma.contractor.create({
                        data: {
                            tenantId,
                            nip: counterpartyNip,
                            name: counterpartyName,
                            address: counterpartyAddress,
                            status: "PENDING",
                            type: isRevenue ? "KLIENT" : "DOSTAWCA",
                            bankAccounts: (!isRevenue && parsed.sellerBankAccount) ? [parsed.sellerBankAccount] : []
                        }
                    });
                }

                let taxRateValue = 0;
                if (!parsed.netAmount.isZero()) {
                    taxRateValue = parsed.vatAmount.dividedBy(parsed.netAmount).toNumber();
                }

                // AKTUALIZACJA FAKTURY (Zrzucenie XML_MISSING i uzupełnienie dueDate / invoiceNumber)
                await prisma.invoice.update({
                    where: { id: invoice.id },
                    data: {
                        invoiceNumber: parsed.invoiceNumber,
                        ksefType: parsed.ksefType,
                        amountNet: parsed.netAmount.toNumber(),
                        amountGross: parsed.grossAmount.toNumber(),
                        taxRate: Number.isNaN(taxRateValue) ? 0 : taxRateValue,
                        issueDate: parsed.issueDate,
                        dueDate: parsed.dueDate,
                        status: "ACTIVE" // The faktura staje się teraz widoczna w pełnym systemie finansowym i spłuczona!
                    }
                });

                console.log(`[KSEF_PROCESS] Skonsumowano pełny XML dla KSeF ID: ${parsed.ksefNumber}`);
                processed++;

            } catch (err: any) {
                console.error(`[KSEF_PROCESS] Błąd przetwarzania XML dla ID ${ksefId}:`, err);
                errors++;
            }
        }

        return NextResponse.json({
            success: true,
            processed,
            errors,
            message: `Pobrano szczegóły XML dla ${processed} dokumentów. Błędów: ${errors}.`
        });

    } catch (error: any) {
        console.error("[KSEF_PROCESS_MASTER]", error);
        return NextResponse.json(
            { error: error.message || "Błąd generalny odczytu XML z KSeF" },
            { status: 500 }
        );
    }
}
