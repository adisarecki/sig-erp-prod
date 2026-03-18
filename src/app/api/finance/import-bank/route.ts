import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import Decimal from "decimal.js"
import { getCurrentTenantId } from "@/lib/tenant"

const prisma = new PrismaClient()

/**
 * Szkielet API do Importu Wyciągów Bankowych
 * Realizuje fundamenty:
 * 1. Duplicate Detection V2 (blokada tych samych transakcji)
 * 2. Invoice Priority (rozliczanie faktur zamiast dublowania wpisów)
 */
export async function POST(request: NextRequest) {
    try {
        const tenantId = await getCurrentTenantId()
        const body = await request.json()
        const { transactions } = body // Oczekujemy tablicy transakcji z pliku CSV/MT940

        if (!transactions || !Array.isArray(transactions)) {
            return NextResponse.json({ error: "Brak danych transakcji w formacie tablicy." }, { status: 400 })
        }

        const results = {
            imported: 0,
            skipped: 0,
            matchedInvoices: 0,
            errors: [] as string[]
        }

        for (const t of transactions) {
            try {
                const amount = new Decimal(t.amount)
                const operationDate = new Date(t.date)
                const description = t.description

                // --- 1. INTELIGENTNY DETEKTOR DUPLIKATÓW (V2) ---
                const isDuplicate = await prisma.transaction.findFirst({
                    where: {
                        tenantId,
                        amount: amount,
                        transactionDate: operationDate,
                        description: { contains: description }
                    }
                })

                if (isDuplicate) {
                    results.skipped++
                    continue
                }

                // --- 2. PRIORYTET FAKTURY (Dopasowanie do UNPAID) ---
                // Szukamy nieopłaconej faktury o identycznej kwocie (prosty model na start)
                const matchingInvoice = await prisma.invoice.findFirst({
                    where: {
                        tenantId,
                        status: { not: "PAID" },
                        amountGross: amount,
                        bankTransactionId: null // Nieprzetworzona jeszcze bankowo
                    }
                })

                if (matchingInvoice) {
                    await prisma.$transaction(async (tx) => {
                        // Rozliczamy fakturę
                        await tx.invoice.update({
                            where: { id: matchingInvoice.id },
                            data: { 
                                status: "PAID",
                                bankTransactionId: `BANK-IMP-${Date.now()}` // Przykładowe ID
                            }
                        })

                        // Tworzymy transakcję powiązaną (z datą z wyciągu)
                        await tx.transaction.create({
                            data: {
                                tenantId,
                                projectId: matchingInvoice.projectId,
                                amount: amount,
                                type: matchingInvoice.type === "SPRZEDAŻ" ? "PRZYCHÓD" : "KOSZT",
                                transactionDate: operationDate,
                                category: matchingInvoice.type === "SPRZEDAŻ" ? "SPRZEDAŻ_TOWARU" : "KOSZT_FIRMOWY",
                                description: `[Import Bank] ${description}`,
                                status: "ACTIVE",
                                source: "BANK_IMPORT"
                            }
                        })
                    })
                    results.matchedInvoices++
                    results.imported++
                } else {
                    // Brak faktury - tworzymy nową transakcję wolną
                    await prisma.transaction.create({
                        data: {
                            tenantId,
                            amount: amount,
                            type: amount.gt(0) ? "PRZYCHÓD" : "KOSZT",
                            transactionDate: operationDate,
                            category: "INNE",
                            description: `[Import Bank] ${description}`,
                            status: "ACTIVE",
                            source: "BANK_IMPORT"
                        }
                    })
                    results.imported++
                }

            } catch (e: any) {
                results.errors.push(`Błąd przy transakcji ${t.description}: ${e.message}`)
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: "Import zakończony",
            report: results
        })

    } catch (err: any) {
        console.error("BANK_IMPORT_ERROR:", err)
        return NextResponse.json({ error: "Błąd serwera podczas importu." }, { status: 500 })
    }
}
