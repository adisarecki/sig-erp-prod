"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ShieldAlert, DownloadCloud, Loader2, CheckCircle2 } from "lucide-react"
import { approvePendingContractor } from "@/app/actions/ksef"
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay"

export function KSeFInboxClient({ initialInvoices, pendingContractors }: { initialInvoices: any[], pendingContractors: any[] }) {
    const [isSyncing, setIsSyncing] = useState(false)
    const [syncMessage, setSyncMessage] = useState("")
    const [actionId, setActionId] = useState<string | null>(null)

    const handleSync = async () => {
        setIsSyncing(true)
        setSyncMessage("")
        try {
            // First we need to fetch KSeF IDs for a given date range. Look from KSeF API `/api/ksef/invoices`
            // But the instruction said: `odpala Twój nowy proces POST /api/ksef/process` 
            // `ksef/process` expects `{ ksefIds: [] }`. Since the API handles upsert, we might need a UI input
            // that specifies dates, then calls KSeF to get IDs, then calls /api/ksef/process to injest them.
            // For MVP simplicity and because the exact flow of `/api/ksef/invoices` may require inputs, 
            // let's assume we do a full query for the last 3 days here, call API, then push IDs to process.

            // Request logic:
            const toDate = new Date()
            const fromDate = new Date()
            fromDate.setDate(toDate.getDate() - 7) // Ostatnie 7 dni domyślnie

            const dateFromStr = fromDate.toISOString()
            const dateToStr = toDate.toISOString()

            // 1. Get IDs
            const queryRes = await fetch(`/api/ksef/invoices?dateFrom=${encodeURIComponent(dateFromStr)}&dateTo=${encodeURIComponent(dateToStr)}`)
            const queryData = await queryRes.json()

            if (!queryData.success || !queryData.invoices) {
                setSyncMessage(queryData.error || "Błąd pobierania listy z KSeF.")
                setIsSyncing(false)
                return
            }

            const ksefIds = queryData.invoices.map((inv: any) => inv.ksefNumber)

            if (ksefIds.length === 0) {
                setSyncMessage("Brak nowych faktur w KSeF z ostatnich 7 dni.")
                setIsSyncing(false)
                return
            }

            // 2. Process IDs into Prisma & Firestore
            const processRes = await fetch('/api/ksef/process', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ksefIds })
            })

            const processData = await processRes.json()
            if (processData.success) {
                setSyncMessage(processData.message || "Pomyślnie zsynchronizowano faktury KSeF.")
                window.location.reload()
            } else {
                setSyncMessage(processData.error || "Błąd parsowania i zapisywania pobranych faktur.")
            }
        } catch (error: any) {
            console.error("KSeF Sync Error", error)
            setSyncMessage("Krytyczny błąd połączenia z serwerem.")
        } finally {
            setIsSyncing(false)
        }
    }

    const handleApproveContractor = async (id: string) => {
        setActionId(id)
        const result = await approvePendingContractor(id)
        if (!result.success) {
            alert(result.error)
            setActionId(null)
        }
        // Sukces przerenderuje stronę automatycznie ze względu na revalidatePath
    }

    return (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4 p-6 bg-slate-50 border border-slate-100 rounded-2xl">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">Oś Szybkiej Synchronizacji</h2>
                    <p className="text-sm font-medium text-slate-500 mt-1">Sprawdź ostatnie 7 dni w państwowym systemie e-Faktur i zabezpiecz system centralny.</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <Button 
                        onClick={handleSync} 
                        disabled={isSyncing}
                        className="bg-indigo-600 hover:bg-indigo-700 h-12 px-8 text-white font-black shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all rounded-xl"
                    >
                        {isSyncing ? (
                            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Pobieranie ZK KSeF...</>
                        ) : (
                            <><DownloadCloud className="w-5 h-5 mr-2" /> Synchronizuj 7 Dni (Odbierz Invoices)</>
                        )}
                    </Button>
                    {syncMessage && (
                        <p className={`text-xs font-bold ${syncMessage.includes("Błąd") ? "text-red-500" : "text-green-600"}`}>
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
                                            <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wide bg-indigo-50 px-1.5 py-0.5 rounded">{inv.ksefType}</span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <CurrencyDisplay gross={inv.amountGross} net={Number(inv.amountGross) / 1.23} isIncome={false} className="font-black text-slate-800" />
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                                                inv.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                                            }`}>
                                                {inv.paymentStatus === 'PAID' ? 'Opłacono' : 'Zaległość'}
                                            </span>
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
