"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ShieldAlert, DownloadCloud, Loader2, CheckCircle2 } from "lucide-react"
import { approvePendingContractor } from "@/app/actions/ksef"
import { createAssetFromKsef } from "@/app/actions/assets"
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay"
import { PackagePlus } from "lucide-react"
import { useRouter } from "next/navigation"

export function KSeFInboxClient({ initialInvoices, pendingContractors }: { initialInvoices: any[], pendingContractors: any[] }) {
    const [isSyncing, setIsSyncing] = useState(false)
    const [syncMessage, setSyncMessage] = useState("")
    const [actionId, setActionId] = useState<string | null>(null)
    const [isAssetCreating, setIsAssetCreating] = useState<string | null>(null)
    const router = useRouter()
    
    // Zmienne stanu dla Date Range z domyślnym okresem 7 dni
    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        return d.toISOString().split('T')[0]
    })
    
    const [dateTo, setDateTo] = useState(() => {
        return new Date().toISOString().split('T')[0]
    })

    const [isFetchingXml, setIsFetchingXml] = useState(false)

    const handleSync = async () => {
        setIsSyncing(true)
        setSyncMessage("")
        try {
            const fromDateObj = new Date(dateFrom)
            const toDateObj = new Date(dateTo)
            toDateObj.setHours(23, 59, 59, 999)

            const dateFromStr = fromDateObj.toISOString()
            const dateToStr = toDateObj.toISOString()

            // 1. Szybki Sync - pobranie z KSeF i zapis jako XML_MISSING
            const queryRes = await fetch(`/api/ksef/invoices?dateFrom=${encodeURIComponent(dateFromStr)}&dateTo=${encodeURIComponent(dateToStr)}`)
            const queryData = await queryRes.json()

            if (!queryData.success) {
                setSyncMessage(queryData.error || queryData.pagination?.message || "Błąd pobierania listy z KSeF.")
                setIsSyncing(false)
                return
            }

            setSyncMessage(`Zapisano nagłówki: ${queryData.savedCount || 0} szt.`)
            window.location.reload()
        } catch (error: any) {
            console.error("KSeF Sync Error", error)
            setSyncMessage("Krytyczny błąd połączenia z serwerem.")
        } finally {
            setIsSyncing(false)
        }
    }

    const handleFetchXml = async () => {
        setIsFetchingXml(true)
        setSyncMessage("")
        try {
            // 2. Deep Fetch - pobierz dla faktur XML_MISSING
            const processRes = await fetch('/api/ksef/process', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}) // Backend sam szuka XML_MISSING
            })

            const processData = await processRes.json()
            if (processData.success) {
                setSyncMessage(processData.message || "Pomyślnie doczytano szczegóły XML.")
                window.location.reload()
            } else {
                setSyncMessage(processData.error || "Błąd parsowania XML.")
            }
        } catch (error: any) {
            console.error("KSeF XML Fetch Error", error)
            setSyncMessage("Krytyczny błąd połączenia z serwerem.")
        } finally {
            setIsFetchingXml(false)
        }
    }

    const handleApproveContractor = async (id: string) => {
        setActionId(id)
        const result = await approvePendingContractor(id)
        if (!result.success) {
            alert(result.error)
            setActionId(null)
        }
    }

    const handleCreateAsset = async (inv: any) => {
        setIsAssetCreating(inv.id)
        try {
            const res = await createAssetFromKsef(inv.id, {
                name: `ŚT: ${inv.counterpartyName} - ${inv.invoiceNumber}`,
                category: 'equipment', // Default for 'one-click'
                purchaseDate: inv.issueDate,
                purchaseNet: Number(inv.amountGross) / 1.23, // Simple approximation if detailed VAT not here
                purchaseGross: Number(inv.amountGross),
                vatAmount: Number(inv.amountGross) - (Number(inv.amountGross) / 1.23),
                invoiceId: inv.id,
                status: 'ACTIVE'
            } as any)

            if (res.success) {
                router.push('/assets')
            } else {
                alert(res.error)
            }
        } catch (error: any) {
            alert("Błąd: " + error.message)
        } finally {
            setIsAssetCreating(null)
        }
    }

    return (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4 p-6 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="flex-1 w-full md:w-auto mt-4 md:mt-0">
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">Synchronizacja Dwufazowa</h2>
                    <p className="text-sm font-medium text-slate-500 mt-1">Szybko pobierz listę, a następnie dociągnij treść XML dla nowych faktur.</p>
                </div>
                <div className="flex flex-col md:flex-row items-end gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Data Od</label>
                            <input 
                                type="date" 
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="h-12 px-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Data Do</label>
                            <input 
                                type="date" 
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="h-12 px-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col md:flex-row items-end gap-2 w-full md:w-auto">
                        <Button 
                            onClick={handleSync} 
                            disabled={isSyncing || isFetchingXml}
                            variant="outline"
                            className="bg-white hover:bg-slate-50 border-slate-200 text-slate-700 h-12 px-6 font-bold shadow-sm rounded-xl"
                        >
                            {isSyncing ? (
                                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> ...</>
                            ) : (
                                <><DownloadCloud className="w-5 h-5 mr-2" /> 1. Szybki Sync</>
                            )}
                        </Button>
                        <Button 
                            onClick={handleFetchXml} 
                            disabled={isSyncing || isFetchingXml}
                            className="bg-indigo-600 hover:bg-indigo-700 h-12 px-6 text-white font-black shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all rounded-xl"
                        >
                            {isFetchingXml ? (
                                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Detale ...</>
                            ) : (
                                "2. Pobierz XML i Rozlicz"
                            )}
                        </Button>
                    </div>
                    {syncMessage && (
                        <p className={`text-xs font-bold w-full text-right ${syncMessage.includes("Błąd") ? "text-red-500" : "text-green-600"}`}>
                            {syncMessage}
                        </p>
                    )}
                </div>
            </div>

            <Tabs defaultValue={pendingContractors.length > 0 ? "contractors" : "invoices"} className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2 p-1 bg-slate-100 rounded-xl h-12">
                    <TabsTrigger value="invoices" className="rounded-lg h-10 font-bold uppercase tracking-widest text-[10px] data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        Odebrane Faktury
                    </TabsTrigger>
                    <TabsTrigger value="contractors" className="rounded-lg h-10 font-bold uppercase tracking-widest text-[10px] data-[state=active]:bg-white data-[state=active]:shadow-sm relative">
                        Oczekujący Dostawcy
                        {pendingContractors.length > 0 && (
                            <span className="absolute -top-1 -right-1 bg-rose-500 text-white w-4 h-4 text-[9px] rounded-full flex items-center justify-center">
                                {pendingContractors.length}
                            </span>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="invoices" className="mt-8">
                    <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/50">
                                    <th className="p-4 text-[10px] uppercase font-black tracking-widest text-slate-400">Numer KSeF</th>
                                    <th className="p-4 text-[10px] uppercase font-black tracking-widest text-slate-400">Sprzedawca</th>
                                    <th className="p-4 text-[10px] uppercase font-black tracking-widest text-slate-400">Wystawiono</th>
                                    <th className="p-4 text-[10px] uppercase font-black tracking-widest text-slate-400 text-right">Brutto</th>
                                    <th className="p-4 text-[10px] uppercase font-black tracking-widest text-slate-400 text-right">Status KSeF</th>
                                    <th className="p-4 text-slate-400"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {initialInvoices.length === 0 && (
                                    <tr><td colSpan={5} className="p-8 text-center text-sm font-medium text-slate-400 bg-slate-50">Brak wciągniętych faktur do systemu Prisma. Zsynchronizuj bazę KSeF.</td></tr>
                                )}
                                {initialInvoices.map(inv => (
                                    <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                        <td className="p-4 font-mono text-xs text-slate-500 font-bold max-w-[150px] truncate" title={inv.ksefId}>
                                            {inv.ksefId}
                                        </td>
                                        <td className="p-4">
                                            <p className="font-bold text-sm text-slate-900 leading-tight">{inv.contractorName}</p>
                                            <p className="font-mono text-[10px] text-slate-400">{inv.nip}</p>
                                        </td>
                                        <td className="p-4">
                                            <p className="text-sm font-medium text-slate-700">{new Date(inv.issueDate).toLocaleDateString('pl-PL')}</p>
                                            <div className="flex gap-1 mt-1 flex-wrap">
                                                <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wide bg-indigo-50 px-1.5 py-0.5 rounded">{inv.ksefType}</span>
                                                {inv.type && (
                                                    <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                                                        inv.type === 'REVENUE' || inv.type === 'INCOME' 
                                                            ? 'bg-emerald-100 text-emerald-700' 
                                                            : 'bg-rose-100 text-rose-700'
                                                    }`}>
                                                        {inv.type === 'REVENUE' || inv.type === 'INCOME' ? 'Sprzedaż' : 'Zakup'}
                                                    </span>
                                                )}
                                                {inv.status === 'XML_MISSING' && (
                                                    <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 flex items-center gap-1" title="Brak detali XML. Kliknij Pobierz XML, aby dociągnąć konto bankowe.">
                                                        <ShieldAlert className="w-3 h-3" /> Brak XML
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <CurrencyDisplay 
                                                gross={inv.amountGross} 
                                                net={Number(inv.amountGross) / 1.23} 
                                                isIncome={inv.type === 'REVENUE' || inv.type === 'INCOME'} 
                                                className="font-black text-slate-800" 
                                            />
                                        </td>
                                        <td className="p-4 text-right">
                                            {(() => {
                                                const issueDate = new Date(inv.issueDate).toISOString().split('T')[0];
                                                const dueDate = new Date(inv.dueDate).toISOString().split('T')[0];
                                                const isSameDay = issueDate === dueDate;
                                                const isPaid = inv.paymentStatus === 'PAID';
                                                
                                                let badgeClass = "bg-orange-100 text-orange-700";
                                                let label = "Zaległa";

                                                if (isPaid) {
                                                    badgeClass = "bg-emerald-100 text-emerald-700";
                                                    label = "Opłacono";
                                                } else if (isSameDay) {
                                                    badgeClass = "bg-blue-100 text-blue-700 font-bold border border-blue-200";
                                                    label = "Płatność POS";
                                                }

                                                return (
                                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${badgeClass}`}>
                                                        {label}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="p-4 text-right">
                                            <Button 
                                                variant="outline" 
                                                size="sm"
                                                onClick={() => handleCreateAsset(inv)}
                                                disabled={isAssetCreating === inv.id}
                                                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] uppercase tracking-widest border-indigo-100 rounded-lg h-8"
                                            >
                                                {isAssetCreating === inv.id ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <><PackagePlus className="w-3 h-3 mr-1" /> Środek Trwały</>
                                                )}
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </TabsContent>

                <TabsContent value="contractors" className="mt-8">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {pendingContractors.length === 0 && (
                            <div className="col-span-full p-8 text-center text-sm font-medium text-slate-500 bg-emerald-50 border-emerald-100 border rounded-2xl">
                                System OCR / KSeF zmapował wszystkie nowe faktury do znanych Ci wykonawców.
                            </div>
                        )}
                        {pendingContractors.map(c => (
                            <div key={c.id} className="border-2 border-orange-200 bg-orange-50/30 rounded-2xl p-6 relative">
                                <div className="absolute top-4 right-4 text-orange-300">
                                    <ShieldAlert />
                                </div>
                                <h3 className="font-bold text-slate-900 pr-8">{c.name}</h3>
                                <p className="font-mono text-xs text-slate-500 mt-1">{c.nip}</p>
                                <p className="text-xs text-slate-600 mt-2 line-clamp-2">{c.address || "Brak adresu w dokumencie KSeF"}</p>
                                
                                {c.bankAccounts && c.bankAccounts.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-orange-200/50">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Znalezione konta KSeF (IBAN)</p>
                                        <div className="space-y-1">
                                            {c.bankAccounts.map((acc: string, idx: number) => (
                                                <p key={idx} className="font-mono bg-white px-2 py-1 rounded text-xs text-indigo-700 shadow-sm border border-indigo-100">PL {acc}</p>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <Button 
                                    onClick={() => handleApproveContractor(c.id)}
                                    disabled={actionId === c.id}
                                    className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold tracking-wide uppercase text-xs"
                                >
                                    {actionId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Zweryfikuj i Akceptuj</>}
                                </Button>
                            </div>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
