import { getFleetSummary } from "@/app/actions/fleet"
import { getAssetSummary } from "@/app/actions/assets"
import { Truck, Wrench, Fuel, DollarSign, User, Calendar, MapPin, Tag, Activity, AlertTriangle } from "lucide-react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"

export default async function FleetAndToolsPage() {
    const fleetResult = await getFleetSummary()
    const toolsResult = await getAssetSummary()

    const fleet = fleetResult.success ? fleetResult.summary : []
    const tools = toolsResult.success ? toolsResult.summary : []

    return (
        <div className="p-8 space-y-12 bg-[#0a0a0b] min-h-screen text-slate-200">
            {/* Header Section */}
            <header className="flex flex-col space-y-2">
                <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-600 bg-clip-text text-transparent">
                    Zasoby Operacyjne
                </h1>
                <p className="text-slate-400 max-w-2xl text-lg">
                    Stage 1: Rejestr Floty i Narzędzi. Monitoring kosztów jednostkowych bez wpływu na marżę projektową (Vector 170).
                </p>
            </header>

            {/* Fleet Section */}
            <section className="space-y-6">
                <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
                    <Truck className="w-8 h-8 text-blue-400" />
                    <h2 className="text-2xl font-bold">Flota i Pojazdy</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {fleet.map((v) => (
                        <div key={v.id} className="group relative bg-[#161618] border border-slate-800 rounded-2xl p-6 transition-all hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                                        {v.make} {v.model}
                                    </h3>
                                    <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-1 rounded mt-1 inline-block uppercase">
                                        {v.plates}
                                    </span>
                                </div>
                                <div className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    v.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                                    v.status === 'SERVICE' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 
                                    'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                }`}>
                                    {v.status === 'ACTIVE' ? 'Aktywny' : v.status === 'SERVICE' ? 'Serwis' : 'Niektywny'}
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-slate-800/50">
                                    <div className="flex items-center space-x-2">
                                        <Fuel className="w-4 h-4 text-amber-400" />
                                        <span className="text-sm text-slate-400 italic">Ostatnie tankowanie</span>
                                    </div>
                                    <span className="text-sm font-medium">
                                        {v.latestFuelDate ? format(new Date(v.latestFuelDate), 'dd.MM.yyyy', { locale: pl }) : 'Brak danych'}
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between p-2 bg-blue-500/5 rounded-lg border border-blue-500/10">
                                        <div className="flex items-center space-x-2">
                                            <Tag className="w-3.5 h-3.5 text-blue-400" />
                                            <span className="text-xs text-slate-400">Koszt operacyjny (30 dni)</span>
                                        </div>
                                        <span className="text-sm font-bold text-blue-400">
                                            {v.operationalCost30d?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' }) || '0,00 zł'}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between p-2 bg-emerald-500/5 rounded-lg border border-emerald-500/10 relative overflow-hidden">
                                        <div className="flex items-center space-x-2">
                                            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                                            <span className="text-xs text-slate-400">Wypływ gotówki (30 dni)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {v.operationalCost30d > 0 && v.cashOutflow30d === 0 && (
                                                <div title="Wykryto faktury bez przypisanych płatności (Cash Flow Miss)" className="cursor-help transition-transform hover:scale-110">
                                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                                                </div>
                                            )}
                                            <span className="text-sm font-bold text-emerald-400">
                                                {v.cashOutflow30d?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' }) || '0,00 zł'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {fleet.length === 0 && (
                        <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-800 rounded-3xl">
                            <p className="text-slate-500">Brak zarejestrowanych pojazdów.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* Assets Section */}
            <section className="space-y-6">
                <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
                    <Wrench className="w-8 h-8 text-indigo-400" />
                    <h2 className="text-2xl font-bold">Zasoby i Narzędzia</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {tools.map((a) => (
                        <div key={a.id} className="bg-[#161618] border border-slate-800 rounded-xl p-5 hover:bg-[#1c1c1f] transition-colors">
                            <div className="flex flex-col h-full space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className={`p-2 rounded-lg ${
                                        a.category === 'ELEKTRONARZEDZIA' ? 'bg-indigo-500/10 text-indigo-400' :
                                        a.category === 'BIURO' ? 'bg-sky-500/10 text-sky-400' :
                                        'bg-slate-500/10 text-slate-400'
                                    }`}>
                                        <Activity className="w-5 h-5" />
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-mono tracking-tighter">#{a.id.split('-')[0].toUpperCase()}</span>
                                </div>

                                <div>
                                    <h4 className="font-semibold text-white truncate">{a.name}</h4>
                                    <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">{a.category}</p>
                                </div>

                                <div className="mt-auto space-y-4">
                                    <div className="pt-4 border-t border-slate-800/50 space-y-2">
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-slate-500 uppercase">Koszt (30d):</span>
                                            <span className="text-blue-400 font-bold">{a.operationalCost30d?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</span>
                                        </div>
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-slate-500 uppercase">Wypływ (30d):</span>
                                            <span className="text-emerald-400 font-bold">{a.cashOutflow30d?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-1 text-[10px]">
                                        <div className="flex items-center text-slate-400 space-x-2">
                                            <User className="w-3 h-3" />
                                            <span>{a.assignedUserId || 'Dostępny'}</span>
                                        </div>
                                        <div className="flex items-center text-slate-400 space-x-2">
                                            <Calendar className="w-3 h-3" />
                                            <span>Ostatni koszt: {a.lastCostDate ? format(new Date(a.lastCostDate), 'dd.MM.yy') : 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {tools.length === 0 && (
                        <div className="col-span-full py-8 text-center text-slate-500">
                            Brak zarejestrowanych narzędzi.
                        </div>
                    )}
                </div>
            </section>
        </div>
    )
}
