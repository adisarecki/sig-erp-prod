import { TooltipHelp } from "@/components/ui/TooltipHelp"
import { AddContractorModal } from "@/components/crm/AddContractorModal"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export default async function CRMPage() {
    const contractors = await prisma.contractor.findMany({
        orderBy: { createdAt: "desc" }
    })

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <div className="flex items-center">
                        <h1 className="text-3xl font-bold tracking-tight">Kontrahenci (CRM)</h1>
                        <TooltipHelp content="Baza firm powiązana z finansami i projektami. Status ACTIVE to klient standardowy, natomiast IN_REVIEW oznacza wstrzymane projekty lub obniżoną wiarygodność kredytową (Rating) - blokuje on tworzenie nowych umów." />
                    </div>
                    <p className="text-slate-500 mt-1">Zarządzaj firmami, osobami kontaktowymi i historią relacji.</p>
                </div>
                <AddContractorModal />
            </div>

            <div className="grid gap-4">
                {contractors.map((contractor: any) => (
                    <div key={contractor.id} className="bg-white rounded-xl border shadow-sm p-6 flex justify-between items-center">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">{contractor.name}</h2>
                            <p className="text-slate-500 text-sm mt-1">
                                {contractor.nip ? `NIP: ${contractor.nip}` : "Brak NIP"} • {contractor.address || "Brak adresu"}
                            </p>
                        </div>
                        <div>
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${contractor.status === 'ACTIVE' ? 'bg-green-50 text-green-700 border-green-200' :
                                    contractor.status === 'IN_REVIEW' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                        'bg-slate-100 text-slate-700 border-slate-200'
                                }`}>
                                {contractor.status}
                            </span>
                        </div>
                    </div>
                ))}

                {contractors.length === 0 && (
                    <div className="bg-white rounded-xl border shadow-sm p-8 text-center text-slate-500">
                        Brak kontrahentów w bazie. Dodaj pierwszą firmę, aby rozpocząć.
                    </div>
                )}
            </div>
        </div>
    );
}
