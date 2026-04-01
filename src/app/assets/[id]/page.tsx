import { notFound } from "next/navigation"
import Link from "next/link"
import prisma from "@/lib/prisma"
const db = prisma as any;
import { 
    ArrowLeft, 
    Calendar, 
    Car, 
    Monitor, 
    Package, 
    Wrench,
    ShieldCheck,
    AlertTriangle,
    Database,
    MapPin,
    User,
    Activity,
    ClipboardList,
    TrendingUp
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { formatPln } from "@/lib/utils"

export default async function AssetDetailsPage({ params }: { params: { id: string } }) {
    const asset = await db.asset.findUnique({
        where: { id: params.id },
        include: {
            project: true,
            contractor: true,
            invoice: true
        }
    })

    if (!asset) return notFound()

    const audit = await db.syncAuditRecord.findUnique({
        where: { entityType_entityId: { entityType: 'asset', entityId: params.id } }
    })

    const categoryIcons = {
        vehicle: <Car className="w-10 h-10 text-indigo-500" />,
        tool: <Wrench className="w-10 h-10 text-slate-500" />,
        it: <Monitor className="w-10 h-10 text-blue-500" />,
        equipment: <Package className="w-10 h-10 text-amber-500" />
    }

    const statusColors = {
        ACTIVE: "bg-emerald-100 text-emerald-700",
        INACTIVE: "bg-slate-100 text-slate-700",
        DAMAGED: "bg-rose-100 text-rose-700",
        SOLD: "bg-blue-100 text-blue-700"
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-4">
                    <Link href="/assets" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-xs font-black uppercase tracking-widest group">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Ewidencja Majątku
                    </Link>
                    <div className="flex items-start gap-4">
                        <div className="p-4 bg-white rounded-3xl shadow-sm border border-slate-100">
                            {categoryIcons[asset.category as keyof typeof categoryIcons]}
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-4xl font-black text-slate-900 tracking-tight">{asset.name}</h1>
                                <Badge className={`${statusColors[asset.status as keyof typeof statusColors]} border-none px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm`}>
                                    {asset.status}
                                </Badge>
                            </div>
                            <p className="text-xl text-slate-400 font-medium">{asset.brand} {asset.model} • <span className="font-mono text-lg">{asset.serialNumber || asset.registrationNumber || "Brak S/N"}</span></p>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                     <Button variant="outline" className="h-12 px-6 rounded-2xl font-bold text-slate-600 border-slate-200">
                         Edytuj Dane
                     </Button>
                     <Button className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 transition-all">
                         Drukuj Etykietę QR
                     </Button>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Left Column: Financial & Basics */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="grid md:grid-cols-2 gap-6">
                         <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
                            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-3">
                                <CardTitle className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-2">
                                    <TrendingUp className="w-3 h-3" /> Wartość & Finanse
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-4">
                                <div className="flex justify-between items-end border-b border-slate-50 pb-4">
                                    <span className="text-slate-400 text-sm font-medium">Wartość Początkowa</span>
                                    <span className="text-2xl font-black text-slate-900">{formatPln(asset.initialValue)}</span>
                                </div>
                                <div className="flex justify-between items-end">
                                    <span className="text-slate-400 text-sm font-medium">Bieżąca Wycena</span>
                                    <span className="text-2xl font-black text-indigo-600">{formatPln(asset.currentValue)}</span>
                                </div>
                                <div className="pt-2">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">Szczegóły Zakupu</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-3 bg-slate-50 rounded-2xl">
                                            <p className="text-[9px] text-slate-400 font-bold uppercase">Netto</p>
                                            <p className="font-bold text-slate-700">{formatPln(asset.purchaseNet)}</p>
                                        </div>
                                        <div className="p-3 bg-slate-50 rounded-2xl">
                                            <p className="text-[9px] text-slate-400 font-bold uppercase">VAT</p>
                                            <p className="font-bold text-slate-700">{formatPln(asset.vatAmount)}</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                         </Card>

                         <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
                            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-3">
                                <CardTitle className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-2">
                                    <Activity className="w-3 h-3" /> Metadane Systemowe
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                                        <Database className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Źródło Danych</p>
                                        <p className="font-bold text-slate-900 uppercase tracking-tighter">{asset.sourceType}</p>
                                    </div>
                                </div>
                                
                                {asset.sourceInvoiceId && (
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                                            <ClipboardList className="w-5 h-5" />
                                        </div>
                                        <Link href={`/finance/invoices/${asset.sourceInvoiceId}`} className="group">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Dokument Zakupu</p>
                                            <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">FA/{asset.invoice?.invoiceNumber || "ID:"+asset.sourceInvoiceId}</p>
                                        </Link>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4 pt-2">
                                     <div className="space-y-1">
                                         <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Data Nabycia</p>
                                         <div className="flex items-center gap-2 font-bold text-slate-700">
                                             <Calendar className="w-3.5 h-3.5 text-slate-300" />
                                             {asset.purchaseDate.toLocaleDateString('pl-PL')}
                                         </div>
                                     </div>
                                      <div className="space-y-1">
                                         <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Gwarancja do</p>
                                         <div className="flex items-center gap-2 font-bold text-slate-700">
                                             <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                             {asset.warrantyEndDate?.toLocaleDateString('pl-PL') || "Brak"}
                                         </div>
                                     </div>
                                </div>
                            </CardContent>
                         </Card>
                    </div>

                    {/* Operational Details (e.g. Car Specs) */}
                    <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                            <CardTitle className="text-sm font-black flex items-center gap-2">
                                <ClipboardList className="w-4 h-4 text-slate-400" /> Specyfikacja Techniczna & Eksploatacja
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8">
                             <div className="grid md:grid-cols-3 gap-8">
                                 <div className="space-y-4">
                                     <div className="space-y-1">
                                         <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Lokalizacja</p>
                                         <p className="flex items-center gap-2 font-bold text-slate-900">
                                             <MapPin className="w-4 h-4 text-rose-400" /> {asset.location || "Nieprzypisana"}
                                         </p>
                                     </div>
                                     <div className="space-y-1">
                                         <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Użytkownik</p>
                                         <p className="flex items-center gap-2 font-bold text-slate-900">
                                             <User className="w-4 h-4 text-blue-400" /> {asset.assignedTo || "Ogólny / Firma"}
                                         </p>
                                     </div>
                                 </div>

                                 <div className="space-y-4">
                                      <div className="space-y-1">
                                         <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Ubezpieczenie do</p>
                                         <p className="font-bold text-slate-900">
                                             {asset.insuranceEndDate?.toLocaleDateString('pl-PL') || "N/A"}
                                         </p>
                                     </div>
                                     <div className="space-y-1">
                                         <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Przegląd Tech.</p>
                                         <p className="font-bold text-slate-900">
                                             {asset.inspectionDate?.toLocaleDateString('pl-PL') || "N/A"}
                                         </p>
                                     </div>
                                 </div>

                                 <div className="space-y-4">
                                      <div className="space-y-1">
                                         <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Przebieg / RH</p>
                                         <p className="font-mono text-lg font-black text-slate-900 italic">
                                             {asset.mileage ? `${asset.mileage.toLocaleString()} KM` : "---"}
                                         </p>
                                     </div>
                                      <div className="space-y-1">
                                         <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Nr VIN / Seria</p>
                                         <p className="font-mono text-sm font-bold text-slate-500 uppercase tracking-widest">
                                             {asset.vin || asset.serialNumber || "---"}
                                         </p>
                                     </div>
                                 </div>
                             </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                            <CardTitle className="text-sm font-black text-slate-400 uppercase tracking-widest">Notatki & Dokumentacja</CardTitle>
                        </CardHeader>
                        <CardContent className="p-8">
                            <p className="text-slate-500 font-medium italic">
                                {asset.notes || "Brak dodatkowych notatek dla tego obiektu."}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Sync Health (Vector 108) */}
                <div className="space-y-8">
                     <Card className={`rounded-3xl shadow-sm border-2 overflow-hidden ${audit?.syncStatus === 'IN_SYNC' ? 'border-emerald-100' : 'border-rose-100'}`}>
                        <CardHeader className={`${audit?.syncStatus === 'IN_SYNC' ? 'bg-emerald-50/50' : 'bg-rose-50/50'} border-b flex flex-row items-center justify-between`}>
                            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                {audit?.syncStatus === 'IN_SYNC' ? <ShieldCheck className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-rose-500" />}
                                Sync Health
                            </CardTitle>
                            <Badge className="bg-white/80 backdrop-blur-sm text-[8px] border-none shadow-none font-black text-slate-400 tracking-tighter">V108</Badge>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Status Spójności</p>
                                <p className={`text-xl font-black ${audit?.syncStatus === 'IN_SYNC' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {audit?.syncStatus || "UNAUDITED"}
                                </p>
                            </div>

                            <div className="space-y-1">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Ostatni Audyt</p>
                                <p className="text-sm font-bold text-slate-700">
                                    {audit?.lastCheckedAt ? new Date(audit.lastCheckedAt).toLocaleString('pl-PL') : "Nigdy"}
                                </p>
                            </div>

                            {audit?.syncStatus !== 'IN_SYNC' && (
                                <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
                                     <p className="text-[10px] text-rose-800 font-black uppercase mb-2">Wykryto rozbieżności:</p>
                                     <ul className="text-xs space-y-1 text-rose-600 font-medium list-disc pl-4">
                                         {(audit?.diffFields as any[])?.map((diff, i) => (
                                             <li key={i}>{diff.field}</li>
                                         ))}
                                         {(!audit?.diffFields || (audit?.diffFields as any[]).length === 0) && asset && <li>Brak rekordu w Firestore</li>}
                                     </ul>
                                </div>
                            )}

                            <div className="pt-4 space-y-3">
                                 <Button variant="outline" className="w-full h-11 rounded-xl font-black text-[10px] uppercase tracking-widest border-slate-200">
                                     Wymuś Audyt
                                 </Button>
                                 <Button className="w-full h-11 rounded-xl bg-slate-900 hover:bg-black text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-100 transition-all">
                                     Resynchronizacja
                                 </Button>
                            </div>
                        </CardContent>
                     </Card>

                     <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                         <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Historia Zmian</h3>
                         <div className="space-y-4">
                             <div className="flex gap-3">
                                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1" />
                                 <div>
                                     <p className="text-xs font-bold text-slate-700">Utworzono obiekt</p>
                                     <p className="text-[10px] text-slate-400">{asset.createdAt.toLocaleString('pl-PL')}</p>
                                 </div>
                             </div>
                             {audit?.lastSyncedAt && (
                                 <div className="flex gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1" />
                                    <div>
                                        <p className="text-xs font-bold text-slate-700">Ostatnia synchronizacja</p>
                                        <p className="text-[10px] text-slate-400">{new Date(audit.lastSyncedAt).toLocaleString('pl-PL')}</p>
                                    </div>
                                </div>
                             )}
                         </div>
                     </div>
                </div>
            </div>
        </div>
    )
}
