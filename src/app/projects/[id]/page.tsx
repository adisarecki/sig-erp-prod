export const dynamic = "force-dynamic"
import { getProjectWithDetails, getProjects } from "@/app/actions/projects"
import { getContractors } from "@/app/actions/crm"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ProjectStageList } from "@/components/projects/ProjectStageList"
import { ProjectFinancialChart } from "@/components/projects/ProjectFinancialChart"
import { ProjectCockpitActions } from "@/components/projects/ProjectCockpitActions"
import { ProjectAnalysisDialog } from "@/components/projects/ProjectAnalysisDialog"
import { TransactionDeleteButton } from "@/components/projects/TransactionDeleteButton"
import { ArrowLeft, Building2, MapPin, Wallet, TrendingUp, ReceiptText, Calendar, BadgeDollarSign, Percent, PieChart } from "lucide-react"
import Link from "next/link"
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay"
import { mapFinancialValues, FinancialType } from "@/lib/utils/financeMapper"
import Decimal from "decimal.js"

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

    // Test Mode logic (Server-side bypass for client visibility)
    const isTestMode = process.env.ENABLE_TEST_DELETE === "true" || process.env.NEXT_PUBLIC_ENABLE_TEST_DELETE === "true"

    // Defensive data extraction
    const invoices = project.invoices || []
    const transactions = project.transactions || []
    const stages = project.stages || []
    const budgetEstimated = Number(project.budgetEstimated) || 0

    // DNA Vector 099: Centralne mapowanie kosztów i przychodów projektu
    let totalInvoiced = new Decimal(0)
    let totalCosts = new Decimal(0)

    transactions.forEach((t: any) => {
        const { signedNet } = mapFinancialValues(
            t.amountNet || 0,
            (t.amount || 0) - (t.amountNet || 0),
            t.type as FinancialType
        );
        if (signedNet.gte(0)) {
            totalInvoiced = totalInvoiced.plus(signedNet);
        } else {
            totalCosts = totalCosts.plus(signedNet.abs());
        }
    });

    const margin = totalInvoiced.minus(totalCosts)
    const percentUsed = budgetEstimated > 0 ? totalCosts.dividedBy(budgetEstimated).times(100).toNumber() : 0

    // NEW PRECENTAGE METRICS
    const roi = totalCosts.isZero() ? new Decimal(0) : margin.dividedBy(totalCosts).times(100)
    const profitabilityMargin = totalInvoiced.isZero() ? new Decimal(0) : margin.dividedBy(totalInvoiced).times(100)

    const totalInvoicedNet = invoices
        .filter((inv: any) => inv.type === 'SPRZEDAŻ' || inv.type === 'INCOME' || inv.type === 'REVENUE')
        .reduce((sum: number, inv: any) => sum + Number(inv.amountNet), 0)

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
                        <ProjectAnalysisDialog 
                            projectName={project.name}
                            budgetEstimated={budgetEstimated}
                            invoices={invoices.map((inv: any) => ({
                                type: inv.type,
                                amountNet: Number(inv.amountNet),
                                amountGross: Number(inv.amountGross || inv.amountNet),
                                issueDate: typeof inv.issueDate === 'string' ? inv.issueDate : inv.issueDate.toISOString()
                            }))}
                            transactions={transactions.map((t: any) => ({
                                type: t.type,
                                amount: Number(t.amount),
                                transactionDate: typeof t.transactionDate === 'string' ? t.transactionDate : t.transactionDate.toISOString()
                            }))}
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 font-medium">
                        <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4 text-slate-400" /> {project.contractor.name}</span>
                        <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400" /> {project.object.name} ({project.object.address || "Brak adresu"})</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                   <ProjectCockpitActions 
                        projectId={id}
                        projectName={project.name}
                        budgetEstimated={budgetEstimated}
                        totalInvoicedNet={totalInvoicedNet}
                        allProjects={allProjects}
                        contractors={contractors}
                        isTestMode={isTestMode}
                        projectStatus={project.status}
                    />
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                <Card className="bg-slate-900 text-white border-none shadow-xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Wallet className="w-12 h-12" />
                    </div>
                    <CardHeader className="pb-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Budget Szacowany</p>
                        <CardTitle className="text-xl font-black truncate">{formatPln(budgetEstimated)}</CardTitle>
                    </CardHeader>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-center text-slate-500">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Przychody (Faktury)</span>
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                        </div>
                        <CardTitle className="text-xl font-black text-slate-900">{formatPln(totalInvoiced.toNumber())}</CardTitle>
                    </CardHeader>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm border-l-4 border-l-rose-500">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-center text-slate-500">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Koszty Realne</span>
                            <ReceiptText className="w-4 h-4 text-rose-500" />
                        </div>
                        <CardTitle className="text-xl font-black text-rose-600 truncate">{formatPln(totalCosts.toNumber())}</CardTitle>
                        <div className="mt-1 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                                className={`h-full ${percentUsed > 90 ? 'bg-rose-500' : 'bg-blue-500'}`}
                                style={{ width: `${Math.min(percentUsed, 100)}%` }}
                            />
                        </div>
                    </CardHeader>
                </Card>

                <Card className={`border-none shadow-sm ${margin.lt(0) ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-center text-slate-500">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Marża Kwotowa</span>
                            <div className={`w-2 h-2 rounded-full ${margin.lt(0) ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                        </div>
                        <CardTitle className={`text-xl font-black ${margin.lt(0) ? 'text-rose-700' : 'text-emerald-700'}`}>
                            {formatPln(margin.toNumber())}
                        </CardTitle>
                    </CardHeader>
                </Card>

                {/* ROI Card with Conditional Branding */}
                <Card className={`border-none ${
                    roi.gt(30) ? 'bg-emerald-600 text-white shadow-emerald-100/50' :
                    roi.gte(15) ? 'bg-amber-100 text-amber-900' :
                    'bg-red-50 text-red-700 border border-red-100'
                } shadow-xl relative overflow-hidden transition-all hover:scale-105 duration-300`}>
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-center opacity-80">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Real ROI</span>
                            <Percent className="w-4 h-4" />
                        </div>
                        <CardTitle className="text-3xl font-black">{roi.toFixed(1)}%</CardTitle>
                        <p className={`text-[9px] font-black uppercase mt-1 ${roi.gt(30) ? 'text-emerald-100' : roi.gte(15) ? 'text-amber-700' : 'text-red-500'}`}>
                            {roi.gt(30) ? "Super biznes 🚀" : roi.gte(15) ? "Ok, pilnuj kosztów 🛡️" : "Alarm - po kosztach! ⚠️"}
                        </p>
                    </CardHeader>
                </Card>

                {/* Rentowność Sprzedaży */}
                <Card className="bg-white border-slate-200 shadow-sm border-t-4 border-t-indigo-500">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-center text-slate-500">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Rentowność (%)</span>
                            <PieChart className="w-4 h-4 text-indigo-500" />
                        </div>
                        <CardTitle className="text-2xl font-black text-indigo-700">{profitabilityMargin.toFixed(1)}%</CardTitle>
                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Net Margin On Sale</p>
                    </CardHeader>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm border-l-4 border-l-indigo-500">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-center text-slate-500">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Planowana Marża</span>
                            <BadgeDollarSign className="w-4 h-4 text-indigo-500" />
                        </div>
                        <CardTitle className="text-xl font-black text-indigo-700 truncate">{formatPln(plannedMargin)}</CardTitle>
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
                                totalInvoiced={totalInvoiced.toNumber()}
                                totalCosts={totalCosts.toNumber()}
                            />
                        </CardContent>
                    </Card>

                    <ProjectStageList projectId={project.id} stages={stages} />
                </div>

                {/* Zaksięgowane Kwoty */}
                <Card className="h-fit border-slate-200 sticky top-6">
                    <CardHeader className="pb-4 border-b bg-slate-50/50">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <BadgeDollarSign className="w-4 h-4 text-slate-400" />
                            Zaksięgowane Kwoty
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {transactions.length === 0 ? (
                            <div className="p-12 text-center">
                                <p className="text-slate-400 italic text-sm">Brak zarejestrowanych kwot dla tego projektu.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                                {transactions.map((t: any) => (
                                    <div key={t.id} className="p-4 hover:bg-slate-50 transition-colors group relative">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(t.transactionDate).toLocaleDateString('pl-PL')}
                                            </span>
                                            {(() => {
                                            const { signedNet, signedGross, grossColor } = mapFinancialValues(
                                                t.amountNet || 0,
                                                (t.amount || 0) - (t.amountNet || 0),
                                                t.type as FinancialType
                                            );
                                            const isIncome = t.type === 'PRZYCHÓD' || t.type === 'INCOME' || t.type === 'SPRZEDAŻ' || t.type === 'REVENUE';
                                            
                                            return (
                                                <div className="flex items-center gap-2">
                                                    <CurrencyDisplay 
                                                        gross={signedGross.toNumber()}
                                                        net={signedNet.toNumber()}
                                                        isIncome={isIncome}
                                                        className={`font-black text-sm group-hover:scale-105 transition-transform ${grossColor}`}
                                                    />
                                                    <TransactionDeleteButton 
                                                        transactionId={t.id} 
                                                        description={`${t.category}: ${t.description || ''}`}
                                                        isTestMode={isTestMode}
                                                    />
                                                </div>
                                            );
                                        })()}
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-xs font-black text-slate-800 uppercase tracking-tight truncate flex-1">{t.category}</p>
                                            <Badge variant="outline" className="text-[9px] font-black py-0 px-1.5 h-4 border-slate-200 text-slate-400">
                                                {t.source}
                                            </Badge>
                                        </div>
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
