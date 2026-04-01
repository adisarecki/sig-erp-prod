import { getCurrentTenantId } from "@/lib/tenant"
import prisma from "@/lib/prisma"
export const dynamic = "force-dynamic";
import { AssetsTable } from "@/components/assets/AssetsTable"
import { Button } from "@/components/ui/button"
import { Plus, PackageSearch, TrendingDown, ClipboardCheck } from "lucide-react"

export default async function AssetsPage() {
    const tenantId = await getCurrentTenantId()
    
    const assets = await prisma.asset.findMany({
        where: { tenantId },
        orderBy: { purchaseDate: 'desc' },
        include: { contractor: true }
    })

    const totalValue = assets.reduce((sum: number, a: any) => sum + Number(a.purchaseNet), 0)
    const activeCount = assets.filter((a: any) => a.status === 'ACTIVE').length

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight italic">Majątek Trwały</h1>
                    <p className="text-slate-500 font-medium">Ewidencja i Zarządzanie Aktywami Firmy</p>
                </div>
                <div className="flex gap-3">
                    <Button className="bg-indigo-600 hover:bg-indigo-700 h-11 px-6 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 transition-all">
                        <Plus className="w-5 h-5 mr-2" /> Dodaj Ręcznie
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 shadow-inner">
                        <PackageSearch className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Wszystkie Aktywa</p>
                        <p className="text-2xl font-black text-slate-900">{assets.length}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600 shadow-inner">
                        <TrendingDown className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Wartość Zakupu (Netto)</p>
                        <p className="text-2xl font-black text-slate-900">
                            {new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(totalValue)}
                        </p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-4 bg-orange-50 rounded-2xl text-orange-600 shadow-inner">
                        <ClipboardCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Aktywne Operacyjnie</p>
                        <p className="text-2xl font-black text-slate-900">{activeCount}</p>
                    </div>
                </div>
            </div>

            <AssetsTable assets={assets} />
        </div>
    )
}
