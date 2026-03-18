"use server"

import { revalidatePath } from "next/cache"
import Decimal from "decimal.js"
import { validateNonZero } from "@/lib/ledger"
import { getCurrentTenantId } from "@/lib/tenant"
import { adminDb } from "@/lib/firebase/admin"


export async function addIncomeInvoice(formData: FormData) {
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


    await adminDb.runTransaction(async (transaction) => {
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
    })

    revalidatePath("/")
    revalidatePath("/projects")
    revalidatePath("/finance")

    return { success: true }
}

export async function addCostInvoice(formData: FormData) {
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
    const newContractorNip = formData.get("newContractorNip") as string
    const newContractorAddress = formData.get("newContractorAddress") as string

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
            .where("type", "==", "KOSZT")
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

    await adminDb.runTransaction(async (transaction) => {
        let finalContractorId = contractorId

        // 1. Jeśli to nowy kontrahent, stwórz go najpierw
        if (isNewContractor) {
            const contractorRef = adminDb.collection("contractors").doc()
            transaction.set(contractorRef, {
                tenantId,
                name: newContractorName,
                nip: newContractorNip || null,
                address: newContractorAddress || null,
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
            type: "KOSZT",
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
                amount: amountGross.toNumber(),
                type: "KOSZT",
                transactionDate: issueDate.toISOString(),
                category: category || "KOSZT_FIRMOWY",
                description: `Wydatek Netto: ${amountNet.toString()} | Faktura: ${description || 'Brak wpisanego numeru'}`,
                status: "ACTIVE",
                source: "INVOICE",
                invoiceId: invoiceRef.id,
                createdAt: new Date().toISOString()
            })
        }
    })

    revalidatePath("/")
    revalidatePath("/projects")
    revalidatePath("/finance")

    return { success: true }
}

export async function markInvoiceAsPaid(invoiceId: string, paymentDateStr: string) {
    if (!invoiceId || !paymentDateStr) {
        throw new Error("Brak wymaganego ID faktury lub daty płatności.");
    }

    const tenantId = await getCurrentTenantId()
    const paymentDate = new Date(paymentDateStr)

    await adminDb.runTransaction(async (transaction) => {
        const invoiceRef = adminDb.collection("invoices").doc(invoiceId)
        const invDoc = await transaction.get(invoiceRef)
        
        if (!invDoc.exists) throw new Error("Faktura nie istnieje.")
        const inv = invDoc.data()!
        if (inv.tenantId !== tenantId) throw new Error("Brak dostępu do tej faktury.")
        if (inv.status === "PAID") return // Idempotentność

        // 1. Aktualizuj status faktury
        transaction.update(invoiceRef, { 
            status: "PAID", 
            updatedAt: new Date().toISOString() 
        })

        // 2. Stwórz transakcję (Zasilenie Dashboardu)
        const transRef = adminDb.collection("transactions").doc()
        transaction.set(transRef, {
            tenantId,
            projectId: inv.projectId,
            amount: inv.amountGross,
            type: inv.type === "SPRZEDAŻ" ? "PRZYCHÓD" : "KOSZT",
            transactionDate: paymentDate.toISOString(),
            category: inv.type === "SPRZEDAŻ" ? "SPRZEDAŻ_TOWARU" : "KOSZT_FIRMOWY",
            description: `[Potwierdzenie Wpłaty] Rozliczenie faktury: ${inv.externalId || 'Brak numeru'}`,
            status: "ACTIVE",
            source: "INVOICE",
            invoiceId: invoiceId,
            createdAt: new Date().toISOString()
        })
    })

    revalidatePath("/")
    revalidatePath("/projects")
    revalidatePath("/finance")

    return { success: true }
}
