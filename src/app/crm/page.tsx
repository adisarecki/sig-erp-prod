export const dynamic = "force-dynamic"
import { TooltipHelp } from "@/components/ui/TooltipHelp"
import { AddContractorModal } from "@/components/crm/AddContractorModal"
import { CRMContainer } from "@/components/crm/CRMContainer"
import { DatabaseHealer } from "@/components/crm/DatabaseHealer"
import { Upload } from "lucide-react"
import Link from "next/link"
import { getContractors } from "@/app/actions/crm"
import { getAdminDb } from "@/lib/firebaseAdmin"
import { getCurrentTenantId } from "@/lib/tenant"

export default async function CRMPage() {
    const contractors = (await getContractors()) as any[]

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <div className="flex items-center">
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 leading-none">Kontrahenci</h1>
                        <TooltipHelp content="Pełna baza firm, dostawców i partnerów biznesowych. Integracja z finansami i projektami." />
                    </div>
                    <div className="flex items-center gap-3">
                        <p className="text-slate-500 mt-2 font-medium">Zarządzaj partnerami biznesowymi, osobami kontaktowymi i historią współpracy.</p>
                        <div className="mt-2">
                            <DatabaseHealer />
                        </div>
                    </div>
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

            <CRMContainer contractors={contractors} />
        </div>
    );
}
