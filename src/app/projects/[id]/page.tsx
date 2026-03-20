export const dynamic = "force-dynamic"
import { getProjectWithDetails, getProjects } from "@/app/actions/projects"
import { getContractors } from "@/app/actions/crm"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ProjectStageList } from "@/components/projects/ProjectStageList"
import { ProjectFinancialChart } from "@/components/projects/ProjectFinancialChart"
import { ProjectCockpitActions } from "@/components/projects/ProjectCockpitActions"
import { ArrowLeft, Building2, MapPin, Wallet, TrendingUp, ReceiptText, Calendar, BadgeDollarSign } from "lucide-react"
import Link from "next/link"

const formatPln = (value: number) => {
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value)
}

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function ProjectCockpit({ params }: PageProps) {
    const { id } = await params
    const project = await getProjectWithDetails(id)
    
    if (!project) notFound()

    const contractors = await getContractors()
    const allProjects = await getProjects()

    // Defensive data extraction
    const invoices = project.invoices || []
    const transactions = project.transactions || []
    const stages = project.stages || []
    const budgetEstimated = Number(project.budgetEstimated) || 0

    // Obliczenia finansowe (CASH FLOW - ONLY PAID INVOICES)
    const totalInvoiced = invoices
        .filter((inv: any) => inv.type === 'SPRZEDAŻ' && inv.status === 'PAID')
        .reduce((sum: number, inv: any) => sum + (Number(inv.amountNet) || 0), 0)

    const totalInvoicesCostNet = invoices
        .filter((inv: any) => (inv.type === 'KOSZT' || inv.type === 'ZAKUP') && inv.status === 'PAID')
        .reduce((sum: number, inv: any) => sum + (Number(inv.amountNet) || 0), 0)

    const nonInvoiceCosts = transactions
        .filter((t: any) => (t.type === 'KOSZT' || t.type === 'WYDATEK') && t.source !== 'INVOICE')
        .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)

    const totalCosts = totalInvoicesCostNet + nonInvoiceCosts
    
    const margin = totalInvoiced - totalCosts
    const percentUsed = budgetEstimated > 0 ? (totalCosts / budgetEstimated) * 100 : 0

    const totalStageBudgets = stages.reduce((sum: number, s: any) => sum + (Number(s.budgetEstimated) || 0), 0)
    const plannedMargin = budgetEstimated - totalStageBudgets

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            {/* Header / Nav */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <Link href="/projects" className="text-slate-500 hover:text-slate-800 flex items-center gap-1 text-sm font-medium transition-colors mb-2">
                        <ArrowLeft className="w-4 h-4" /> Powrót do listy projektów
                    </Link>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">{project.name}</h1>
                        <Badge className="bg-blue-600 text-white border-none uppercase font-black tracking-widest text-[10px] px-2 py-1">
                            {project.status}
                        </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 font-medium">
                        <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4 text-slate-400" /> {project.contractor.name}</span>
                        <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400" /> {project.object.name} ({project.object.address || "Brak adresu"})</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                   <ProjectCockpitActions 
                        projectId={project.id}
                        allProjects={allProjects}
                        contractors={contractors}
                    />
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="bg-slate-900 text-white border-none shadow-xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Wallet className="w-12 h-12" />
                    </div>
                    <CardHeader className="pb-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Budżet Szacowany</p>
                        <CardTitle className="text-2xl font-black">{formatPln(budgetEstimated)}</CardTitle>
                    </CardHeader>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm border-l-4 border-l-indigo-500">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-center text-slate-500">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Planowana Marża</span>
                            <BadgeDollarSign className="w-4 h-4 text-indigo-500" />
                        </div>
                        <CardTitle className="text-2xl font-black text-indigo-700">{formatPln(plannedMargin)}</CardTitle>
                    </CardHeader>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-center text-slate-500">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Przychody (Faktury)</span>
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                        </div>
                        <CardTitle className="text-2xl font-black text-slate-900">{formatPln(totalInvoiced)}</CardTitle>
                    </CardHeader>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm border-l-4 border-l-rose-500">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-center text-slate-500">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Koszty Realne</span>
                            <ReceiptText className="w-4 h-4 text-rose-500" />
                        </div>
                        <CardTitle className="text-2xl font-black text-rose-600">{formatPln(totalCosts)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full mt-1 overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-1000 ${percentUsed > 90 ? 'bg-rose-500' : 'bg-blue-600'}`}
                                style={{ width: `${Math.min(percentUsed, 100)}%` }}
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-tight">{percentUsed.toFixed(1)}% budżetu wykorzystane</p>
                    </CardContent>
                </Card>

                <Card className={`border-none shadow-sm ${margin < 0 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-center text-slate-500">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Marża (Zysk/Strata)</span>
                            <div className={`w-2.5 h-2.5 rounded-full ${margin < 0 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                        </div>
                        <CardTitle className={`text-2xl font-black ${margin < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                            {formatPln(margin)}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Visuals & Stages */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-slate-200">
                        <CardHeader className="border-b bg-slate-50/50">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-blue-600" />
                                Podsumowanie Finansowe
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <ProjectFinancialChart 
                                budgetEstimated={budgetEstimated}
                                totalInvoiced={totalInvoiced}
                                totalCosts={totalCosts}
                            />
                        </CardContent>
                    </Card>

                    <ProjectStageList projectId={project.id} stages={stages} />
                </div>

                {/* Costs History */}
                <Card className="h-fit border-slate-200 sticky top-6">
                    <CardHeader className="pb-4 border-b bg-slate-50/50">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <ReceiptText className="w-4 h-4 text-slate-400" />
                            Ostatnie Koszty
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {transactions.length === 0 ? (
                            <div className="p-12 text-center">
                                <p className="text-slate-400 italic text-sm">Brak zarejestrowanych kosztów dla tego projektu.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                                {transactions.map((t: any) => (
                                    <div key={t.id} className="p-4 hover:bg-slate-50 transition-colors group">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(t.transactionDate).toLocaleDateString('pl-PL')}
                                            </span>
                                            <span className="font-black text-rose-600 text-sm group-hover:scale-105 transition-transform">{formatPln(t.amount)}</span>
                                        </div>
                                        <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{t.category}</p>
                                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{t.description || "Brak opisu transakcji"}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
