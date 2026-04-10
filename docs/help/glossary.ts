/**
 * Vector 150: Knowledge Hub — Glossary (Source of Truth)
 *
 * RULE: Definitions MUST reflect real system logic (Ledger, Engine, VAT).
 * Descriptions marked [VISION LAYER] are placeholders — to be filled by user.
 * DO NOT generate autonomous business interpretations for these fields.
 */

export interface HelpEntry {
    id: string
    title: string
    category: "glossary" | "howto" | "concept"
    /** Short, contextual description for tooltips (max ~200 chars) */
    summary: string
    /** Full explanation. Fields marked [VISION LAYER] are user-defined. */
    description: string
    /** Which engine/API is the authoritative data source */
    technicalSource?: "ledger" | "bank" | "gus" | "ksef" | "ui" | "mf-whitelist"
    /** Other Help IDs this entry depends on conceptually */
    dependsOn?: string[]
    /** Sibling concepts for Related section */
    related?: string[]
    /** UI components where this concept is directly visible */
    uiTargets?: string[]
    /** Formula or rule used to compute this value (if applicable) */
    formula?: string
    /** Vector ID where this was implemented */
    vector?: string
}

export const glossaryEntries: HelpEntry[] = [
    // ─────────────────────────────────────────────────────────
    // SAFE TO SPEND
    // ─────────────────────────────────────────────────────────
    {
        id: "safe-to-spend",
        title: "Czysta Gotówka (Safe to Spend)",
        category: "concept",
        summary: "Kwota, którą faktycznie możesz wydać po odjęciu wszystkich rezerw i zobowiązań.",
        description:
            "[VISION LAYER] Pełna definicja biznesowego znaczenia Safe to Spend zostanie dostarczona przez Vision Layer. " +
            "TECHNICZNE: Obliczane jako: Confirmed Bank Balance − Retention Vault − VAT Debt − CIT Reserve − Unpaid Payables. " +
            "Źródło: `LedgerService.safeToSpend`. Nie jest wynikiem memoriałowym — wymaga potwierdzonego salda bankowego.",
        technicalSource: "ledger",
        formula: "Bank Anchor − vaultValue − |vatBalance (jeśli ujemny)| − citReserve − unpaidPayables",
        dependsOn: ["retention-vault", "vat-debt", "cit-reserve"],
        related: ["real-profit", "bank-anchor"],
        uiTargets: ["Dashboard → Hero Bar → Czysta Gotówka", "Dashboard → Bank Card"],
        vector: "Vector 109"
    },

    // ─────────────────────────────────────────────────────────
    // RETENTION VAULT (SKARBIEC KAUCJI)
    // ─────────────────────────────────────────────────────────
    {
        id: "retention-vault",
        title: "Skarbiec Kaucji (Retention Vault)",
        category: "concept",
        summary: "Zamrożone środki z faktury — zabezpieczenie kontraktowe do zwrotu po upływie okresu gwarancyjnego.",
        description:
            "[VISION LAYER] Definicja kontraktowego znaczenia kaucji zostanie dostarczona przez Vision Layer. " +
            "TECHNICZNE: Agreguje rekordy tablicy `Retention` (Prisma) filtrowane po `status: LOCKED`. " +
            "Dzieli się na: SHORT_TERM (kaucja bieżąca, np. 5%) i LONG_TERM (kaucja gwarancyjna, np. 5%). " +
            "Wartość jest odejmowana z Safe to Spend, ale NIE zmniejsza salda bankowego bezpośrednio — to tylko rezerwa logiczna. " +
            "Uwolnienie następuje przez `retentionReleaseDate` lub ręcznie przez protokół zamknięcia projektu.",
        technicalSource: "ledger",
        formula: "SUM(Retention WHERE status = LOCKED)",
        dependsOn: ["safe-to-spend"],
        related: ["retention-short", "retention-long", "project-closure"],
        uiTargets: ["Dashboard → Skarbiec Kaucji (RetentionVault component)", "Project List → Retention column"],
        vector: "Vector 117"
    },

    // ─────────────────────────────────────────────────────────
    // SHORT-TERM RETENTION
    // ─────────────────────────────────────────────────────────
    {
        id: "retention-short",
        title: "Kaucja Krótkoterminowa (Short-Term Retention)",
        category: "glossary",
        summary: "Część wartości faktury zatrzymana do czasu odbioru robót lub okresu rękojmi.",
        description:
            "[VISION LAYER] Definicja kontraktowa wg umowy z inwestorem zostanie dostarczona przez Vision Layer. " +
            "TECHNICZNE: Procent przechowywany w `project.retentionShortTermRate`. " +
            "Podstawa naliczenia (NET lub GROSS) kontrolowana przez `project.retentionBase`. " +
            "Automatycznie naliczana dla kategorii MONTAŻ/USŁUGA/PROJEKT przy zapisie faktury kosztowej.",
        technicalSource: "ledger",
        formula: "invoiceNet (lub Gross) × retentionShortTermRate",
        dependsOn: ["retention-vault"],
        related: ["retention-long"],
        uiTargets: ["RegisterCostModal → Kaucja (SHORT)", "RetentionVault → Kaucja Bieżąca row"],
        vector: "Vector 117"
    },

    // ─────────────────────────────────────────────────────────
    // LONG-TERM RETENTION
    // ─────────────────────────────────────────────────────────
    {
        id: "retention-long",
        title: "Kaucja Długoterminowa (Long-Term Retention)",
        category: "glossary",
        summary: "Część wartości faktury zatrzymana na cały okres gwarancji (zwykle 2-5 lat).",
        description:
            "[VISION LAYER] Definicja kontraktowa zostanie dostarczona przez Vision Layer. " +
            "TECHNICZNE: Procent przechowywany w `project.retentionLongTermRate`. " +
            "Uwalniana po `retentionReleaseDate` lub zamknięciu projektu (Handover Protocol).",
        technicalSource: "ledger",
        formula: "invoiceNet (lub Gross) × retentionLongTermRate",
        dependsOn: ["retention-vault"],
        related: ["retention-short", "project-closure"],
        uiTargets: ["RetentionVault → Kaucja Gwarancyjna row"],
        vector: "Vector 117"
    },

    // ─────────────────────────────────────────────────────────
    // VAT DEBT
    // ─────────────────────────────────────────────────────────
    {
        id: "vat-debt",
        title: "Dług VAT / Nadpłata VAT",
        category: "concept",
        summary: "Netto pozycja VAT: różnica między VAT z faktur kosztowych (odliczalny) a VAT z faktur sprzedażowych (należny).",
        description:
            "[VISION LAYER] Znaczenie podatkowe i taktyczne definiuje Vision Layer. " +
            "TECHNICZNE: Wynika z `LedgerEntry` records o `source: INVOICE_VAT`. " +
            "Formuła: SUM(VAT z faktur EXPENSE) − SUM(VAT z faktur INCOME). " +
            "Wynik dodatni = nadpłata VAT (zwrot z US). Wynik ujemny = dług VAT (do zapłaty do US). " +
            "WAŻNE: Nie jest gotówką — to zobowiązanie podatkowe. Odejmowane od Safe to Spend jeśli ujemny.",
        technicalSource: "ledger",
        formula: "SUM(LedgerEntry WHERE source=INVOICE_VAT AND type=EXPENSE) − SUM(LedgerEntry WHERE source=INVOICE_VAT AND type=INCOME)",
        dependsOn: ["safe-to-spend"],
        related: ["cit-reserve", "real-profit"],
        uiTargets: ["Dashboard → Hero Bar → Dług VAT / Nadpłata VAT"],
        vector: "Vector 099"
    },

    // ─────────────────────────────────────────────────────────
    // CIT RESERVE
    // ─────────────────────────────────────────────────────────
    {
        id: "cit-reserve",
        title: "Rezerwa CIT/PPE (9%)",
        category: "concept",
        summary: "Odłożone 9% od zrealizowanego zysku netto — automatyczna rezerwa na podatek dochodowy.",
        description:
            "[VISION LAYER] Taktyczne znaczenie dla planowania podatkowego definiuje Vision Layer. " +
            "TECHNICZNE: CIT_RATE = 0.09 (Mały Podatnik). Obliczana jako: realProfit × 0.09. " +
            "Traktowana jako HARD LIABILITY — odejmowana z Safe to Spend zawsze, gdy realProfit > 0. " +
            "Źródło konfiguracji: `src/lib/config/tax.ts → CIT_RATE`.",
        technicalSource: "ledger",
        formula: "MAX(0, realProfit) × CIT_RATE (0.09)",
        dependsOn: ["real-profit", "safe-to-spend"],
        related: ["vat-debt"],
        uiTargets: ["Dashboard → Hero Bar → Rezerwa CIT", "Dashboard → Metrics grid"],
        vector: "Vector 125"
    },

    // ─────────────────────────────────────────────────────────
    // PROJECT MARGIN (NET)
    // ─────────────────────────────────────────────────────────
    {
        id: "project-margin",
        title: "Marża Projektowa (Netto)",
        category: "concept",
        summary: "Zysk wygenerowany na projektach — suma przychodów projektowych minus koszty projektowe (wartości netto).",
        description:
            "[VISION LAYER] Znaczenie strategiczne i progi rentowności definiuje Vision Layer. " +
            "TECHNICZNE: Agreguje `LedgerEntry WHERE projectId IS NOT NULL`. " +
            "Obliczana wyłącznie na wartościach NETTO (bez VAT). " +
            "NIE UWZGLĘDNIA kosztów ogólnych firmy (PALIWO, BIURO etc.). " +
            "Jest bazą wejściową do Real Profit po odjęciu kosztów ogólnych i CIT.",
        technicalSource: "ledger",
        formula: "SUM(LedgerEntry WHERE projectId NOT NULL AND type=INCOME) + SUM(LedgerEntry WHERE projectId NOT NULL AND type=EXPENSE)",
        dependsOn: [],
        related: ["real-profit", "general-costs"],
        uiTargets: ["Dashboard → Strategic Metrics → Marża Projektowa (Netto)"],
        vector: "Vector 099"
    },

    // ─────────────────────────────────────────────────────────
    // REAL PROFIT
    // ─────────────────────────────────────────────────────────
    {
        id: "real-profit",
        title: "Zysk Realny (Real Profit)",
        category: "concept",
        summary: "Ostateczny wynik firmy: Marża projektowa − Koszty ogólne − Rezerwa CIT.",
        description:
            "[VISION LAYER] Interpretacja zarządcza i znaczenie dla dywidend definiuje Vision Layer. " +
            "TECHNICZNE: Obliczany przez `LedgerService.realProfit`. " +
            "Formuła: fuelAccrualNet − (CIT_RATE × MAX(0, fuelAccrualNet)). " +
            "To wynik MEMORIAŁOWY — uwzględnia faktury wystawione ale jeszcze nie opłacone. " +
            "Jest różny od Safe to Spend (który jest kasowy). " +
            "Źródło: `src/lib/finance/ledger-service.ts`.",
        technicalSource: "ledger",
        formula: "fuelAccrualNet − (CIT_RATE × MAX(0, fuelAccrualNet))",
        dependsOn: ["project-margin", "cit-reserve"],
        related: ["safe-to-spend", "project-margin"],
        uiTargets: ["Dashboard → Zysk po opodatkowaniu (Real Profit) card"],
        vector: "Vector 125"
    },

    // ─────────────────────────────────────────────────────────
    // BANK ANCHOR
    // ─────────────────────────────────────────────────────────
    {
        id: "bank-anchor",
        title: "Kotwica Salda Bankowego (Bank Anchor)",
        category: "concept",
        summary: "Ostatnie potwierdzone saldo bankowe z wyciągu PKO BP — absolutna podstawa płynności.",
        description:
            "[VISION LAYER] znaczenie jako punkt odniesienia definiuje Vision Layer. " +
            "TECHNICZNE: Przechowywane w `BankBalanceState` (Prisma). " +
            "Ustawiane podczas importu wyciągu bankowego CSV/MT940. " +
            "Porównywane z `LedgerService.realCashBalance` celem wykrycia rozbieżności (DISCREPANCY_ALERT). " +
            "NIE jest aktualizowane automatycznie — wymaga nowego importu wyciągu.",
        technicalSource: "bank",
        dependsOn: [],
        related: ["safe-to-spend"],
        uiTargets: ["Dashboard → Hero → Potwierdzone Saldo Bankowe (PKO BP)"],
        vector: "Vector 106"
    },

    // ─────────────────────────────────────────────────────────
    // INVOICE STATUS
    // ─────────────────────────────────────────────────────────
    {
        id: "invoice-status",
        title: "Status faktury i logika płatności",
        category: "concept",
        summary:
            "Faktura może być: ACTIVE (otwarta), PAID (opłacona), XML_MISSING (z KSeF bez XML). Płatność może być: UNPAID, PAID, POS (auto).",
        description:
            "TECHNICZNE: `invoice.status` (ACTIVE / PAID / XML_MISSING) to stan dokumentu. " +
            "`invoice.paymentStatus` (UNPAID / PAID) to stan rozliczenia. " +
            "`invoice.reconciliationStatus` (PENDING / MATCHED / GAP) to potwierdzenie bankowe. " +
            "BANK_TRANSFER + MATCHED = najwyższy autorytet (blokada edycji). " +
            "CARD / CASH = płatność manualna, oczekuje na wyciąg. " +
            "Vector 160: jeśli issueDate === dueDate → status POS/GOTÓWKA (zielony baner, nie czerwony).",
        technicalSource: "ledger",
        dependsOn: [],
        related: ["safe-to-spend", "bank-anchor"],
        uiTargets: ["Finance → Transaction History → InvoicePaymentToggle", "Finance page → statusBadge column"],
        vector: "Vector 160"
    }
]
