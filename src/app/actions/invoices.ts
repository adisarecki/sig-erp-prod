"use server"

import { revalidatePath } from "next/cache"
import Decimal from "decimal.js"
import { validateNonZero } from "@/lib/ledger"
import { getCurrentTenantId } from "@/lib/tenant"
import { getAdminDb } from "@/lib/firebaseAdmin"
import prisma from "@/lib/prisma"


export async function addIncomeInvoice(formData: FormData) {
    try {
        const adminDb = getAdminDb()
        const amountNetStr = formData.get("amountNet") as string
        const taxRateStr = formData.get("taxRate") as string
        const amountGrossStr = formData.get("amountGross") as string
        const dateStr = formData.get("date") as string
        const dueDateStr = formData.get("dueDate") as string

        const category = formData.get("category") as string
        const projectId = formData.get("projectId") as string
        const contractorId = formData.get("contractorId") as string
        const description = formData.get("description") as string

        if (!amountNetStr || !dateStr || !dueDateStr || !projectId || projectId === "NONE" || !contractorId) {
            throw new Error("Pola Kwota, Daty, Projekt i Kontrahent są bezwzględnie wymagane.")
        }

        if (!validateNonZero(amountNetStr)) {
            throw new Error("Kwota netto faktury nie może wynosić zero.")
        }

        const tenantId = await getCurrentTenantId()
        const amountNet = new Decimal(amountNetStr)
        const taxRate = new Decimal(taxRateStr)
        const amountGross = new Decimal(amountGrossStr)

        const issueDate = new Date(dateStr)
        const dueDate = new Date(dueDateStr)

        const isPaidImmediately = formData.get("isPaidImmediately") === "true"

        // retention
        const retainedAmountStr = formData.get("retainedAmount") as string
        const retentionReleaseDateStr = formData.get("retentionReleaseDate") as string
        const retainedAmount = retainedAmountStr ? new Decimal(retainedAmountStr) : null
        const retentionReleaseDate = retentionReleaseDateStr ? new Date(retentionReleaseDateStr) : null

        // --- TARCZA ANTY-DUBEL (Anti-Double Shield) ---
        // Firestore manual unique check
        if (description) {
            const duplicateQuery = await adminDb.collection("invoices")
                .where("tenantId", "==", tenantId)
                .where("contractorId", "==", contractorId)
                .where("externalId", "==", description)
                .where("type", "==", "SPRZEDAŻ")
                .limit(1)
                .get()

            if (!duplicateQuery.empty) {
                throw new Error(`TARCZA ANTY-DUBEL: Faktura o numerze ${description} od tego kontrahenta już istnieje w systemie! (Dublowanie zablokowane)`)
            }
        }


        const invoiceId = await adminDb.runTransaction(async (transaction) => {
            // 1. Zapisujemy Fakturę
            const invoiceRef = adminDb.collection("invoices").doc()
            transaction.set(invoiceRef, {
                tenantId,
                contractorId,
                projectId,
                type: "SPRZEDAŻ",
                amountNet: amountNet.toNumber(),
                amountGross: amountGross.toNumber(),
                taxRate: taxRate.toNumber(),
                issueDate: issueDate.toISOString(),
                dueDate: dueDate.toISOString(),
                status: isPaidImmediately ? "PAID" : "ACTIVE",
                externalId: description,
                retainedAmount: retainedAmount ? retainedAmount.toNumber() : null,
                retentionReleaseDate: retentionReleaseDate ? retentionReleaseDate.toISOString() : null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })

            // 2. Transakcja powiązana (Tylko jeśli opłacono od razu)
            if (isPaidImmediately) {
                const transRef = adminDb.collection("transactions").doc()
                transaction.set(transRef, {
                    tenantId,
                    projectId,
                    classification: "PROJECT_COST",
                    amount: amountGross.toNumber(),
                    type: "PRZYCHÓD",
                    transactionDate: issueDate.toISOString(),
                    category: category || "SPRZEDAŻ_TOWARU",
                    description: `Wpływ z Faktury: ${description || 'Brak wpisanego numeru'}`,
                    status: "ACTIVE",
                    source: "INVOICE",
                    invoiceId: invoiceRef.id,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                })
            }
            return invoiceRef.id
        })

        // 3. Prisma Sync
        try {
            await prisma.invoice.create({
                data: {
                    id: invoiceId,
                    tenantId,
                    contractorId,
                    projectId,
                    type: "SPRZEDAŻ",
                    amountNet: amountNet.toNumber(),
                    amountGross: amountGross.toNumber(),
                    taxRate: taxRate.toNumber(),
                    issueDate,
                    dueDate,
                    status: isPaidImmediately ? "PAID" : "ACTIVE",
                    externalId: description,
                    retainedAmount: retainedAmount ? retainedAmount.toNumber() : null,
                    retentionReleaseDate
                }
            })

            if (isPaidImmediately) {
                const transSnap = await adminDb.collection("transactions").where("invoiceId", "==", invoiceId).limit(1).get()
                if (!transSnap.empty) {
                    const tDoc = transSnap.docs[0]
                    // 3a. Tworzymy Transakcję w Prisma
                    const prismaTrans = await (prisma.transaction.create as any)({
                        data: {
                            id: tDoc.id,
                            tenantId,
                            projectId,
                            classification: "PROJECT_COST",
                            amount: amountGross.toNumber(),
                            type: "PRZYCHÓD",
                            transactionDate: issueDate,
                            category: category || "SPRZEDAŻ_TOWARU",
                            description: `Wpływ z Faktury: ${description || 'Brak wpisanego numeru'}`,
                            status: "ACTIVE",
                            source: "INVOICE"
                        }
                    })

                    // 3b. Tworzymy powiązanie InvoicePayment (Ledger logic)
                    await prisma.invoicePayment.create({
                        data: {
                            invoiceId: invoiceId,
                            transactionId: prismaTrans.id,
                            amountApplied: amountGross.toNumber()
                        }
                    })
                }
            }
        } catch (prismaError: any) {
            // Rollback Firebase
            await adminDb.collection("invoices").doc(invoiceId).delete()
            const orphans = await adminDb.collection("transactions").where("invoiceId", "==", invoiceId).get()
            for (const doc of orphans.docs) {
                await doc.ref.delete()
            }
            throw new Error("Błąd synchronizacji relacyjnej (Prisma). Dane w Firebase zostały wycofane. " + prismaError.message)
        }

        revalidatePath("/")
        revalidatePath("/projects")
        revalidatePath("/finance")

        return { success: true }
    } catch (error: any) {
        console.error("[ADD_INCOME_INVOICE_ERROR]", error)
        return { success: false, error: error.message || "Wystąpił błąd przy dodawaniu przychodu." }
    }
}

export async function addCostInvoice(formData: FormData) {
    try {
        const adminDb = getAdminDb()
        const amountNetStr = formData.get("amountNet") as string
        const taxRateStr = formData.get("taxRate") as string
        const amountGrossStr = formData.get("amountGross") as string
        const dateStr = formData.get("date") as string
        const dueDateStr = formData.get("dueDate") as string

        const category = formData.get("category") as string
        const projectId = formData.get("projectId") as string
        const contractorId = formData.get("contractorId") as string
        const description = formData.get("description") as string

        // New Contractor Fields
        const isNewContractor = formData.get("isNewContractor") === "true"
        const newContractorName = formData.get("newContractorName") as string
        let newContractorNip = (formData.get("newContractorNip") as string || "").replace(/\s/g, "")
        let newContractorAddress = formData.get("newContractorAddress") as string || ""

        // Heuristic: If address looks like a NIP and nip is empty, swap them
        if (!newContractorNip && /^\d{10}$/.test(newContractorAddress.trim())) {
            newContractorNip = newContractorAddress.trim()
            newContractorAddress = ""
        }

        if (!amountNetStr || !dateStr || !dueDateStr) {
            throw new Error("Pola Kwota i Daty są bezwzględnie wymagane.")
        }

        if (!contractorId && !isNewContractor) {
            throw new Error("Musisz wybrać istniejącego kontrahenta lub dodać nowego.")
        }

        if (isNewContractor && !newContractorName) {
            throw new Error("Nazwa nowego kontrahenta jest wymagana.")
        }

        if (!validateNonZero(amountNetStr)) {
            throw new Error("Kwota netto kosztu nie może wynosić zero.")
        }

        const tenantId = await getCurrentTenantId()
        const amountNet = new Decimal(amountNetStr)
        const taxRate = new Decimal(taxRateStr)
        const amountGross = new Decimal(amountGrossStr)

        const issueDate = new Date(dateStr)
        const dueDate = new Date(dueDateStr)

        const finalProjectId = (!projectId || projectId === "NONE") ? "" : projectId;

        if (!finalProjectId) {
            throw new Error("Wymagane przypisanie Projektu.");
        }

        const isPaidImmediately = formData.get("isPaidImmediately") === "true"

        // --- TARCZA ANTY-DUBEL (Anti-Double Shield) ---
        // Shield aktywuje się tylko jeśli podano nr faktury (externalId).
        // Dopasowano do NoSQL logic
        if (description) {
            const duplicateQuery = await adminDb.collection("invoices")
                .where("tenantId", "==", tenantId)
                .where("externalId", "==", description)
                .where("type", "==", "EXPENSE")
                .limit(1)
                .get()

            if (!duplicateQuery.empty) {
                throw new Error(`TARCZA ANTY-DUBEL: Faktura nr ${description} od tego dostawcy już została zaksięgowana!`)
            }
        }

        // retention
        const retainedAmountStr = formData.get("retainedAmount") as string
        const retentionReleaseDateStr = formData.get("retentionReleaseDate") as string
        const retainedAmount = retainedAmountStr ? new Decimal(retainedAmountStr) : null
        const retentionReleaseDate = retentionReleaseDateStr ? new Date(retentionReleaseDateStr) : null

        const invoiceId = await adminDb.runTransaction(async (transaction) => {
            let finalContractorId = contractorId

            // 1. Jeśli to nowy kontrahent, stwórz go najpierw
            if (isNewContractor) {
                const contractorRef = adminDb.collection("contractors").doc()
                transaction.set(contractorRef, {
                    tenantId,
                    name: newContractorName,
                    nip: newContractorNip || null,
                    address: newContractorAddress || null,
                    type: (newContractorName.toLowerCase().includes("hurtownia") || newContractorName.toLowerCase().includes("sklep")) ? "HURTOWNIA" : "DOSTAWCA",
                    status: "ACTIVE",
                    createdAt: new Date().toISOString()
                })
                finalContractorId = contractorRef.id

                // Opcjonalnie stwórz domyślny obiekt
                const objectRef = adminDb.collection("objects").doc()
                transaction.set(objectRef, {
                    contractorId: finalContractorId,
                    name: "Siedziba Główna",
                    address: newContractorAddress || null
                })
            }

            // 2. Zapisujemy Fakturę
            const invoiceRef = adminDb.collection("invoices").doc()
            transaction.set(invoiceRef, {
                tenantId,
                contractorId: finalContractorId,
                projectId: finalProjectId,
                type: "EXPENSE",
                amountNet: amountNet.toNumber(),
                amountGross: amountGross.toNumber(),
                taxRate: taxRate.toNumber(),
                issueDate: issueDate.toISOString(),
                dueDate: dueDate.toISOString(),
                status: isPaidImmediately ? "PAID" : "ACTIVE",
                externalId: description,
                retainedAmount: retainedAmount ? retainedAmount.toNumber() : null,
                retentionReleaseDate: retentionReleaseDate ? retentionReleaseDate.toISOString() : null,
                createdAt: new Date().toISOString()
            })

            // 3. Transakcja powiązana
            if (isPaidImmediately) {
                const transRef = adminDb.collection("transactions").doc()
                transaction.set(transRef, {
                    tenantId,
                    projectId: finalProjectId,
                    classification: "PROJECT_COST",
                    amount: amountGross.toNumber(),
                    type: "EXPENSE",
                    transactionDate: issueDate.toISOString(),
                    category: category || "KOSZT_FIRMOWY",
                    description: `Wydatek Netto: ${amountNet.toString()} | Faktura: ${description || 'Brak wpisanego numeru'}`,
                    status: "ACTIVE",
                    source: "INVOICE",
                    invoiceId: invoiceRef.id,
                    createdAt: new Date().toISOString()
                })
            }
            return { invoiceId: invoiceRef.id, contractorId: finalContractorId }
        })

        // 4. Prisma Sync
        // Uwaga: Jeśli contractor jest nowy, Prisma może go jeszcze nie mieć jeśli sync nie jest atomowy.
        // Ale tutaj używamy IDs z Firestore, więc powinno być OK jeśli Prisma dostanie dane.
        // Wypadałoby zsynchronizować też Contractora jeśli jest nowy.
        // 4. Prisma Sync Rollback Wrapper
        try {
            if (isNewContractor) {
                await (prisma.contractor.create as any)({
                    data: {
                        id: invoiceId.contractorId,
                        tenantId,
                        name: newContractorName,
                        nip: newContractorNip || null,
                        address: newContractorAddress || null,
                        type: (newContractorName.toLowerCase().includes("hurtownia") || newContractorName.toLowerCase().includes("sklep")) ? "HURTOWNIA" : "DOSTAWCA",
                        status: "ACTIVE"
                    }
                })
                // Obiekt
                await prisma.object.create({
                    data: {
                        contractorId: invoiceId.contractorId,
                        name: "Siedziba Główna",
                        address: newContractorAddress || null
                    }
                })
            }

            await prisma.invoice.create({
                data: {
                    id: invoiceId.invoiceId,
                    tenantId,
                    contractorId: invoiceId.contractorId,
                    projectId: finalProjectId,
                    type: "EXPENSE",
                    amountNet: amountNet.toNumber(),
                    amountGross: amountGross.toNumber(),
                    taxRate: taxRate.toNumber(),
                    issueDate,
                    dueDate,
                    status: isPaidImmediately ? "PAID" : "ACTIVE",
                    externalId: description,
                    retainedAmount: retainedAmount ? retainedAmount.toNumber() : null,
                    retentionReleaseDate
                }
            })

            if (isPaidImmediately) {
                const transSnap = await adminDb.collection("transactions").where("invoiceId", "==", invoiceId.invoiceId).limit(1).get()
                if (!transSnap.empty) {
                    const tDoc = transSnap.docs[0]
                    const prismaTrans = await (prisma.transaction.create as any)({
                        data: {
                            id: tDoc.id,
                            tenantId,
                            projectId: finalProjectId,
                            classification: "PROJECT_COST",
                            amount: amountGross.toNumber(),
                            type: "EXPENSE",
                            transactionDate: issueDate,
                            category: category || "KOSZT_FIRMOWY",
                            description: `Faktura: ${description || 'Brak wpisanego numeru'}`,
                            status: "ACTIVE",
                            source: "INVOICE"
                        }
                    })

                    await prisma.invoicePayment.create({
                        data: {
                            invoiceId: invoiceId.invoiceId,
                            transactionId: prismaTrans.id,
                            amountApplied: amountGross.toNumber()
                        }
                    })
                }
            }
        } catch (prismaError: any) {
            // Rollback w Firebase
            await adminDb.collection("invoices").doc(invoiceId.invoiceId).delete()
            if (isNewContractor) {
                await adminDb.collection("contractors").doc(invoiceId.contractorId).delete()
                const objQuery = await adminDb.collection("objects").where("contractorId", "==", invoiceId.contractorId).get()
                for (const doc of objQuery.docs) {
                    await doc.ref.delete()
                }
            }
            const orphans = await adminDb.collection("transactions").where("invoiceId", "==", invoiceId.invoiceId).get()
            for (const doc of orphans.docs) {
                await doc.ref.delete()
            }
            throw new Error("Błąd synchronizacji relacyjnej (Prisma). Transakcja wycofana. " + prismaError.message)
        }

        revalidatePath("/")
        revalidatePath("/projects")
        revalidatePath("/finance")

        return { success: true }
    } catch (error: any) {
        console.error("[ADD_COST_INVOICE_ERROR]", error)
        return { success: false, error: error.message || "Wystąpił błąd przy dodawaniu kosztu." }
    }
}

export async function markInvoiceAsPaid(invoiceId: string, paymentDateStr: string) {
    try {
        const adminDb = getAdminDb()
        if (!invoiceId || !paymentDateStr) {
            throw new Error("Brak wymaganego ID faktury lub daty płatności.");
        }

        const tenantId = await getCurrentTenantId()
        const paymentDate = new Date(paymentDateStr)

        const invData = await adminDb.runTransaction(async (transaction) => {
            const invoiceRef = adminDb.collection("invoices").doc(invoiceId)
            const invDoc = await transaction.get(invoiceRef)

            if (!invDoc.exists) throw new Error("Faktura nie istnieje.")
            const inv = invDoc.data()!
            if (inv.tenantId !== tenantId) throw new Error("Brak dostępu do tej faktury.")
            if (inv.status === "PAID") return null // Idempotentność

            // 1. Aktualizuj status faktury w Firestore
            transaction.update(invoiceRef, {
                status: "PAID",
                updatedAt: new Date().toISOString()
            })

            // 2. Stwórz transakcję w Firestore
            const transRef = adminDb.collection("transactions").doc()
            transaction.set(transRef, {
                tenantId,
                projectId: inv.projectId,
                classification: "PROJECT_COST",
                amount: inv.amountGross,
                type: inv.type === "SPRZEDAŻ" ? "PRZYCHÓD" : "EXPENSE",
                transactionDate: paymentDate.toISOString(),
                category: inv.type === "SPRZEDAŻ" ? "SPRZEDAŻ_TOWARU" : "KOSZT_FIRMOWY",
                description: `[Potwierdzenie Wpłaty] Rozliczenie faktury: ${inv.externalId || 'Brak numeru'}`,
                status: "ACTIVE",
                source: "INVOICE",
                invoiceId: invoiceId,
                createdAt: new Date().toISOString()
            })
            return { inv, transId: transRef.id }
        })

        if (invData) {
            const { inv, transId } = invData;
            // 3. Prisma Sync Rollback Wrapper
            try {
                await prisma.invoice.update({
                    where: { id: invoiceId },
                    data: { status: "PAID" }
                })

                const prismaTrans = await (prisma.transaction.create as any)({
                    data: {
                        id: transId,
                        tenantId,
                        projectId: inv.projectId,
                        classification: "PROJECT_COST",
                        amount: inv.amountGross,
                        type: inv.type === "SPRZEDAŻ" ? "PRZYCHÓD" : "EXPENSE",
                        transactionDate: paymentDate,
                        category: inv.type === "SPRZEDAŻ" ? "SPRZEDAŻ_TOWARU" : "KOSZT_FIRMOWY",
                        description: `[Potwierdzenie Wpłaty] Faktura: ${inv.externalId || 'Brak numeru'}`,
                        status: "ACTIVE",
                        source: "INVOICE"
                    }
                })

                await prisma.invoicePayment.create({
                    data: {
                        invoiceId: invoiceId,
                        transactionId: prismaTrans.id,
                        amountApplied: inv.amountGross
                    }
                })
            } catch (prismaError: any) {
                // Rollback statusu i usunięcie transakcji z Firestore
                await adminDb.collection("invoices").doc(invoiceId).update({ status: inv.status, updatedAt: new Date().toISOString() })
                await adminDb.collection("transactions").doc(transId).delete()
                throw new Error("Błąd synchronizacji relacyjnej (Prisma). Płatność wycofana. " + prismaError.message)
            }
        }

        revalidatePath("/")
        revalidatePath("/projects")
        revalidatePath("/finance")

        return { success: true }
    } catch (error: any) {
        console.error("[MARK_PAID_ERROR]", error)
        return { success: false, error: error.message || "Wystąpił błąd przy oznaczaniu jako opłacone." }
    }
}
