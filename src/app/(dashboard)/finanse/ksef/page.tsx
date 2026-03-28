import { getCurrentTenantId } from "@/lib/tenant"
import prisma from "@/lib/prisma"
import { KSeFInboxClient } from "@/components/finance/ksef/KSeFInboxClient"
import { ShieldAlert } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function KSeFInboxPage() {
    const tenantId = await getCurrentTenantId()

    // Pobranie danych KSeF
    const ksefInvoices = await prisma.invoice.findMany({
        where: {
            tenantId,
            ksefId: { not: null },
            status: { in: ["ACTIVE", "XML_MISSING"] }
        },
        include: { contractor: true },
        orderBy: { issueDate: "desc" }
    })

    // Pobranie Oczekujących Kontrahentów z nowymi kontami bankowymi
    const pendingContractors = await prisma.contractor.findMany({
        where: {
            tenantId,
            status: "PENDING"
        },
        orderBy: { createdAt: "desc" }
    })

    // Uproszczenie typu Invoice i Contractor dla Client Componentu powiązanych z KSeF
    const mappedInvoices = ksefInvoices.map(inv => ({
        id: inv.id,
        ksefId: inv.ksefId,
        invoiceNumber: inv.invoiceNumber || inv.ksefId || "Brak",
        contractorName: inv.contractor?.name || "Nieznany",
        nip: inv.contractor?.nip || "Brak",
        amountGross: Number(inv.amountGross),
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        paymentStatus: inv.paymentStatus,
        ksefType: inv.ksefType || "Faktura",
        type: inv.type,
        status: inv.status
    }))

    const mappedContractors = pendingContractors.map(c => ({
        id: c.id,
        name: c.name,
        nip: c.nip,
        address: c.address,
        bankAccounts: c.bankAccounts, // Pobrane konta z KSeF XML
        createdAt: c.createdAt
    }))

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight italic">Panel KSeF</h1>
                <p className="text-slate-500 font-medium">Brama do Krajowego Systemu e-Faktur • <span className="text-slate-900 uppercase font-bold text-xs bg-slate-100 px-2 py-1 rounded">Sync V2.0</span></p>
            </div>

            {mappedContractors.length > 0 && (
                <div className="bg-orange-50 border-2 border-orange-200 p-4 rounded-xl flex items-start gap-3">
                    <ShieldAlert className="text-orange-500 w-6 h-6 mt-0.5 shrink-0" />
                    <div>
                        <h3 className="font-bold text-orange-800 uppercase text-sm tracking-tight">Wymagana Akcja: Nowi Oczekujący Dostawcy ({mappedContractors.length})</h3>
                        <p className="text-sm text-orange-700 font-medium mt-1">System pobrał nowe faktury na firmy, których nie masz w bazie. Zanim zaksięgujesz wydatki, przejdź do zakładki "Dostawcy" i zaakceptuj ich konta bankowe.</p>
                    </div>
                </div>
            )}

            <KSeFInboxClient 
                initialInvoices={mappedInvoices} 
                pendingContractors={mappedContractors} 
            />
        </div>
    )
}
