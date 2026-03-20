export const dynamic = "force-dynamic"
import { TooltipHelp } from "@/components/ui/TooltipHelp"
import { AddContractorModal } from "@/components/crm/AddContractorModal"
import { InteractiveCRMList } from "@/components/crm/InteractiveCRMList"
import { Upload } from "lucide-react"
import Link from "next/link"
import { getContractors } from "@/app/actions/crm"
import { getAdminDb } from "@/lib/firebaseAdmin"
import { getCurrentTenantId } from "@/lib/tenant"

export default async function CRMPage() {
    const tenantId = await getCurrentTenantId()
    const rawContractors = (await getContractors()) as any[]
    
    // Fetch related invoices to avoid client-side crash
    const adminDb = getAdminDb()
    const invoicesSnap = await adminDb.collection("invoices")
        .where("tenantId", "==", tenantId)
        .get()
    
    const allInvoices = invoicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }))

    // Merge invoices into contractors
    const contractors = rawContractors.map(c => ({
        ...c,
        invoices: allInvoices.filter(inv => inv.contractorId === c.id)
    }))

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <div className="flex items-center">
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 leading-none">Kontrahenci</h1>
                        <TooltipHelp content="Pełna baza firm, dostawców i partnerów biznesowych. Integracja z finansami i projektami." />
                    </div>
                    <p className="text-slate-500 mt-2 font-medium">Zarządzaj partnerami biznesowymi, osobami kontaktowymi i historią współpracy.</p>
                </div>
                <div className="flex items-center gap-2">
                    <TooltipHelp content="Importuj kontrahentów automatycznie z historii bankowej PKO BP. Obsługuje formaty XML (ISO 20022) i CSV." />
                    <Link
                        href="/finance/import?returnTo=/crm"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 font-medium text-sm transition-all shadow-sm"
                    >
                        <Upload className="w-4 h-4" />
                        Importuj z Banku (XML/CSV)
                    </Link>
                    <AddContractorModal />
                </div>
            </div>

            <InteractiveCRMList contractors={contractors} />
        </div>
    );
}
