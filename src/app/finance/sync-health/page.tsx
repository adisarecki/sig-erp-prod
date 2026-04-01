import prisma from "@/lib/prisma"
const db = prisma as any;
import { 
    ShieldCheck, 
    AlertTriangle, 
    RefreshCcw, 
    Database, 
    Search,
    ChevronRight,
    Activity,
    Layers,
    FileDiff
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table"
import Link from "next/link"

export default async function SyncHealthPage() {
    const auditRecords = await db.syncAuditRecord.findMany({
        orderBy: { lastCheckedAt: 'desc' }
    })

    const stats = {
        total: auditRecords.length,
        inSync: auditRecords.filter((r: any) => r.syncStatus === 'IN_SYNC').length,
        issues: auditRecords.filter((r: any) => r.syncStatus !== 'IN_SYNC').length,
        pending: auditRecords.filter((r: any) => r.syncStatus === 'PENDING_RESYNC').length
    }

    const statusColors = {
        IN_SYNC: "bg-emerald-100 text-emerald-700",
        MISSING_IN_FIRESTORE: "bg-rose-100 text-rose-700",
        MISSING_IN_POSTGRES: "bg-rose-100 text-rose-700",
        FIELD_MISMATCH: "bg-amber-100 text-amber-700 font-black",
        SYNC_ERROR: "bg-rose-100 text-rose-700",
        PENDING_RESYNC: "bg-blue-100 text-blue-700"
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Sync Health Monitor</h1>
                    <p className="text-slate-500 font-medium">System Spójności Dual-DB • Vector 108 Engine</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" className="h-12 px-6 rounded-2xl font-bold text-slate-600 border-slate-200 bg-white">
                        <RefreshCcw className="w-4 h-4 mr-2" /> Pełny Skan Systemu
                    </Button>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid md:grid-cols-4 gap-6">
                <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
                    <CardContent className="p-6">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Wszystkie Encje</p>
                        <p className="text-3xl font-black text-slate-900">{stats.total}</p>
                    </CardContent>
                </Card>
                <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden border-l-4 border-l-emerald-400">
                    <CardContent className="p-6">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">W Pełnej Zgodności</p>
                        <p className="text-3xl font-black text-emerald-600">{stats.inSync}</p>
                    </CardContent>
                </Card>
                <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden border-l-4 border-l-rose-400">
                    <CardContent className="p-6">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Wykryte Rozbieżności</p>
                        <p className="text-3xl font-black text-rose-600">{stats.issues}</p>
                    </CardContent>
                </Card>
                <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden border-l-4 border-l-blue-400">
                    <CardContent className="p-6">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Oczekujące na Resync</p>
                        <p className="text-3xl font-black text-blue-600">{stats.pending}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content: Registry */}
            <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg font-black text-slate-800">Rejestr Spójności</CardTitle>
                        <CardDescription>Lista audytów dla obiektów w systemie SIG ERP.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input className="h-9 w-64 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="Szukaj po ID / Typie..." />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="text-[10px] uppercase font-black tracking-widest text-slate-400 p-6">Typ & ID Encji</TableHead>
                                <TableHead className="text-[10px] uppercase font-black tracking-widest text-slate-400 p-6">Status Synchronizacji</TableHead>
                                <TableHead className="text-[10px] uppercase font-black tracking-widest text-slate-400 p-6">Ostatni Audyt</TableHead>
                                <TableHead className="text-[10px] uppercase font-black tracking-widest text-slate-400 p-6">Pola Niezgodne</TableHead>
                                <TableHead className="text-[10px] uppercase font-black tracking-widest text-slate-400 p-6 text-right">Akcje</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {auditRecords.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="p-16 text-center">
                                        <Activity className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                                        <p className="text-slate-400 font-medium">Brak rekordów audytu. Uruchom skan systemu.</p>
                                    </TableCell>
                                </TableRow>
                            )}
                            {auditRecords.map((record: any) => (
                                <TableRow key={record.id} className="group hover:bg-slate-50/50 transition-colors">
                                    <TableCell className="p-6">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-slate-100 rounded-xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                                {record.entityType === 'asset' ? <Layers className="w-5 h-5" /> : <Database className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-0.5">{record.entityType}</p>
                                                <p className="font-mono text-xs font-bold text-slate-900 italic tracking-tighter">{record.entityId}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="p-6">
                                        <Badge className={`${statusColors[record.syncStatus as keyof typeof statusColors]} border-none shadow-none px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest`}>
                                            {record.syncStatus}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="p-6">
                                        <p className="text-sm font-bold text-slate-600">{new Date(record.lastCheckedAt).toLocaleString('pl-PL')}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight italic">
                                            {record.lastSyncDirection || "Brak Synchronizacji Manualnej"}
                                        </p>
                                    </TableCell>
                                    <TableCell className="p-6">
                                        <div className="flex flex-wrap gap-1">
                                            {((record.diffFields as any[])?.length > 0) ? (
                                                (record.diffFields as any[]).map((diff, i) => (
                                                    <Badge key={i} variant="outline" className="text-[8px] h-4 px-1.5 border-rose-100 text-rose-500 bg-rose-50/30 uppercase font-black">{diff.field}</Badge>
                                                ))
                                            ) : (
                                                <span className="text-xs text-slate-300">---</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="p-6 text-right">
                                        <div className="flex justify-end gap-2">
                                             {record.syncStatus !== 'IN_SYNC' && (
                                                <Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl text-indigo-600 hover:bg-indigo-50">
                                                    <FileDiff className="w-5 h-5" />
                                                </Button>
                                             )}
                                             <Link href={`/${record.entityType}s/${record.entityId}`} className="group">
                                                <Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-white group-hover:shadow-sm">
                                                    <ChevronRight className="w-5 h-5" />
                                                </Button>
                                             </Link>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <div className="p-8 bg-indigo-900 rounded-3xl text-white flex items-center justify-between shadow-2xl shadow-indigo-200">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-indigo-300" />
                        <h3 className="text-xl font-black tracking-tight">System Spójności SIG ERP jest aktywny</h3>
                    </div>
                    <p className="text-indigo-300 font-medium max-w-xl">Wektor 108 automatycznie skanuje i audytuje każdą zmianę w Module Majątku, zapewniając że Firestore i PostgreSQL są zawsze w pełnej harmonii.</p>
                </div>
                <div className="bg-indigo-800/50 p-4 rounded-2xl border border-indigo-700/50">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-1">Ostatnia Naprawa</p>
                    <p className="text-sm font-black text-white italic">Dzisiaj, 14:23 (FS {`->`} PG)</p>
                </div>
            </div>
        </div>
    )
}
