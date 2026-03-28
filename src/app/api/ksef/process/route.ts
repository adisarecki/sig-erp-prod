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
                
                // AUTO-KATEGORYZACJA: Sprzedaż czy Koszt?
                const myNip = process.env.KSEF_NIP || "";
                // Jeśli mój NIP to Sprzedawca, to jest to dla mnie REVENUE (Przychód)
                const isRevenue = parsed.sellerNip === myNip;
                const dbType = isRevenue ? "REVENUE" : "EXPENSE";

                // Ustalenie kto jest Drugą Stroną Transakcji
                const counterpartyNip = isRevenue ? parsed.counterpartyNip : parsed.sellerNip;
                const counterpartyName = isRevenue ? parsed.counterpartyName : parsed.sellerName;
                const counterpartyAddress = isRevenue ? "" : parsed.sellerAddress; // Adresy zazwyczaj bierzemy od sprzedawców w KSeF, ale można to rozbudować

                // KROK B: Logika Auto-Contractor (Wyszukiwanie dostawcy/klienta)
                let contractor = await prisma.contractor.findUnique({
                    where: { tenantId_nip: { tenantId, nip: counterpartyNip } }
                });

                if (!contractor) {
                    // Generuj kontrahenta w stanie PENDING i podepnij mu znalezione konto bankowe (tylko dla kosztów Nabywca płaci na konto Sprzedawcy)
                    const accountsArr = (!isRevenue && parsed.sellerBankAccount) ? [parsed.sellerBankAccount] : [];
                    contractor = await prisma.contractor.create({
                        data: {
                            tenantId,
                            nip: counterpartyNip,
                            name: counterpartyName,
                            address: counterpartyAddress,
                            status: "PENDING",
                            type: isRevenue ? "KLIENT" : "DOSTAWCA",
                            bankAccounts: accountsArr
                        }
                    });
                    console.log(`[KSEF_PROCESS] Wygenerowano kontrahenta: ${counterpartyNip}`);
                } else if (!isRevenue && parsed.sellerBankAccount && !contractor.bankAccounts.includes(parsed.sellerBankAccount)) {
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

                // KROK C: Zapis faktury i powiązanie z Mądrym Kontrahentem
                await prisma.invoice.create({
                    data: {
                        tenantId,
                        contractorId: contractor.id,
                        ksefId: parsed.ksefNumber,
                        invoiceNumber: parsed.invoiceNumber,
                        type: dbType, // REVENUE lub EXPENSE wyliczony z XML
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
