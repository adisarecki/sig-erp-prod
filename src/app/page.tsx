export const dynamic = "force-dynamic"
import Decimal from 'decimal.js'
import prisma from "@/lib/prisma"
import { KSeFSyncButton } from "@/components/finance/KSeFSyncButton"
import { AlertCircle, ArrowDownRight, ArrowUpRight, CalendarDays, Wallet, BadgeDollarSign, TrendingUp, TrendingDown, Lock, History, Landmark, CheckCircle2 } from 'lucide-react'
import { TooltipHelp } from '@/components/ui/TooltipHelp'
import { MoneyPieChart } from '@/components/dashboard/MoneyPieChart'
import { QuickActionsBar } from '@/components/finance/QuickActionsBar'
import { scanForLeaks } from '@/lib/finance/leakage-detection'
import { LeakageAlerts } from '@/components/finance/LeakageAlerts'
import { Button } from "@/components/ui/button"
import { ConfirmPaymentButton } from "@/components/finance/ConfirmPaymentButton"
import { CashFlowChart } from "@/components/finance/CashFlowChart"
import Link from 'next/link'
import { getAdminDb, initFirebaseAdmin } from "@/lib/firebaseAdmin"
import { getCurrentTenantId } from "@/lib/tenant"
import { TimeFilterTabs } from "@/components/finance/TimeFilterTabs"
import { CIT_RATE } from "@/lib/config/tax"
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay"
import { RetentionVault } from "@/components/finance/RetentionVault"
import { PendingInvoicesWidget } from "@/components/dashboard/PendingInvoicesWidget"
import { getVatBalanceColor, getFinancialColor } from "@/lib/utils/financeMapper"
import { EnrichmentProposalWidget } from "@/components/dashboard/EnrichmentProposalWidget"
import { getFinancialSnapshot } from "@/lib/finance/ledger-service"

// Inicjalizacja Firebase Admin dla Dashboardu
initFirebaseAdmin();

// Pomocnicza funkcja do formatowania PLN
const formatPln = (value: number | string | Decimal) => {
  const num = typeof value === 'number' ? value : new Decimal(String(value)).toNumber()
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(num)
}



export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ period?: string; year?: string }>
}) {
  const params = await searchParams
  const period = params.period || 'ALL'
  const selectedYear = parseInt(params.year || '2026')
  const tenantId = await getCurrentTenantId()
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } }) as any
  const leakageAlerts = await scanForLeaks(tenantId)

  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  // Filtry czasowe dla Dashboardu (Vector 023: Dynamic Date Ranges)
  let startDate: Date | null = null
  let endDate: Date | null = null
  const currentMonth = now.getMonth()

  if (period === 'MONTH') {
    startDate = new Date(selectedYear, currentMonth, 1)
    endDate = new Date(selectedYear, currentMonth + 1, 0, 23, 59, 59)
  } else if (period === 'QUARTER') {
    const startMonth = Math.floor(currentMonth / 3) * 3
    startDate = new Date(selectedYear, startMonth, 1)
    endDate = new Date(selectedYear, startMonth + 3, 0, 23, 59, 59)
  } else if (period === 'YEAR') {
    startDate = new Date(selectedYear, 0, 1)
    endDate = new Date(selectedYear, 11, 31, 23, 59, 59)
  }

  // POBRANIE DANYCH Z FIRESTORE (NoSQL Approach)
  const adminDb = getAdminDb()
  const [
    projectsSnap,
    transactionsSnap,
    invoicesSnap,
    debtInstallmentsSnap,
    legacyDebtsSnap,
    projectStagesSnap,
    contractorsSnap,
    retentionsSnap
  ] = await Promise.all([
    adminDb.collection("projects").where("tenantId", "==", tenantId).where("lifecycleStatus", "==", "ACTIVE").get(),
    adminDb.collection("transactions").where("tenantId", "==", tenantId).where("status", "==", "ACTIVE").get(),
    adminDb.collection("invoices").where("tenantId", "==", tenantId).get(),
    adminDb.collection("legacy_debt_installments").get(),
    adminDb.collection("legacy_debts").where("tenantId", "==", tenantId).get(),
    adminDb.collection("project_stages").get(),
    adminDb.collection("contractors").where("tenantId", "==", tenantId).get(),
    adminDb.collection("retentions").where("tenantId", "==", tenantId).get()
  ])

  const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }))
  const transactions = transactionsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }))
  const allInvoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() as any }))
  const allDebtInstallments = debtInstallmentsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }))
  const legacyDebts = legacyDebtsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }))
  const allStages = projectStagesSnap.docs.map(d => ({ id: d.id, ...d.data() as any }))
  const contractors = contractorsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }))
  const retentions = retentionsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }))

  const enrichmentNotifications = await (prisma as any).notification.findMany({
    where: {
      tenantId,
      type: 'ENRICHMENT_PROPOSAL',
      isRead: false
    },
    orderBy: { createdAt: 'desc' }
  })

  // POBRANIE WPROWADZONYCH FAKTUR Z ZALEDGŁOŚCIAMI Z PRISMA (KSeF + Sync)
  const prismaUnpaidInvoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      paymentStatus: "UNPAID",
      status: "ACTIVE"
    },
    include: { contractor: true }
  })

  // --- VECTOR 109: CORE LEDGER FETCH (SSoT) ---
  const ledgerSnapshot = await getFinancialSnapshot(tenantId);
  
  // 1. REAL CASH (Gotówka Operacyjna)
  const realCashBalance = ledgerSnapshot.realCashBalance;

  // 2. FUEL (Paliwo / Marża) - Wynik memoriałowy netto (Incomes - Expenses)
  const fuelAccrualNet = ledgerSnapshot.fuelAccrualNet;

  // 3. VAULT (Skarbiec Kaucji)
  const vaultValue = ledgerSnapshot.vaultValue;

  // 4. VAT SHIELD (Tarcza VAT)
  const vatShieldBalance = ledgerSnapshot.vatBalance;

  // --- VECTOR 107 REFACTOR: LEGACY MANUAL AGGREGATION REMOVED ---
  // The ledgerEntries fetch and manual filtering is replaced by LedgerService.

  const unpaidTotalAmountGross = ledgerSnapshot.unpaidInvoicesGross;

  // Re-enable contractors mapping (needed for other UI parts)
  const contractorsMap: Record<string, string> = {}
  contractors.forEach((c: any) => { contractorsMap[c.id] = c.name })
  const debtIds = legacyDebts.map(d => d.id)
  const tenantDebtInstallments = allDebtInstallments.filter(di => debtIds.includes(di.debtId))

  // Special aggregates (will be moved to LedgerService in next refinement)
  const totalGeneralCostsNet = await (prisma as any).ledgerEntry.aggregate({
    where: { tenantId, type: 'EXPENSE', projectId: null },
    _sum: { amount: true }
  }).then((res: any) => new Decimal(String(res._sum.amount || 0)).abs());

  const projectMarginSumNet = await (prisma as any).ledgerEntry.aggregate({
    where: { tenantId, type: { in: ['INCOME', 'EXPENSE'] }, NOT: { projectId: null } },
    _sum: { amount: true }
  }).then((res: any) => new Decimal(String(res._sum.amount || 0)));

  const realCashCostsNet = await (prisma as any).ledgerEntry.aggregate({
    where: { tenantId, type: 'EXPENSE', source: { in: ['BANK_PAYMENT', 'SHADOW_COST'] } },
    _sum: { amount: true }
  }).then((res: any) => new Decimal(String(res._sum.amount || 0)).abs());

  const uncollectedRevenue = allInvoices
    .filter((inv: any) => (inv.type === 'SPRZEDAŻ' || inv.type === 'INCOME') && inv.status !== 'PAID')
    .reduce((sum: Decimal, inv: any) => sum.plus(new Decimal(inv.amountNet)), new Decimal(0))

  const releasedRetentionValue = new Decimal(0)
  const totalReserve = unpaidTotalAmountGross.plus(Decimal.max(0, vatShieldBalance.times(-1)))
  const cumulativeAccrualProfit = fuelAccrualNet
  const netVat = vatShieldBalance

  const totalDebtRemaining = legacyDebts.reduce((sum, d) => sum.plus(new Decimal(d.remainingAmount || 0)), new Decimal(0))
  const totalProjectBudgets = projects.reduce((sum, p) => sum.plus(new Decimal(p.budgetEstimated || 0)), new Decimal(0))
  const totalStageBudgets = allStages.filter(s => projects.some(p => p.id === s.projectId)).reduce((sum, s) => sum.plus(new Decimal(s.budgetEstimated || 0)), new Decimal(0))
  const plannedMargin = totalProjectBudgets.minus(totalStageBudgets)
  
  const globalBilans = ledgerSnapshot.realCashBalance;
  const netProfit = fuelAccrualNet
  const cleanCash = ledgerSnapshot.safeToSpend;
  const totalFrozenRetentionValue = vaultValue


  // LOGIKA WYKRESU I ALERTÓW
  const REVENUE_BUFFER = 14
  const chartData = []
  const allAlerts: { id?: string, title: string, amount: number, date: Date, type: string, contractor: string, isIncome?: boolean, invoiceNumber?: string, isDebtInstallment?: boolean }[] = []
  let overdueAmount = new Decimal(0)

  const unpaidIncomes = allInvoices.filter(inv => (inv.type === 'SPRZEDAŻ' || inv.type === 'INCOME' || inv.type === 'REVENUE') && inv.status !== 'PAID')
  const unpaidCosts = allInvoices.filter(inv => (inv.type === 'KOSZT' || inv.type === 'ZAKUP' || inv.type === 'EXPENSE') && inv.status !== 'PAID')
  const activeInstallments = tenantDebtInstallments.filter(di => di.status === 'ACTIVE')

  // Alerty i Overdue
  unpaidIncomes.forEach(inv => {
    const invDueDate = new Date(inv.dueDate)
    if (invDueDate < now) overdueAmount = overdueAmount.plus(new Decimal(inv.amountGross))

    if (invDueDate <= thirtyDaysFromNow) {
      allAlerts.push({
        id: inv.id,
        title: `Wpływ: ${inv.externalId || 'Faktura'}`,
        amount: Number(inv.amountGross),
        date: invDueDate,
        type: invDueDate < now ? 'ZALEGŁA' : 'Oczekujący wpływ',
        contractor: contractorsMap[inv.contractorId] || 'Nieznany',
        isIncome: true,
        invoiceNumber: inv.externalId
      })
    }
  })

  // Używamy bazy Prisma (KSeF Integration) do zasilenia Kosztów
  prismaUnpaidInvoices.forEach(inv => {
    // Uwzględnij tylko faktury kosztowe
    if (inv.type === 'INCOME' || inv.type === 'SPRZEDAŻ') return;

    const invDueDate = inv.dueDate ? new Date(inv.dueDate) : new Date(); // Fallback do dzisiaj jeśli brak
    if (invDueDate < now) overdueAmount = overdueAmount.plus(new Decimal(inv.amountGross || 0))

    if (invDueDate <= thirtyDaysFromNow) {
      allAlerts.push({
        id: inv.id,
        title: `Koszt: ${inv.invoiceNumber || inv.ksefId || 'Faktura'}`,
        amount: Number(inv.amountGross),
        date: invDueDate,
        type: invDueDate < now ? 'ZALEGŁA' : 'Do zapłaty',
        contractor: inv.contractor?.name || 'Nieznany',
        isIncome: false,
        invoiceNumber: inv.invoiceNumber || inv.ksefId || undefined
      })
    }
  })

  activeInstallments.forEach(di => {
    const dDate = new Date(di.dueDate)
    if (dDate < now) overdueAmount = overdueAmount.plus(new Decimal(di.amount))

    if (dDate <= thirtyDaysFromNow) {
      allAlerts.push({
        id: di.id,
        title: `Rata długu`,
        amount: Number(di.amount),
        date: dDate,
        type: 'Zobowiązanie ratalne',
        contractor: 'WIERZYCIEL',
        isIncome: false,
        isDebtInstallment: true
      })
    }
  })

  // Wykres Cash Reality (Realista)
  for (let i = 0; i <= 30; i += 3) {
    const dayDate = new Date(now)
    dayDate.setDate(dayDate.getDate() + i)
    let optIncome = new Decimal(0); let realIncome = new Decimal(0); let commonCosts = new Decimal(0)
    let dynamicRetention = new Decimal(0)

    unpaidIncomes.forEach(inv => {
      const dDate = new Date(inv.dueDate)
      if (dDate <= dayDate) optIncome = optIncome.plus(new Decimal(inv.amountGross))
      const rDate = new Date(inv.dueDate); rDate.setDate(rDate.getDate() + REVENUE_BUFFER)
      if (rDate <= dayDate) realIncome = realIncome.plus(new Decimal(inv.amountGross))
    })

    // Dynamiczna obsługa kaucji (retention)
    allInvoices.forEach(inv => {
      if (inv.status === 'PAID' && inv.retainedAmount && inv.retentionReleaseDate) {
        const releaseDate = new Date(inv.retentionReleaseDate)
        if (releaseDate <= dayDate) {
          dynamicRetention = dynamicRetention.plus(new Decimal(inv.retainedAmount))
        }
      }
    })

    unpaidCosts.forEach(inv => { if (new Date(inv.dueDate) <= dayDate) commonCosts = commonCosts.plus(new Decimal(inv.amountGross)) })
    activeInstallments.forEach(di => { if (new Date(di.dueDate) <= dayDate) commonCosts = commonCosts.plus(new Decimal(di.amount)) })

    chartData.push({
      date: dayDate.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }),
      optymista: globalBilans.plus(optIncome).plus(dynamicRetention).minus(commonCosts).toNumber(),
      realista: globalBilans.plus(realIncome).plus(dynamicRetention).minus(commonCosts).toNumber()
    })
  }

  const realisticBalance30d = new Decimal(chartData[chartData.length - 1].realista)
  const showRealityAlert = realisticBalance30d.lt(0)
  const sortedAlerts = allAlerts.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 4)

  // Metryki do Progress Barów i Hero Section
  const cfIncomes30d = unpaidIncomes.filter((inv: any) => new Date(inv.dueDate) <= thirtyDaysFromNow).reduce((sum: any, inv: any) => sum.plus(new Decimal(inv.amountGross)), new Decimal(0)).plus(releasedRetentionValue)
  const cfExpenses30d = unpaidCosts.filter((inv: any) => new Date(inv.dueDate) <= thirtyDaysFromNow).reduce((sum: any, inv: any) => sum.plus(new Decimal(inv.amountGross)), new Decimal(0)).plus(activeInstallments.filter((di: any) => new Date(di.dueDate) <= thirtyDaysFromNow).reduce((sum: any, di: any) => sum.plus(new Decimal(di.amount)), new Decimal(0)))

  // Ostatnie Dokumenty
  const recentInvoices = allInvoices.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5)

  // Dane do Wykresu Kołowego
  const pieChartData = [
    { name: 'Poniesione Koszty (Netto)', value: realCashCostsNet.toNumber(), color: '#ef4444' },
    { name: 'Należności z Faktur (Netto)', value: uncollectedRevenue.toNumber(), color: '#f59e0b' },
    { name: 'Płynna Gotówka (Netto)', value: Decimal.max(0, netProfit).toNumber(), color: '#10b981' }
  ]

  // Formatted Strings for UI
  // POBRANIE NAJNOWSZEJ KOTWICY SALDA (Vector 106)
  // @ts-ignore
  let latestBankAnchor = null;
  try {
    latestBankAnchor = await (prisma as any).bankBalanceState.findFirst({
      where: { tenantId },
      orderBy: { verificationTimestamp: 'desc' }
    });
  } catch (err) {
    console.error("CRITICAL: BankBalanceState table missing or query failed. Graceful fallback activated.", err);
  }

  const verifiedBalance = latestBankAnchor ? new Decimal(String(latestBankAnchor.verifiedBalance)) : null
  
  const delta = verifiedBalance ? globalBilans.minus(verifiedBalance).abs() : null
  const financialIntegrityStatus = delta !== null ? (delta.isZero() ? 'VERIFIED_STABLE' : 'DISCREPANCY_ALERT') : 'NOT_VERIFIED'

  const formattedNetCash = formatPln(globalBilans);
  const formattedCfExpenses30d = formatPln(cfExpenses30d);
  const formattedTaxReserve = formatPln(totalReserve);
  const formattedNetProfit = formatPln(netProfit);
  const formattedCfIncomes30d = formatPln(cfIncomes30d);
  const formattedCleanCash = formatPln(cleanCash);
  const formattedVerifiedBalance = verifiedBalance ? formatPln(verifiedBalance) : "BRAK DANYCH"

  const formattedNetVat = formatPln(netVat.abs());
  const isVatOverpaid = netVat.gte(0);
  const vatStatusColor = getVatBalanceColor(netVat);
  const formattedGeneralCosts = formatPln(totalGeneralCostsNet);
  const formattedProjectMargin = formatPln(projectMarginSumNet);

  // Dynamiczna lista lat (Vector 023)
  const invoiceYears = allInvoices.map(inv => new Date(inv.issueDate).getFullYear())
  const minYear = invoiceYears.length > 0 ? Math.min(...invoiceYears, 2024) : 2024
  const maxYear = now.getFullYear() + 1
  const availableYears = []
  for (let y = minYear; y <= maxYear; y++) availableYears.push(y)

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight italic">Ekstraklasa Management</h1>
          <p className="text-slate-500 font-medium">System Operacyjny Firmy • <span className="text-slate-900 uppercase font-bold text-xs bg-slate-100 px-2 py-1 rounded">Prawda Finansowa (Anchor)</span></p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <TimeFilterTabs availableYears={availableYears} currentYear={selectedYear} />
          <QuickActionsBar
            projects={projects.map(p => ({ id: p.id, name: p.name }))}
            contractors={contractors}
          />
        </div>
      </div>

      {showRealityAlert && (
        <div className="bg-rose-600 text-white p-6 rounded-3xl shadow-2xl border-4 border-rose-400 animate-in fade-in zoom-in duration-500 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="bg-white/20 p-3 rounded-2xl">
              <AlertCircle className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-widest">ALARM PŁYNNOŚCI: REALISTA</h3>
              <p className="text-base font-medium opacity-90">Uwzględniając 14-dniowe opóźnienia wpłat, bilans 30-dniowy spada na: <span className="font-bold border-b-2 border-white">{formatPln(realisticBalance30d)}</span></p>
            </div>
          </div>
          <Link href={`/finance?status=UNPAID&sort=dueDate_ASC${selectedYear ? `&year=${selectedYear}` : ''}`}>
            <Button variant="outline" className="bg-white text-rose-600 border-none font-bold hover:bg-rose-50 px-8 h-12 rounded-xl shadow-lg">Zarządzaj Kosztami</Button>
          </Link>
        </div>
      )}

      {/* LEAKAGE DETECTION SECTION */}
      <LeakageAlerts alerts={leakageAlerts} />

      {/* POTWIERDZONE SALDO BANKOWE - VECTOR 106 HERO SECTION */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-black text-white p-8 rounded-3xl shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
          <Landmark className="w-48 h-48 text-indigo-300" />
        </div>
        <div className="relative z-10">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-medium text-slate-300 tracking-wide uppercase flex items-center gap-2">
                Potwierdzone Saldo Bankowe (PKO BP)
                {financialIntegrityStatus === 'VERIFIED_STABLE' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : financialIntegrityStatus === 'DISCREPANCY_ALERT' ? (
                  <AlertCircle className="w-5 h-5 text-rose-400" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-slate-500" />
                )}
              </h2>
              <TooltipHelp content="Saldo pobrane bezpośrednio z ostatniego wyciągu bankowego (Anchor). Jest to absolutna podstawa Twojej płynności." />
            </div>
            {/* KSeF SYNC - VECTOR 059 */}
            <KSeFSyncButton
              hasToken={!!tenant?.ksefToken}
              variant="outline"
              className="bg-white/10 border-white/20 hover:bg-white/20 text-white"
            />
          </div>
          <div className="flex items-end gap-4 mt-4">
            <p className="text-6xl font-black tracking-tighter drop-shadow-sm text-indigo-100">
              {formattedVerifiedBalance}
            </p>
            <div className="pb-2">
              <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border ${financialIntegrityStatus === 'VERIFIED_STABLE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                {financialIntegrityStatus}
              </span>
            </div>
          </div>

          <div className="flex gap-6 mt-6 border-t border-slate-700/50 pt-6">
            <div>
              <p className="text-sm text-slate-400 font-medium mb-1 uppercase tracking-tighter italic">Czysta Gotówka (Safe to Spend)</p>
              <p className={`font-bold text-xl ${getFinancialColor(cleanCash)}`}>{formattedCleanCash}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400 font-medium mb-1 uppercase tracking-tighter">Bilans Systemowy (Ledger)</p>
              <p className={`font-bold text-xl ${getFinancialColor(globalBilans)}`}>{formattedNetCash}</p>
            </div>
            <div>
              <p className={`text-sm font-medium mb-1 uppercase tracking-tighter ${vatStatusColor}`}>
                {isVatOverpaid ? 'Nadpłata VAT' : 'Dług VAT'}
              </p>
              <p className={`font-bold text-xl ${vatStatusColor}`}>
                {isVatOverpaid ? '+' : '-'}{formattedNetVat}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1">
                <p className={`text-sm font-medium uppercase tracking-tighter ${getFinancialColor(unpaidTotalAmountGross.negated())}`}>Faktury do Zapłaty</p>
              </div>
              <p className={`font-bold text-[18px] mt-0.5 ${getFinancialColor(unpaidTotalAmountGross.negated())}`}>-{formatPln(unpaidTotalAmountGross)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* STRATEGIC CEO INSIGHTS */}
      <div className="grid gap-6 md:grid-cols-4">
        <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm border-l-4 border-l-indigo-600">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Marża Projektowa (Netto)</h3>
              <TooltipHelp content="Całkowity zysk wygenerowany na projektach (Przychody minus Koszty Projektów). Nie uwzględnia jeszcze kosztów stałych firmy." />
            </div>
          </div>
          <p className="text-3xl font-black mt-4 text-indigo-700">{formattedProjectMargin}</p>
          <p className="text-xs mt-1 text-slate-500 font-medium">Zysk zrealizowany na projektach (bez VAT).</p>
        </div>

        <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm border-l-4 border-l-orange-500">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Koszty Ogólne (Netto)</h3>
              <TooltipHelp content="Wydatki na funkcjonowanie firmy (np. paliwo, biuro, usługi księgowe), które nie są bezpośrednio powiązane z konkretnym zleceniem." />
            </div>
          </div>
          <p className="text-3xl font-black mt-4 text-orange-700">-{formattedGeneralCosts}</p>
          <p className="text-xs mt-1 text-slate-500 font-medium">Koszty zarządu i biurowe (bez VAT).</p>
        </div>

        <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm border-l-4 border-l-emerald-600">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <BadgeDollarSign className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Zysk Realny (Netto)</h3>
              <TooltipHelp content="Twój ostateczny wynik firmy. Marża z projektów pomniejszona o koszty ogólne (biuro, auta)." />
            </div>
          </div>
          <p className="text-3xl font-black mt-4 text-emerald-700">{formattedNetProfit}</p>
          <p className="text-xs mt-1 text-slate-500 font-medium">Wynik końcowy (Marża - Ogólne) Netto.</p>
        </div>

        <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm border-l-4 border-l-cyan-600">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-100 text-cyan-600 rounded-lg">
              <Lock className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 italic">Realny Limit Operacyjny (Paliwo)</h3>
              <TooltipHelp content="Suma realnych wpływów (Paliwo) dla wszystkich aktywnych projektów. To Twoja faktyczna baza operacyjna i granica wydatków (90% kontraktów)." />
            </div>
          </div>
          {(() => {
            const totalProjectRealInflow = projects.reduce((sum, p) => {
              const budget = new Decimal(p.budgetEstimated || 0);
              const rate = (p.retentionShortTermRate || 0) + (p.retentionLongTermRate || 0);
              return sum.plus(budget.times(new Decimal(1 - rate)));
            }, new Decimal(0));
            return (
              <>
                <p className="text-3xl font-black mt-4 text-slate-900 tracking-tighter">{formatPln(totalProjectRealInflow)}</p>
                <p className="text-[10px] mt-2 text-emerald-600 font-extrabold uppercase tracking-widest">Dostępne do Operacyjnego Wydania (pomniejszone o kaucje)</p>
              </>
            );
          })()}
        </div>
      </div>

      {/* METRYKI GŁÓWNE (Fort Knox Edition) */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* SKUMULOWANY ZYSK */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <Wallet className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-600">Skumulowany Zysk (Netto)</h3>
              <TooltipHelp content="Wynik księgowy (Memoriałowo) – uwzględnia też faktury wystawione, ale jeszcze nieopłacone." />
            </div>
          </div>
          <p className="text-3xl font-bold mt-4 text-slate-900">{formatPln(cumulativeAccrualProfit)}</p>
          <p className="text-xs mt-1 text-slate-500">Wynik dochodowy (Memoriałowo).</p>
        </div>

        {/* PROGNOZA 30D (Z FILTREM KAUCJI) */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-600">Prognoza Wpływów</h3>
                <TooltipHelp content="Pieniądze, na które czekasz – suma wystawionych przez Ciebie, ale jeszcze nieopłaconych przez klientów faktur." />
              </div>
            </div>
          </div>
          <p className="text-3xl font-bold mt-4 text-green-600">+{formatPln(cfIncomes30d)}</p>
          <div className="flex flex-col mt-1">
            <p className="text-[10px] text-slate-500 font-medium">Faktury + {formatPln(releasedRetentionValue)} kaucji.</p>
            {overdueAmount.gt(0) && (
              <span className="text-[10px] font-black text-rose-600 mt-1">
                UWAGA: {formatPln(overdueAmount)} po terminie!
              </span>
            )}
          </div>
        </div>

        {/* SKARBIEC KAUCJI (NEW - VAULT COMPONENT) */}
        <div className="lg:col-span-1">
          <RetentionVault
            retentions={retentions}
            projects={projects}
            contractors={contractors}
            invoices={allInvoices}
          />
        </div>

        {/* PROWIZJA / FAKTUROWANIE (Phase 9) */}
        <div className="lg:col-span-1">
          <PendingInvoicesWidget />
        </div>

        {/* DŁUGI HISTORYCZNE (NEW) */}
        <div className="p-6 bg-slate-900 text-white border border-slate-800 rounded-2xl shadow-lg shadow-slate-200 group transition-all hover:scale-[1.02]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-800 text-rose-400 rounded-lg border border-slate-700">
                <History className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold uppercase tracking-tight text-slate-400">Długi (Debt)</h3>
                <TooltipHelp content="Twoje zobowiązania – faktury kosztowe w systemie, za które jeszcze nie przelałeś dostawcom pieniędzy." />
              </div>
            </div>
          </div>
          <p className="text-3xl font-black mt-4 font-mono text-rose-100">{formatPln(totalDebtRemaining)}</p>
          <p className="text-[10px] mt-1 text-slate-500 font-medium">Pozostało do spłaty wierzycielom.</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* WYKRES KOŁOWY */}
        <div className="lg:col-span-1 bg-white border text-slate-900 border-slate-200 shadow-sm rounded-2xl p-6">
          <div className="flex items-center mb-6">
            <h2 className="text-lg font-bold">Kapitał Operacyjny (Cash is King)</h2>
            <TooltipHelp content="Zależność generowanych Kosztów (Netto) względem Kapitału własnego oraz zadłużenia Twoich klientów." />
          </div>
          <MoneyPieChart data={pieChartData} />
        </div>

        {/* WYKRES CASH FLOW */}
        <div className="lg:col-span-1 bg-white border text-slate-900 border-slate-200 shadow-sm rounded-2xl p-6">
          <div className="flex items-center mb-6">
            <h2 className="text-lg font-bold">Wizualizacja 'Cash Reality' (30 dni)</h2>
            <TooltipHelp content="Zielona linia to optymistyczny wariant płatności na czas. Szara linia przerywana to Realista - zakłada, że klienci spóźnią się o 14 dni, a Ty płacisz na czas." />
          </div>
          <CashFlowChart data={chartData} />
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="font-semibold text-slate-700">Prognoza 'Realista' (30D):</span>
            <span className={`text-xl font-bold ${realisticBalance30d.gte(0) ? 'text-green-600' : 'text-red-600'}`}>
              {formatPln(realisticBalance30d)}
            </span>
          </div>
        </div>

        {/* ALERTY */}
        <div className="lg:col-span-1 bg-white border text-slate-900 border-slate-200 shadow-sm rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6 text-orange-600">
            <AlertCircle className="w-5 h-5 font-bold" />
            <h2 className="text-lg font-bold">Płatności wedlug Terminów</h2>
          </div>

          <div className="space-y-4">
            {sortedAlerts.length === 0 ? (
              <div className="text-sm p-4 text-center bg-slate-50 text-slate-500 rounded-xl">Brak nadchodzących terminów zapłat i faktur.</div>
            ) : (
              sortedAlerts.map((alert, idx) => (
                <div key={idx} className={`flex flex-col gap-3 p-4 rounded-xl border transition-colors ${alert.date < now ? 'border-rose-300 bg-rose-50/50' : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'}`}>
                  <div className="flex gap-4">
                    <div className={`p-3 rounded-lg flex items-center justify-center shrink-0 ${alert.isIncome ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                      <CalendarDays className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <p className="font-semibold text-slate-900 truncate" title={alert.title}>{alert.title}</p>
                      <p className="text-sm text-slate-500">{alert.contractor} • <span className={alert.isIncome ? 'text-green-600 font-medium' : 'text-slate-700 font-medium'}>
                        {alert.date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}
                      </span>
                      </p>
                    </div>
                    <div className={`flex flex-col justify-center items-end shrink-0 font-bold ${alert.date < now ? 'text-rose-600' : (alert.isIncome ? 'text-green-600' : 'text-slate-800')}`}>
                      {alert.isIncome ? '+' : '-'}{formatPln(alert.amount)}
                    </div>
                  </div>

                  {alert.id && (
                    <div className="flex justify-end pt-2 border-t border-slate-200/50 border-dashed">
                      <ConfirmPaymentButton
                        invoiceId={alert.isDebtInstallment ? undefined : alert.id}
                        installmentId={alert.isDebtInstallment ? alert.id : undefined}
                        isInstallment={alert.isDebtInstallment}
                        amountGross={alert.amount}
                        isIncome={!!alert.isIncome}
                      />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        {/* LISTA OSTATNICH FAKTUR (Nowa Sekcja) */}
        <div className="bg-white border text-slate-900 border-slate-200 shadow-sm rounded-3xl p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3 text-slate-900">
              <div className="p-2 bg-slate-100 rounded-xl">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight">Ostatnie Dokumenty</h2>
            </div>
            <Link href="/finance">
              <Button variant="ghost" className="text-sm font-bold text-slate-500 hover:text-slate-900 border border-slate-200">Zobacz wszystko →</Button>
            </Link>
          </div>

          <div className="space-y-4">
            {recentInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50/30 hover:bg-slate-50 transition-all">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${inv.type === 'SPRZEDAŻ' ? 'bg-green-100 text-green-600' : 'bg-rose-100 text-rose-600'}`}>
                    {inv.type === 'SPRZEDAŻ' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{inv.contractor?.name}</p>
                    <p className="text-xs text-slate-500 font-medium">{inv.externalId || inv.description || 'Dokument Finansowy'} • {inv.project?.name || 'Ogólny'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <CurrencyDisplay
                      gross={inv.amountGross}
                      net={inv.amountNet}
                      isIncome={inv.type === 'SPRZEDAŻ' || inv.type === 'INCOME' || inv.type === 'REVENUE'}
                      className={`font-black text-lg ${(inv.type === 'SPRZEDAŻ' || inv.type === 'INCOME' || inv.type === 'REVENUE') ? 'text-green-600' : 'text-slate-900'}`}
                    />
                    <p className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                      {inv.status === 'PAID' ? 'Opłacona' : 'Nieopłacona'}
                    </p>
                  </div>

                  {inv.status !== 'PAID' && (
                    <ConfirmPaymentButton
                      invoiceId={inv.id}
                      invoiceNumber={inv.externalId || 'Dokument'}
                      amountGross={Number(inv.amountGross)}
                      isIncome={inv.type === 'SPRZEDAŻ' || inv.type === 'INCOME' || inv.type === 'REVENUE'}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* VECTOR 099: Smart Enrichment Proposals */}
        <div className="lg:col-span-1 space-y-8">
          {enrichmentNotifications.length > 0 && (
            <EnrichmentProposalWidget notifications={enrichmentNotifications} />
          )}

          {/* LOGIKA DNA (Szybki Podgląd Zasad) */}
          <div className="bg-slate-900 text-white border border-slate-800 shadow-2xl rounded-3xl p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
              <Lock className="w-48 h-48" />
            </div>
            <div className="relative z-10 h-full flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-black uppercase tracking-widest text-indigo-400 mb-6">Zasady SYSTEM_DNA</h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                    <p className="text-sm font-medium text-slate-300"><b>Cash is King</b>: Bilans liczony tylko z zaksięgowanych transakcji.</p>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                    <p className="text-sm font-medium text-slate-300"><b>Tax Guard</b>: Rezerwa 9% CIT + VAT Netto blokowana na starcie.</p>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                    <p className="text-sm font-medium text-slate-300"><b>Realista</b>: Automatyczne przesunięcie wpływów o 14 dni w symulacji.</p>
                  </li>
                </ul>
              </div>
              <div className="mt-8 pt-8 border-t border-slate-800">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Wersja Systemu: Fort Knox &bull; Ekstraklasa 2026</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
