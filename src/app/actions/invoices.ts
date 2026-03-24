"use server"

import { revalidatePath } from "next/cache"
import Decimal from "decimal.js"
import { validateNonZero } from "@/lib/ledger"
import { getCurrentTenantId } from "@/lib/tenant"
import { getAdminDb } from "@/lib/firebaseAdmin"
import prisma from "@/lib/prisma"


export async function deleteInvoice(id: string): Promise<{ success: boolean, error?: string }> {
    try {
        const adminDb = getAdminDb()

        // 1. Znajdź powiązane transakcje (source: INVOICE)
        const payments = await prisma.invoicePayment.findMany({
            where: { invoiceId: id },
            include: { transaction: true }
        })

        const transactionIdsToDelete = payments
            .filter(p => p.transaction.source === "INVOICE")
            .map(p => p.transaction.id)

        // 2. Firestore Deletion (Batch/Transaction)
        await adminDb.runTransaction(async (transaction) => {
            // Usuń fakturę
            transaction.delete(adminDb.collection("invoices").doc(id))
            
            // Usuń powiązane transakcje w Firestore
            for (const txId of transactionIdsToDelete) {
                transaction.delete(adminDb.collection("transactions").doc(txId))
            }
        })

        // 3. Prisma Deletion (Cascading cleanup)
        // Uwaga: InvoicePayment ma onDelete: Cascade dla Transaction w schema? 
        // Sprawdźmy schema: 
        // InvoicePayment -> Transaction (onDelete: Cascade)
        // InvoicePayment -> Invoice (brak onDelete specified, domyślnie Restrict?)
        
        // Bezpieczne usuwanie kolejno:
        await prisma.$transaction(async (tx) => {
            // Usuń powiązania i transakcje
            await tx.invoicePayment.deleteMany({ where: { invoiceId: id } })
            
            if (transactionIdsToDelete.length > 0) {
                await tx.transaction.deleteMany({
                    where: { id: { in: transactionIdsToDelete } }
                })
            }

            // Usuń samą fakturę
            await tx.invoice.delete({ where: { id } })
        })

        revalidatePath("/finance")
        revalidatePath("/projects")
        revalidatePath("/")

        return { success: true }
    } catch (error: unknown) {
        console.error("[INVOICE_DELETE_ERROR]", error)
        return { success: false, error: error instanceof Error ? error.message : "Błąd podczas usuwania dokumentu." }
    }
}

export async function markInvoiceAsPaid(id: string, paymentDateOverride?: string): Promise<{ success: boolean, error?: string }> {
    try {
        const adminDb = getAdminDb()
        const tenantId = await getCurrentTenantId()

        // 1. Pobierz dane faktury z Prisma (SSoT dla relacji)
        const invoice = await prisma.invoice.findUnique({
            where: { id, tenantId },
            include: { contractor: true }
        })

        if (!invoice) throw new Error("Nie znaleziono dokumentu.")
        if (invoice.status === "PAID") return { success: true }

        const paymentDate = paymentDateOverride ? new Date(paymentDateOverride) : new Date()
        const amountGross = Number(invoice.amountGross)

        // 2. Firestore Update (Transaction)
        await adminDb.runTransaction(async (transaction) => {
            const invoiceRef = adminDb.collection("invoices").doc(id)
            transaction.update(invoiceRef, {
                status: "PAID",
                updatedAt: paymentDate.toISOString()
            })

            // Stwórz transakcję w Firestore
            const transRef = adminDb.collection("transactions").doc()
            const isIncome = invoice.type === "SPRZEDAŻ"
            const classification = invoice.projectId ? "PROJECT_COST" : "GENERAL_COST"
            
            transaction.set(transRef, {
                tenantId,
                projectId: invoice.projectId,
                classification,
                amount: amountGross,
                type: isIncome ? "PRZYCHÓD" : "KOSZT",
                transactionDate: paymentDate.toISOString(),
                category: isIncome ? "SPRZEDAŻ_TOWARU" : "KOSZT_FIRMOWY",
                description: `Płatność faktury: ${invoice.externalId || 'Brak numeru'}`,
                status: "ACTIVE",
                source: "INVOICE",
                invoiceId: id,
                createdAt: paymentDate.toISOString(),
                updatedAt: paymentDate.toISOString()
            })
        })

        // 3. Prisma Sync (Syncing created transaction and payment link)
        await prisma.$transaction(async (tx) => {
            // Update Invoice
            await tx.invoice.update({
                where: { id },
                data: { status: "PAID" }
            })

            // Find the Firestore transaction we just created
            const transSnap = await adminDb.collection("transactions").where("invoiceId", "==", id).limit(1).get()
            if (!transSnap.empty) {
                const tDoc = transSnap.docs[0]
                const tData = tDoc.data()
                
                // Create Transaction in Prisma
                const prismaTrans = await tx.transaction.create({
                    data: {
                        id: tDoc.id,
                        tenantId,
                        projectId: invoice.projectId,
                        classification: tData.classification,
                        amount: amountGross,
                        type: tData.type,
                        transactionDate: paymentDate,
                        category: tData.category,
                        description: tData.description,
                        status: "ACTIVE",
                        source: "INVOICE"
                    }
                })

                // Create InvoicePayment link
                await tx.invoicePayment.create({
                    data: {
                        invoiceId: id,
                        transactionId: prismaTrans.id,
                        amountApplied: amountGross
                    }
                })
            }
        })

        revalidatePath("/finance")
        revalidatePath("/projects")
        revalidatePath("/")

        return { success: true }
    } catch (error: unknown) {
        console.error("[INVOICE_MARK_PAID_ERROR]", error)
        return { success: false, error: error instanceof Error ? error.message : "Błąd podczas oznaczania jako zapłacone." }
    }
}
export async function getAutoMatchData(nip: string) {
    try {
        const tenantId = await getCurrentTenantId()
        const cleanNip = nip.replace(/\D/g, "")
        if (!cleanNip || cleanNip.length < 10) return null

        const contractor = await prisma.contractor.findFirst({
            where: { tenantId, nip: cleanNip }
        })

        if (!contractor) return null

        // Znajdź ostatnią fakturę dla tego kontrahenta
        const lastInvoice = await prisma.invoice.findFirst({
            where: { tenantId, contractorId: contractor.id },
            orderBy: { issueDate: "desc" },
            include: {
                payments: {
                    include: {
                        transaction: true
                    },
                    take: 1
                }
            }
        })

        return {
            contractorId: contractor.id,
            contractorName: contractor.name,
            lastProjectId: lastInvoice?.projectId || "GENERAL",
            lastCategory: lastInvoice?.payments[0]?.transaction?.category || "KOSZT_FIRMOWY"
        }
    } catch (error: unknown) {
        console.error("[GET_AUTO_MATCH_ERROR]", error)
        return null
    }
}

export async function addIncomeInvoice(formData: FormData) {
    try {
        const adminDb = getAdminDb()
        const amountNetStr = formData.get("amountNet") as string
        const taxRateStr = formData.get("taxRate") as string
        const amountGrossStr = formData.get("amountGross") as string
        const dateStr = formData.get("date") as string
        const dueDateStr = formData.get("dueDate") as string

        const category = formData.get("category") as string
        const projectIdRaw = formData.get("projectId") as string || ""
        const projectId = (projectIdRaw === "none" || projectIdRaw === "NONE" || projectIdRaw === "GENERAL" || projectIdRaw === "INTERNAL") ? "" : projectIdRaw
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


        const txResult = await adminDb.runTransaction(async (transaction) => {
            let finalContractorId = contractorId
            let finalProjectId = (projectIdRaw === "none" || projectIdRaw === "NONE" || projectIdRaw === "GENERAL" || projectIdRaw === "INTERNAL") ? "" : (projectId || "")

            // --- 0. PROJEKT (Quick Add) ---
            const isNewProject = formData.get("isNewProject") === "true"
            const newProjectName = formData.get("newProjectName") as string

            if (isNewProject && newProjectName) {
                const projectRef = adminDb.collection("projects").doc()
                transaction.set(projectRef, {
                    tenantId,
                    name: newProjectName,
                    contractorId: finalContractorId || null,
                    status: "PLANNED",
                    budgetEstimated: 0,
                    createdAt: new Date().toISOString()
                })
                finalProjectId = projectRef.id
            }

            // 1. Jeśli to nowy kontrahent, sprawdź czy NIP już istnieje (Intelligent Upsert)
            // Szukamy po NIP w Firestore i Prisma, aby uniknąć błędów unikalności
            if (isNewContractor) {
                if (newContractorNip) {
                    // Firestore Check
                    const existingContractorQuery = await adminDb.collection("contractors")
                        .where("tenantId", "==", tenantId)
                        .where("nip", "==", newContractorNip)
                        .limit(1)
                        .get()
                    
                    if (!existingContractorQuery.empty) {
                        finalContractorId = existingContractorQuery.docs[0].id
                    } else {
                        // Prisma Check (Backup for Dual-Sync Drift)
                        const prismaContractor = await prisma.contractor.findFirst({
                            where: { tenantId, nip: newContractorNip }
                        })
                        if (prismaContractor) {
                            finalContractorId = prismaContractor.id
                        }
                    }
                }

                // Jeśli nadal nie mamy ID, stwórz nowego
                if (!finalContractorId) {
                    const contractorRef = adminDb.collection("contractors").doc()
                    transaction.set(contractorRef, {
                        tenantId,
                        name: newContractorName,
                        nip: newContractorNip || null,
                        address: newContractorAddress || null,
                        type: "INWESTOR",
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

                // Jeśli projekt był nowy, przypisz mu nowo utworzonego kontrahenta
                if (isNewProject && finalProjectId) {
                    transaction.update(adminDb.collection("projects").doc(finalProjectId), {
                        contractorId: finalContractorId
                    })
                }
            }

            // 2. Zapisujemy Fakturę
            const invoiceRef = adminDb.collection("invoices").doc()
            transaction.set(invoiceRef, {
                tenantId,
                contractorId: finalContractorId,
                projectId: finalProjectId,
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

            // 3. Transakcja powiązana (Tylko jeśli opłacono od razu)
            if (isPaidImmediately) {
                const transRef = adminDb.collection("transactions").doc()
                const classificationValue = (projectIdRaw === "INTERNAL") ? "INTERNAL_COST" : (finalProjectId ? "PROJECT_COST" : "GENERAL_COST")
                transaction.set(transRef, {
                    tenantId,
                    projectId: finalProjectId || null,
                    classification: classificationValue,
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
            return { invoiceId: invoiceRef.id, contractorId: finalContractorId, projectId: finalProjectId }
        })

        // 4. Prisma Sync
        try {
            let prismaContractorId = txResult.contractorId
            if (isNewContractor) {
                const existingPrismaContractor = await prisma.contractor.findFirst({
                    where: { 
                        tenantId,
                        OR: [
                            { id: txResult.contractorId },
                            { nip: newContractorNip }
                        ]
                    }
                })

                if (existingPrismaContractor) {
                    prismaContractorId = existingPrismaContractor.id
                } else {
                    await prisma.contractor.create({
                        data: {
                            id: txResult.contractorId,
                            tenantId,
                            name: newContractorName,
                            nip: newContractorNip || null,
                            address: newContractorAddress || null,
                            type: "INWESTOR",
                            status: "ACTIVE"
                        }
                    })
                    
                    await prisma.object.create({
                        data: {
                            contractorId: txResult.contractorId,
                            name: "Siedziba Główna",
                            address: newContractorAddress || null
                        }
                    })
                }
            }

            // --- PROJEKT (Find-or-Create) ---
            const isNewProject = formData.get("isNewProject") === "true"
            const newProjectName = formData.get("newProjectName") as string

            if (isNewProject && txResult.projectId && newProjectName) {
                const existingPrismaProject = await prisma.project.findUnique({
                    where: { id: txResult.projectId }
                })
                if (!existingPrismaProject) {
                    let targetObjectId: string | undefined
                    const existingObject = await prisma.object.findFirst({
                        where: { contractorId: prismaContractorId }
                    })
                    
                    if (existingObject) {
                        targetObjectId = existingObject.id
                    } else {
                        const newObj = await prisma.object.create({
                            data: {
                                contractorId: prismaContractorId,
                                name: "Siedziba Główna"
                            }
                        })
                        targetObjectId = newObj.id
                    }

                    await prisma.project.create({
                        data: {
                            id: txResult.projectId,
                            tenantId,
                            name: newProjectName,
                            contractorId: prismaContractorId,
                            objectId: targetObjectId!,
                            type: "INWESTYCJA",
                            status: "PLANNED",
                            budgetEstimated: 0
                        }
                    })
                }
            }

            await prisma.invoice.create({
                data: {
                    id: txResult.invoiceId,
                    tenantId,
                    contractorId: prismaContractorId,
                    projectId: txResult.projectId || null,
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
                const transSnap = await adminDb.collection("transactions").where("invoiceId", "==", txResult.invoiceId).limit(1).get()
                if (!transSnap.empty) {
                    const tDoc = transSnap.docs[0]
                    // 3a. Tworzymy Transakcję w Prisma
                    const prismaTrans = await prisma.transaction.create({
                        data: {
                            id: tDoc.id,
                            tenantId,
                            projectId: txResult.projectId || null,
                            classification: (projectIdRaw === "INTERNAL") ? "INTERNAL_COST" : (txResult.projectId ? "PROJECT_COST" : "GENERAL_COST"),
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
                            invoiceId: txResult.invoiceId,
                            transactionId: prismaTrans.id,
                            amountApplied: amountGross.toNumber()
                        }
                    })
                }
            }
        } catch (prismaError: unknown) {
            // Rollback Firebase
            await adminDb.collection("invoices").doc(txResult.invoiceId).delete()
            if (isNewContractor) {
                await adminDb.collection("contractors").doc(txResult.contractorId).delete()
                const objQuery = await adminDb.collection("objects").where("contractorId", "==", txResult.contractorId).get()
                for (const doc of objQuery.docs) {
                    await doc.ref.delete()
                }
            }
            const orphans = await adminDb.collection("transactions").where("invoiceId", "==", txResult.invoiceId).get()
            for (const doc of orphans.docs) {
                await doc.ref.delete()
            }
            throw new Error("Błąd synchronizacji relacyjnej (Prisma). Dane w Firebase zostały wycofane. " + (prismaError instanceof Error ? prismaError.message : "Nieznany błąd"))
        }

        revalidatePath("/")
        revalidatePath("/projects")
        revalidatePath("/finance")

        return { success: true }
    } catch (error: unknown) {
        console.error("[ADD_INCOME_INVOICE_ERROR]", error)
        return { success: false, error: error instanceof Error ? error.message : "Wystąpił błąd przy dodawaniu przychodu." }
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

        const txResult = await adminDb.runTransaction(async (transaction) => {
            let finalContractorId = contractorId
            let finalProjectId = (projectId === "none" || projectId === "NONE" || projectId === "GENERAL" || projectId === "INTERNAL" || !projectId) ? "" : projectId

            // --- 0. PROJEKT (Quick Add) ---
            const isNewProject = formData.get("isNewProject") === "true"
            const newProjectName = formData.get("newProjectName") as string

            if (isNewProject && newProjectName) {
                const projectRef = adminDb.collection("projects").doc()
                transaction.set(projectRef, {
                    tenantId,
                    name: newProjectName,
                    contractorId: finalContractorId || null, // Will be updated if contractor is also new?
                    status: "PLANNED",
                    budgetEstimated: 0,
                    createdAt: new Date().toISOString()
                })
                finalProjectId = projectRef.id
            }

            // 1. Jeśli to nowy kontrahent, sprawdź czy NIP już istnieje
            if (isNewContractor) {
                if (newContractorNip) {
                    // Firestore Check
                    const existingContractorQuery = await adminDb.collection("contractors")
                        .where("tenantId", "==", tenantId)
                        .where("nip", "==", newContractorNip)
                        .limit(1)
                        .get()
                    
                    if (!existingContractorQuery.empty) {
                        finalContractorId = existingContractorQuery.docs[0].id
                    } else {
                        // Prisma Check (Backup for Dual-Sync Drift)
                        const prismaContractor = await prisma.contractor.findFirst({
                            where: { tenantId, nip: newContractorNip }
                        })
                        if (prismaContractor) {
                            finalContractorId = prismaContractor.id
                        }
                    }
                }

                // Jeśli nadal nie mamy ID, stwórz nowego
                if (!finalContractorId) {
                    const contractorRef = adminDb.collection("contractors").doc()
                    transaction.set(contractorRef, {
                        tenantId,
                        name: newContractorName,
                        nip: newContractorNip || null,
                        address: newContractorAddress || null,
                        type: "DOSTAWCA",
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
                
                // Jeśli projekt był nowy, przypisz mu nowo utworzonego kontrahenta
                if (isNewProject && finalProjectId) {
                    transaction.update(adminDb.collection("projects").doc(finalProjectId), {
                        contractorId: finalContractorId
                    })
                }
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

            const isGeneralCost = !finalProjectId || finalProjectId === "GENERAL" || finalProjectId === "NONE" || finalProjectId === ""
            const classificationValue = (projectId === "INTERNAL") ? "INTERNAL_COST" : (!isGeneralCost ? "PROJECT_COST" : "GENERAL_COST")
            const safeProjectId = isGeneralCost ? null : finalProjectId

            // 3. Transakcja powiązana
            if (isPaidImmediately) {
                const transRef = adminDb.collection("transactions").doc()
                transaction.set(transRef, {
                    tenantId,
                    projectId: safeProjectId,
                    classification: classificationValue,
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

            return { 
                invoiceId: invoiceRef.id, 
                contractorId: finalContractorId,
                isGeneralCost,
                safeProjectId,
                classificationValue
            }
        })

        // 4. Prisma Sync
        // Uwaga: Jeśli contractor jest nowy, Prisma może go jeszcze nie mieć jeśli sync nie jest atomowy.
        // Ale tutaj używamy IDs z Firestore, więc powinno być OK jeśli Prisma dostanie dane.
        // Wypadałoby zsynchronizować też Contractora jeśli jest nowy.
        // 4. Prisma Sync Rollback Wrapper
        try {
            let prismaContractorId = txResult.contractorId

            // --- KONTRAHENT (Find-or-Create) ---
            if (isNewContractor) {
                // Szukamy po NIP w Prisma (Ignorujemy spacje w NIP-ie zapisanym w bazie jeśli to możliwe, 
                // ale tu zrobimy po prostu findFirst po zgrubnym dopasowaniu)
                const existingPrismaContractor = await prisma.contractor.findFirst({
                    where: { 
                        tenantId,
                        OR: [
                            { id: txResult.contractorId },
                            { nip: newContractorNip }
                        ]
                    }
                })

                if (existingPrismaContractor) {
                    prismaContractorId = existingPrismaContractor.id
                } else {
                    // Tworzymy nowego jeśli nie znaleziono
                    await prisma.contractor.create({
                        data: {
                            id: txResult.contractorId,
                            tenantId,
                            name: newContractorName,
                            nip: newContractorNip || null,
                            address: newContractorAddress || null,
                            type: "DOSTAWCA",
                            status: "ACTIVE"
                        }
                    })
                    
                    // Obiekt domyślny
                    await prisma.object.create({
                        data: {
                            contractorId: txResult.contractorId,
                            name: "Siedziba Główna",
                            address: newContractorAddress || null
                        }
                    })
                }
            } else {
                // Jeśli wybieramy z listy, upewnijmy się że kontrahent istnieje w Prisma (Auto-Heal)
                const check = await prisma.contractor.findUnique({ where: { id: txResult.contractorId } })
                if (!check) {
                    const fsDoc = await adminDb.collection("contractors").doc(txResult.contractorId).get()
                    if (fsDoc.exists) {
                        const d = fsDoc.data()!
                        await prisma.contractor.create({
                            data: {
                                id: txResult.contractorId,
                                tenantId: d.tenantId,
                                name: d.name,
                                nip: d.nip || null,
                                address: d.address || null,
                                type: d.type || "DOSTAWCA"
                            }
                        })
                    }
                }
            }

            // --- PROJEKT (Find-or-Create) ---
            const isNewProject = formData.get("isNewProject") === "true"
            const newProjectName = formData.get("newProjectName") as string

            if (isNewProject && txResult.safeProjectId && newProjectName) {
                const existingPrismaProject = await prisma.project.findUnique({
                    where: { id: txResult.safeProjectId }
                })
                if (!existingPrismaProject) {
                    // Musimy mieć objectId. Szukamy dowolnego obiektu dla tego kontrahenta lub tworzymy domyślny.
                    let targetObjectId: string | undefined
                    const existingObject = await prisma.object.findFirst({
                        where: { contractorId: prismaContractorId }
                    })
                    
                    if (existingObject) {
                        targetObjectId = existingObject.id
                    } else {
                        // Tworzymy techniczny obiekt "Siedziba Główna" dla relacji
                        const newObj = await prisma.object.create({
                            data: {
                                contractorId: prismaContractorId,
                                name: "Siedziba Główna"
                            }
                        })
                        targetObjectId = newObj.id
                    }

                    await prisma.project.create({
                        data: {
                            id: txResult.safeProjectId,
                            tenantId,
                            name: newProjectName,
                            contractorId: prismaContractorId,
                            objectId: targetObjectId!,
                            type: "INWESTYCJA",
                            status: "PLANNED",
                            budgetEstimated: 0
                        }
                    })
                }
            }

            await prisma.invoice.create({
                data: {
                    id: txResult.invoiceId,
                    tenantId,
                    contractorId: prismaContractorId,
                    projectId: txResult.safeProjectId as string | null,
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
                const transSnap = await adminDb.collection("transactions").where("invoiceId", "==", txResult.invoiceId).limit(1).get()
                if (!transSnap.empty) {
                    const tDoc = transSnap.docs[0]
                    const prismaTrans = await prisma.transaction.create({
                        data: {
                            id: tDoc.id,
                            tenantId,
                            projectId: txResult.safeProjectId,
                            classification: txResult.classificationValue,
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
                            invoiceId: txResult.invoiceId,
                            transactionId: prismaTrans.id,
                            amountApplied: amountGross.toNumber()
                        }
                    })
                }
            }
        } catch (prismaError: unknown) {
            // Rollback w Firebase
            await adminDb.collection("invoices").doc(txResult.invoiceId).delete()
            if (isNewContractor) {
                await adminDb.collection("contractors").doc(txResult.contractorId).delete()
                const objQuery = await adminDb.collection("objects").where("contractorId", "==", txResult.contractorId).get()
                for (const doc of objQuery.docs) {
                    await doc.ref.delete()
                }
            }
            const orphans = await adminDb.collection("transactions").where("invoiceId", "==", txResult.invoiceId).get()
            for (const doc of orphans.docs) {
                await doc.ref.delete()
            }
            throw new Error("Błąd synchronizacji relacyjnej (Prisma). Transakcja wycofana. " + (prismaError instanceof Error ? prismaError.message : "Nieznany błąd"))
        }

        revalidatePath("/")
        revalidatePath("/projects")
        revalidatePath("/finance")

        return { success: true }
    } catch (error: unknown) {
        console.error("[ADD_COST_INVOICE_ERROR]", error)
        return { success: false, error: error instanceof Error ? error.message : "Wystąpił błąd przy dodawaniu kosztu." }
    }
}
