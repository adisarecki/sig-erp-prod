export const dynamic = "force-dynamic"
import { TooltipHelp } from "@/components/ui/TooltipHelp"
import prisma from "@/lib/prisma"
import { KSeFSyncButton } from "@/components/finance/KSeFSyncButton"
import { QuickActionsBar } from "@/components/finance/QuickActionsBar"
import { ArrowDownRight, ArrowUpRight, FileText } from "lucide-react"
import Link from "next/link"

import { scanForLeaks } from "@/lib/finance/leakage-detection"
import { LeakageAlerts } from "@/components/finance/LeakageAlerts"
import { getAdminDb } from "@/lib/firebaseAdmin"
import { getCurrentTenantId } from "@/lib/tenant"
import { getProjects } from "@/app/actions/projects"
import { getContractors } from "@/app/actions/crm"

import { TransactionHistory } from "@/components/finance/TransactionHistory"

// ... (existing functions)

export default async function FinancePage({ 
    searchParams 
}: { 
    searchParams: Promise<{ 
        filter?: string; 
        status?: string; 
        sort?: string; 
        year?: string;
    }> 
}) {
    const params = await searchParams
    const activeFilter = params.filter || 'ALL'
    const activeStatus = params.status || null
    const activeSort = params.sort || null
    const activeYear = params.year ? parseInt(params.year) : null

    const tenantId = await getCurrentTenantId()
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } }) as any
    let transactions: any[] = []
    let projectsMap: { id: string, name: string }[] = []
    let contractorsMap: { id: string, name: string }[] = []
    let leakageAlerts: any[] = []
    let fetchError: string | null = null

    try {
        leakageAlerts = await scanForLeaks(tenantId)

        // Pobieramy projekty z Firestore
        const rawProjects = (await getProjects()) as any[]
        projectsMap = rawProjects.map(p => ({ id: p.id, name: p.name }))

        // Pobieramy kontrahentów
        const rawContractors = (await getContractors()) as any[]
        contractorsMap = rawContractors.map(c => ({ id: c.id, name: c.name }))

        // Pobieramy transakcje z Firestore (Bank imports) i Invoices z Prisma (Single Source of Truth)
        const adminDb = getAdminDb()
        const [transactionsSnap, prismaInvoices] = await Promise.all([
            adminDb.collection("transactions").where("tenantId", "==", tenantId).get(),
            prisma.invoice.findMany({
                where: { 
                    tenantId,
                    status: { in: ['ACTIVE', 'XML_MISSING', 'PAID'] }
                },
                include: { contractor: true },
                orderBy: { issueDate: 'desc' }
            })
        ])

        const rawTransactions = transactionsSnap.docs.map(d => ({ id: d.id, ...d.data() as any })).filter(t => t.status === "ACTIVE")
        
        // Map Prisma Invoices to the expected internal format for historyItems
        const rawInvoices = prismaInvoices.map(inv => ({
            id: inv.id,
            tenantId: inv.tenantId,
            contractorId: inv.contractorId,
            projectId: inv.projectId,
            type: (inv.type === 'REVENUE' || inv.type === 'INCOME') ? 'INCOME' : 'EXPENSE', // Unified labels for UI logic
            amountNet: inv.amountNet.toNumber(),
            amountGross: inv.amountGross.toNumber(),
            taxRate: inv.taxRate.toNumber(),
            issueDate: inv.issueDate.toISOString(),
            dueDate: inv.dueDate.toISOString(),
            status: inv.status,
            paymentStatus: inv.paymentStatus,
            externalId: inv.invoiceNumber || inv.ksefId,
            description: inv.invoiceNumber || (inv.type === 'REVENUE' ? 'Faktura Sprzedaży' : 'Faktura Zakupu'), 
            category: inv.ksefType || 'VAT',
            createdAt: inv.createdAt.toISOString(),
            // Pass contractor name through to avoid double search
            contractorName: inv.contractor.name,
            contractorNip: inv.contractor.nip
        }))

        const now = new Date()

        // Grupowanie transakcji po invoiceId dla łatwego lookupu
        const txByInvoiceId = new Map<string, any>()
        rawTransactions.forEach(tx => {
            if (tx.invoiceId) {
                txByInvoiceId.set(tx.invoiceId, tx)
            }
        })

        const historyItems = [
            // 1. Transakcje wolne (bez powiązania z fakturą)
            ...rawTransactions
                .filter(tx => !tx.invoiceId)
                .map(t => {
                    // Enrich contractorName from matched contractor in DB
                    const matchedContractor = t.matchedContractorId
                        ? rawContractors.find((c: any) => c.id === t.matchedContractorId)
                        : null;

                    // UI Rendering Correction: NEVER show raw description as title.
                    // Priority: DB Name > clean extracted title > clean counterpartyRaw > category
                    const cleanTitle = (t.title && !t.title.startsWith('[Pipeline Import]') && !t.title.includes('Rachunek') && !t.title.includes('Nazwa'))
                        ? t.title
                        : (t.counterpartyRaw && !t.counterpartyRaw.includes('Rachunek') && !t.counterpartyRaw.includes('Nazwa'))
                            ? t.counterpartyRaw
                            : t.category || 'Transakcja Bankowa';

                    return ({
                        id: t.id,
                        isInvoice: false,
                        type: t.type,
                        title: matchedContractor?.name || cleanTitle,
                        documentNumber: t.externalId || null,
                        date: t.transactionDate,
                        amount: Number(t.amount),
                        amountNet: Number(t.amount),
                        projectId: t.projectId || null,
                        classification: t.classification || (t.projectId ? 'PROJECT_COST' : 'GENERAL_COST'),
                        statusBadge: 'OPŁACONA',
                        statusColor: 'bg-emerald-100 text-emerald-700',
                        counterpartyRaw: t.counterpartyRaw,
                        contractorName: matchedContractor?.name || null,
                        matchedContractorId: t.matchedContractorId,
                        tags: t.tags
                    });
                }),
            // 2. Faktury (z ewentualnie wstrzykniętym statusem płatności)
            ...rawInvoices.map(inv => {
                const isIncome = inv.type === 'SPRZEDAŻ'
                const dueDate = new Date(inv.dueDate)
                const linkedTx = txByInvoiceId.get(inv.id)
                const contractor = rawContractors.find(c => c.id === inv.contractorId)
                
                let badge = 'DO ZAPŁATY'
                let color = 'bg-amber-100 text-amber-700'
                let displayDate = inv.issueDate || inv.createdAt

                if (inv.status === 'PAID' || linkedTx) {
                    badge = 'OPŁACONA'
                    color = 'bg-emerald-100 text-emerald-700'
                    // Jeśli mamy transakcję, data płatności jest istotniejsza dla osi czasu
                    if (linkedTx) {
                        displayDate = linkedTx.transactionDate
                    }
                } else if (dueDate < now) {
                    badge = 'ZALEGŁA'
                    color = 'bg-rose-100 text-rose-700'
                }

                return {
                    id: inv.id,
                    isInvoice: true,
                    type: isIncome ? 'PRZYCHÓD' : 'KOSZT',
                    title: (inv as any).description || (inv as any).category || 'Dokument Finansowy',
                    documentNumber: inv.externalId,
                    date: displayDate,
                    dueDate: inv.dueDate,
                    amount: Number(inv.amountGross),
                    amountNet: Number(inv.amountNet),
                    projectId: inv.projectId || null,
                    classification: inv.projectId ? 'PROJECT_COST' : 'GENERAL_COST',
                    statusBadge: badge,
                    statusColor: color,
                    contractorId: inv.contractorId,
                    contractorName: (inv as any).contractorName || contractor?.name || 'Nieznany kontrahent',
                    nip: (inv as any).contractorNip || contractor?.nip || null
                }
            })
        ]

        transactions = historyItems
            .filter(t => {
                // Filter typu (Project/General)
                if (activeFilter === 'PROJECT' && t.classification !== 'PROJECT_COST') return false
                if (activeFilter === 'GENERAL' && t.classification !== 'GENERAL_COST') return false
                
                // Filter statusu (Vector 024)
                if (activeStatus === 'UNPAID') {
                    if (t.statusBadge === 'OPŁACONA') return false
                } else if (activeStatus === 'PAID') {
                    if (t.statusBadge !== 'OPŁACONA') return false
                }

                // Filter roku (Vector 024)
                if (activeYear) {
                    const itemYear = new Date(t.date).getFullYear()
                    if (itemYear !== activeYear) return false
                }

                return true
            })
            
        // Logika sortowania (Vector 024)
        if (activeSort === 'dueDate_ASC') {
            transactions.sort((a, b) => {
                const dateA = a.dueDate ? new Date(a.dueDate).getTime() : new Date(a.date).getTime()
                const dateB = b.dueDate ? new Date(b.dueDate).getTime() : new Date(b.date).getTime()
                return dateA - dateB
            })
        } else {
            transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        }

    } catch (err: any) {
        console.error("Finance Page fetch error:", err)
        fetchError = err.message || "Wystąpił nieoczekiwany błąd podczas pobierania danych z bazy."
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Finanse i Cash Flow</h1>
                    <p className="text-slate-500 mt-1">Wszystkie transakcje, faktury i zaciągnięte wyciągi z banku.</p>
                </div>
                <div className="flex items-center gap-3">
                    <TooltipHelp content="Moduł Łowca Kontrahentów - importuje historię z banku PKO BP do budowania bazy kontrahentów." />
                    <KSeFSyncButton 
                        hasToken={!!tenant?.ksefToken} 
                        variant="outline"
                        className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    />
                    <Link href="/finance/import" className="bg-white border text-blue-600 hover:bg-blue-50 hover:border-blue-200 border-slate-200 px-4 py-2 rounded-md font-medium transition cursor-pointer shadow-sm">
                        Import PKO BP
                    </Link>
                </div>
            </div>

            {fetchError && (
                <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200">
                    <p className="font-bold">Błąd wczytywania danych finances</p>
                    <p className="text-sm">{fetchError}</p>
                </div>
            )}

            {/* LEAKAGE DETECTION ALERTS */}
            <LeakageAlerts alerts={leakageAlerts} />

            {/* PANEL SZYBKICH AKCJI */}
            <QuickActionsBar projects={projectsMap} contractors={contractorsMap} />

            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="border-b border-slate-100 px-6 py-4 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-slate-500" /> Rejestr Transakcji
                    </h2>
                    
                    <div className="flex bg-slate-100 p-1 rounded-lg self-stretch sm:self-auto">
                        <Link 
                            href="/finance?filter=ALL"
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            WSZYSTKIE
                        </Link>
                        <Link 
                            href="/finance?filter=PROJECT"
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeFilter === 'PROJECT' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            PROJEKTOWE
                        </Link>
                        <Link 
                            href="/finance?filter=GENERAL"
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeFilter === 'GENERAL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            KOSZTY ADMINISTRACYJNE/OGÓLNE
                        </Link>
                    </div>
                </div>
                
                <TransactionHistory 
                    transactions={transactions} 
                    projectsMap={Object.fromEntries(projectsMap.map(p => [p.id, p.name]))}
                    allProjects={projectsMap}
                />
                
                {/* FOOTER SUMMARY BAR (Vector 097) */}
                <div className="bg-slate-900 text-white px-8 py-6 flex flex-col lg:flex-row justify-between items-center gap-6 border-t-4 border-indigo-500 rounded-b-xl">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Podsumowanie Widoku</span>
                        <span className="text-xs text-slate-400 font-medium italic">
                            {activeFilter === 'PROJECT' ? 'Wyfiltrowano: Tylko Koszty Projektowe' : activeFilter === 'GENERAL' ? 'Wyfiltrowano: Tylko Koszty Ogólne' : 'Bilans wszystkich dokumentów'}
                        </span>
                    </div>
                    
                    <div className="flex flex-wrap justify-center lg:justify-end gap-8 lg:gap-14">
                        <div className="text-center sm:text-right">
                            <p className="text-[10px] font-bold uppercase tracking-tight text-slate-400 mb-1">Netto (Razem)</p>
                            <p className="text-xl font-black text-indigo-100 italic">
                                {new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(
                                    transactions.reduce((sum, t) => sum + (t.amountNet || 0), 0)
                                )}
                            </p>
                        </div>
                        
                        <div className="text-center sm:text-right">
                            <p className="text-[10px] font-bold uppercase tracking-tight text-slate-400 mb-1">VAT (Podatek)</p>
                            <p className="text-xl font-black text-rose-400">
                                {new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(
                                    transactions.reduce((sum, t) => sum + ((t.amount || 0) - (t.amountNet || 0)), 0)
                                )}
                            </p>
                        </div>
                        
                        <div className="text-center sm:text-right border-l border-slate-700 pl-8">
                            <p className="text-[10px] font-bold uppercase tracking-tight text-slate-400 mb-1">Brutto (DO ZAPŁATY/SUMA)</p>
                            <p className="text-3xl font-black text-emerald-400 drop-shadow-sm">
                                {new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(
                                    transactions.reduce((sum, t) => sum + (t.amount || 0), 0)
                                )}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

