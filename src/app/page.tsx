import { PrismaClient } from '@prisma/client'
import { AlertCircle, ArrowDownRight, ArrowUpRight, Ban, CalendarDays, Wallet, BadgeDollarSign } from 'lucide-react'
import { TooltipHelp } from '@/components/ui/TooltipHelp'
import { MoneyPieChart } from '@/components/dashboard/MoneyPieChart'
import { RegisterCostModal } from '@/components/finance/RegisterCostModal'

const prisma = new PrismaClient()

// Pomocnicza funkcja do formatowania PLN
const formatPln = (value: number) => {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value)
}

// Funkcja pomocnicza do pobrania daty dla określonego dnia miesiąca
const getNextDateForDayOfMonth = (day: number) => {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth(), day)
  if (now.getDate() > day) {
    date.setMonth(date.getMonth() + 1)
  }
  return date
}

export default async function DashboardPage() {
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
  const now = new Date()

  // ZAPYTANIA DO BAZY
  // Z założenia dla MVP nie mamy logowania, wyciągamy wszystko co "jest w firmie" (dla wszystkich tenants na razie)
  const projects = await prisma.project.findMany({
    where: {
      status: 'IN_PROGRESS',
      lifecycleStatus: 'ACTIVE'
    },
    include: {
      invoices: true,
      transactions: true
    }
  })

  // Aktywne Faktury w przyszłości (do Cash Flow i Alertów)
  const upcomingInvoices = await prisma.invoice.findMany({
    where: {
      status: { not: 'PAID' }
    },
    include: {
      contractor: true,
      project: true
    },
    orderBy: { dueDate: 'asc' }
  })

  // Zobowiązania (Liabilities)
  const liabilities = await prisma.liability.findMany()

  // OBLICZENIA

  // 1. Suma marży operacyjnej ze wszystkich ALTYWNYCH projektów
  let totalMargin = 0
  let totalIncome = 0
  let totalExpense = 0

  projects.forEach((proj: any) => {
    const projIncome = proj.invoices.reduce((acc: number, inv: any) => acc + Number(inv.amountNet), 0)
    const projCosts = proj.transactions
      .filter((t: any) => t.type === 'KOSZT')
      .reduce((acc: number, t: any) => acc + Number(t.amount), 0)

    totalIncome += projIncome
    totalExpense += projCosts
    totalMargin += (projIncome - projCosts)
  })

  // SUMA REALNEJ GOTÓWKI W SYSTEMIE (Wypłacone Przychody - Skumulowane Koszty)
  const allTransactions = await prisma.transaction.findMany()

  let currentCash = 0
  let totalIncurredCosts = 0
  let totalRealizedRevenue = 0

  allTransactions.forEach((t: any) => {
    if (t.type === 'PRZYCHÓD') {
      currentCash += Number(t.amount)
      totalRealizedRevenue += Number(t.amount)
    } else if (t.type === 'KOSZT' || t.type === 'WYDATEK') {
      currentCash -= Number(t.amount)
      totalIncurredCosts += Number(t.amount)
    }
  })

  // 2. Wykres Cash Flow (Przychody względem Wydatków/Zobowiązań na najbl. 30 dni)
  let cfIncomes30d = 0
  let cfExpenses30d = 0

  // Faktury sprzedażowe do zapłaty = Planowany Przychód
  // Faktury kosztowe (zakupy) do zapłaty = Planowany Wydatek
  upcomingInvoices.forEach((inv: any) => {
    if (inv.dueDate <= thirtyDaysFromNow && inv.dueDate >= now) {
      // W demo wszystkie faktury typu "SPRZEDAŻ" to przychód firmowy.
      if (inv.type === 'SPRZEDAŻ') cfIncomes30d += Number(inv.amountGross)
      else if (inv.type === 'ZAKUP' || inv.type === 'KOSZT') cfExpenses30d += Number(inv.amountGross)
    }
  })

  // Zobowiązania (Leasingi, Kredyty - dołączane do Wydatków w najbl. 30 dni)
  liabilities.forEach((l: any) => {
    const nextPaymentDate = getNextDateForDayOfMonth(l.paymentDayOfMonth)
    if (nextPaymentDate <= thirtyDaysFromNow) {
      cfExpenses30d += Number(l.installmentAmount)
    }
  })

  // 3. Alerty Płatności (Top 3)
  const allAlerts: any[] = []

  // Część Alertów: Faktury Kosztowe "do zapłaty"
  upcomingInvoices
    .filter((inv: any) => inv.type !== 'SPRZEDAŻ')
    .forEach((inv: any) => {
      allAlerts.push({
        title: `Faktura: ${inv.project.name || 'Ogólna'}`,
        amount: Number(inv.amountGross),
        date: inv.dueDate,
        type: 'Faktura',
        contractor: inv.contractor.name
      })
    })

  // Faktury Sprzedażowe (zależnie od biznesu mogą oczekiwać na wpływ)
  upcomingInvoices
    .filter((inv: any) => inv.type === 'SPRZEDAŻ')
    .forEach((inv: any) => {
      allAlerts.push({
        title: `Spodziewany wpływ: ${inv.project.name}`,
        amount: Number(inv.amountGross),
        date: inv.dueDate,
        type: 'Oczekujący wpływ',
        contractor: inv.contractor.name,
        isIncome: true
      })
    })

  // Część Alertów: Leasingi/Zobowiązania
  liabilities.forEach((l: any) => {
    allAlerts.push({
      title: l.name,
      amount: Number(l.installmentAmount),
      date: getNextDateForDayOfMonth(l.paymentDayOfMonth),
      type: 'Rata (Zobowiązanie)',
      contractor: 'Bank / Leasingodawca'
    })
  })

  // Sortuj po dacie rosnąco i weź 3 najbliższe (ignorując te przeszłe o ponad kilka dni, albo pokazując przeterminowane)
  const sortedAlerts = allAlerts.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 3)

  // LOGIKA "WYKRESU"
  const maxCf = Math.max(cfIncomes30d, cfExpenses30d, 1)
  const incomePercent = (cfIncomes30d / maxCf) * 100
  const expensePercent = (cfExpenses30d / maxCf) * 100

  // 4. BEZPIECZNA WYPŁATA (Dywidyendy/Premie)
  const TAX_RESERVE_PERCENT = 0.19 // 19% podatek dochodowy (uproszczony model)
  const taxReserve = currentCash > 0 ? currentCash * TAX_RESERVE_PERCENT : 0
  const safeWithdrawal = Math.max(0, currentCash - cfExpenses30d - taxReserve)

  // Dane do Wykresu Kołowego
  const uncollectedRevenue = upcomingInvoices
    .filter((inv: any) => inv.type === 'SPRZEDAŻ')
    .reduce((acc: number, inv: any) => acc + Number(inv.amountNet), 0)

  const pieChartData = [
    { name: 'Poniesione Koszty', value: totalIncurredCosts, color: '#ef4444' }, // red-500
    { name: 'Należności (Faktury)', value: uncollectedRevenue, color: '#f59e0b' }, // amber-500
    { name: 'Zysk (Czysta Gotówka)', value: Math.max(0, currentCash), color: '#10b981' } // emerald-500
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Pulpit Menedżerski</h1>
        <p className="text-slate-500 mt-1">Szybki przegląd Twojej firmy inżynieryjnej. Alerty, płynność i aktywny cash-flow.</p>
      </div>

      {/* WSKAŹNIK BEZPIECZNEJ WYPŁATY - HERO SECTION */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-black text-white p-8 rounded-3xl shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
          <BadgeDollarSign className="w-48 h-48 text-indigo-300" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-medium text-slate-300">Profit First (Bezpieczna Wypłata / Gotówka do dyspozycji)</h2>
            <TooltipHelp content="Bezpieczna pula środków gotowa do wypłaty dla Wspólników. Kwota to bazowy stan gotówki firmy pomniejszony automatycznie o wszystkie Zobowiązania w 30 dni oraz zablokowaną 19% rezerwę podatkową i raty u leasingodawców." />
          </div>
          <p className="text-5xl font-black tracking-tight mt-4 text-emerald-400">
            {formatPln(safeWithdrawal)}
          </p>
          <div className="flex gap-6 mt-6 border-t border-slate-700/50 pt-6">
            <div>
              <p className="text-sm text-slate-400 font-medium mb-1">Płynna Gotówka (Transakcje)</p>
              <p className="font-semibold">{formatPln(currentCash)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400 font-medium mb-1">Zamrożona Rezerwa (Zobowiązania)</p>
              <p className="font-semibold text-rose-400">-{formatPln(cfExpenses30d)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400 font-medium mb-1">Rezerwa Podatkowa (19%)</p>
              <p className="font-semibold text-orange-300">-{formatPln(taxReserve)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* METRYKI GŁÓWNE */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <Wallet className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-600">Suma Marży Operacyjnej</h3>
            </div>
            <TooltipHelp content="Całkowity zysk z trwających projektów. Zależny jest od wpłaconych przez kontrahentów faktur i odlicza wszystkie zaksięgowane dotąd koszty operacyjne." />
          </div>
          <p className="text-3xl font-bold mt-4 text-slate-900">{formatPln(totalMargin)}</p>
          <p className="text-sm mt-1 text-slate-500">Z {projects.length} aktywnych projektów (Przychód - Koszty Transakcyjne).</p>
        </div>

        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-600">Wpływy z Faktur (30D)</h3>
            </div>
            <TooltipHelp content="Bezpieczne prognozy przychodów firmy na nadchodzący miesiąc na podstawie terminów płatności na wystawionych fakturach sprzedażowych dla klientów." />
          </div>
          <p className="text-3xl font-bold mt-4 text-green-600">+{formatPln(cfIncomes30d)}</p>
          <p className="text-sm mt-1 text-slate-500">Niezapłacone faktury z terminem w 30 dni.</p>
        </div>

        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                <ArrowDownRight className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-600">Zobowiązania (30D)</h3>
            </div>
            <TooltipHelp content="Zsumowane obciążenia firmy z tytułu wprowadzonych faktur kosztowych do zapłaty oraz stałych zobowiązań takich jak raty leasingowe, nadciągające w najbliższych 30 dniach." />
          </div>
          <p className="text-3xl font-bold mt-4 text-red-600">-{formatPln(cfExpenses30d)}</p>
          <p className="text-sm mt-1 text-slate-500">Zeszłe faktury i raty kredytowe nadciagające w 30 dni.</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* WYKRES KOŁOWY */}
        <div className="lg:col-span-1 bg-white border text-slate-900 border-slate-200 shadow-sm rounded-2xl p-6">
          <div className="flex items-center mb-6">
            <h2 className="text-lg font-bold">Cash is King (Gdzie są Twoje pieniądze?)</h2>
            <TooltipHelp content="Segmentacja kapitału opartego na wprowadzonych zleceniach. Pomaga wykryć zatory, uświadamiając, jak dużo zysku widnieje jedynie wyimaginowanie na papierze, przez opóźnienia klientów." />
          </div>
          <MoneyPieChart data={pieChartData} />
        </div>

        {/* WYKRES CASH FLOW */}
        <div className="lg:col-span-1 bg-white border text-slate-900 border-slate-200 shadow-sm rounded-2xl p-6">
          <div className="flex items-center mb-6">
            <h2 className="text-lg font-bold">Wizualizacja Cash Flow (Najbliższe 30 dni)</h2>
            <TooltipHelp content="Na zielono zaznaczono bezpieczne przychody pomniejszane natychmiast o czerwony wskaźnik zagrożeń w postaci stałych kosztów. Poniżej znajduje się prognozowany bilans końcowy." />
          </div>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2 font-medium">
                <span className="text-slate-600">Przewidywane Wpływy</span>
                <span className="text-slate-900">{formatPln(cfIncomes30d)}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-4 relative overflow-hidden">
                <div
                  className="bg-green-500 h-4 rounded-full transition-all duration-1000"
                  style={{ width: `${incomePercent}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2 font-medium">
                <span className="text-slate-600">Zobowiązania i Koszty</span>
                <span className="text-slate-900">{formatPln(cfExpenses30d)}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-4 relative overflow-hidden">
                <div
                  className="bg-red-500 h-4 rounded-full transition-all duration-1000"
                  style={{ width: `${expensePercent}%` }}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="font-semibold text-slate-700">Prognozowany Bilans 30D:</span>
              <span className={`text-xl font-bold ${cfIncomes30d - cfExpenses30d >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {cfIncomes30d - cfExpenses30d >= 0 ? '+' : ''}{formatPln(cfIncomes30d - cfExpenses30d)}
              </span>
            </div>
          </div>
        </div>

        {/* ALERTY */}
        <div className="lg:col-span-1 bg-white border text-slate-900 border-slate-200 shadow-sm rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6 text-orange-600">
            <AlertCircle className="w-5 h-5 font-bold" />
            <h2 className="text-lg font-bold">Nadchodzące Zdarzenia (Alerty)</h2>
          </div>

          <div className="space-y-4">
            {sortedAlerts.length === 0 ? (
              <div className="text-sm p-4 text-center bg-slate-50 text-slate-500 rounded-xl">Brak nadchodzących terminów zapłat i rachunków.</div>
            ) : (
              sortedAlerts.map((alert: any, idx) => (
                <div key={idx} className="flex gap-4 p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors bg-slate-50/50">
                  <div className={`p-3 rounded-lg flex items-center justify-center shrink-0 ${alert.isIncome ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="font-semibold text-slate-900 truncate">{alert.title}</p>
                    <p className="text-sm text-slate-500">{alert.contractor} • <span className={alert.isIncome ? 'text-green-600 font-medium' : 'text-slate-700 font-medium'}>
                      {alert.date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}
                    </span>
                    </p>
                  </div>
                  <div className={`flex flex-col justify-center items-end shrink-0 font-bold ${alert.isIncome ? 'text-green-600' : 'text-slate-800'}`}>
                    {alert.isIncome ? '+' : '-'}{formatPln(alert.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
