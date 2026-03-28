import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { KSeFService } from "@/lib/ksef/ksefService";
import { getCurrentTenantId } from "@/lib/tenant";

export const maxDuration = 60; // Długie zapytania KSeF (v2.0 Timeout Guard)

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { ksefIds } = body;

        if (!Array.isArray(ksefIds) || ksefIds.length === 0) {
            return NextResponse.json({ error: "Brak przekazanych identyfikatorów KSeF" }, { status: 400 });
        }

        const tenantId = await getCurrentTenantId();
        const ksefSvc = new KSeFService();
        const sessionToken = await ksefSvc.getSessionToken();
        
        let processed = 0;
        let errors = 0;
        let duplicates = 0;

        for (const ksefId of ksefIds) {
            try {
                // KROK A: Sprawdź duplikat po KSeF ID (Anti-Duplicate Guard)
                const existingInvoice = await prisma.invoice.findUnique({
                    where: { ksefId },
                });

                if (existingInvoice) {
                    console.log(`[KSEF_PROCESS] Pominięto duplikat faktury: ${ksefId}`);
                    duplicates++;
                    continue;
                }

                // KROK A.2: Brak duplikatu, więc pobieramy pełnego XML'a z KSeF
                const parsed = await ksefSvc.fetchAndParse(ksefId, { sessionToken });
                const nip = parsed.sellerNip;

                // KROK B: Logika Auto-Contractor (Wyszukiwanie dostawcy)
                let contractor = await prisma.contractor.findUnique({
                    where: { tenantId_nip: { tenantId, nip } }
                });

                if (!contractor) {
                    // Generuj dostawcę w stanie PENDING i podepnij mu znalezione konto bankowe
                    const accountsArr = parsed.sellerBankAccount ? [parsed.sellerBankAccount] : [];
                    contractor = await prisma.contractor.create({
                        data: {
                            tenantId,
                            nip,
                            name: parsed.sellerName,
                            address: parsed.sellerAddress,
                            status: "PENDING",
                            bankAccounts: accountsArr
                        }
                    });
                    console.log(`[KSEF_PROCESS] Wygenerowano kontrahenta: ${nip}`);
                } else if (parsed.sellerBankAccount && !contractor.bankAccounts.includes(parsed.sellerBankAccount)) {
                    // Jeśli istnieje dostawca, dołączamy mu konto bankowe do tablicy, jeśli nie było
                    await prisma.contractor.update({
                        where: { id: contractor.id },
                        data: { bankAccounts: { push: parsed.sellerBankAccount } }
                    });
                }

                // Kalkulacja uproszczonego taxRate jeśli potrzebne
                let taxRateValue = 0;
                if (!parsed.netAmount.isZero()) {
                    taxRateValue = parsed.vatAmount.dividedBy(parsed.netAmount).toNumber();
                }

                // KROK C: Zapis faktury i powiązanie z dostawcą
                await prisma.invoice.create({
                    data: {
                        tenantId,
                        contractorId: contractor.id,
                        ksefId: parsed.ksefNumber,
                        invoiceNumber: parsed.invoiceNumber,
                        type: "EXPENSE", // Domyślny typ wprowadzany do systemu
                        ksefType: parsed.ksefType, // Oddzielenie faktur ZAL / ZW
                        amountNet: parsed.netAmount.toNumber(),
                        amountGross: parsed.grossAmount.toNumber(),
                        taxRate: Number.isNaN(taxRateValue) ? 0 : taxRateValue,
                        issueDate: parsed.issueDate,
                        dueDate: parsed.dueDate,
                        paymentStatus: parsed.paymentStatus, // UNPAID (lub PAID)
                        status: "ACTIVE"
                    }
                });

                console.log(`[KSEF_PROCESS] Zapisano w bazie fakturę: ${parsed.ksefNumber}`);
                processed++;

            } catch (err: any) {
                console.error(`[KSEF_PROCESS] Błąd przetwarzania ID ${ksefId}:`, err);
                errors++;
            }
        }

        return NextResponse.json({
            success: true,
            processed,
            duplicates,
            errors,
            message: `Wgrano ${processed} nowych faktur. Ominięto ${duplicates} duplikatów. Błędów: ${errors}.`
        });

    } catch (error: any) {
        console.error("[KSEF_PROCESS_MASTER]", error);
        return NextResponse.json(
            { error: error.message || "Błąd generalny integracji faktur KSeF" },
            { status: 500 }
        );
    }
}
