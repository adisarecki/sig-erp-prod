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
        title: "Czysta Gotówka",
        category: "concept",
        summary: "Kwota, którą faktycznie możesz wydać po odjęciu wszystkich rezerw i zobowiązań.",
        description:
            "[VISION LAYER] Pełna definicja biznesowego znaczenia Czystej Gotówki zostanie dostarczona przez Vision Layer. " +
            "TECHNICZNE: Obliczane jako: Saldo Bankowe (Potwierdzone) − Wartość Skarbca (Kaucje) − Saldo VAT (Zobowiązanie) − Rezerwa CIT − Niezapłacone Faktury (Koszty). " +
            "Źródło: `LedgerService.safeToSpend`. Nie jest wynikiem memoriałowym — wymaga potwierdzonego salda bankowego.",
        technicalSource: "ledger",
        formula: "Saldo Bankowe - Skarbiec - VAT - CIT - Zobowiązania",
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
        title: "Wartość Skarbca (Kaucje)",
        category: "concept",
        summary: "Zamrożone środki z faktury — zabezpieczenie kontraktowe do zwrotu po upływie okresu gwarancyjnego.",
        description:
            "[VISION LAYER] Definicja kontraktowego znaczenia kaucji zostanie dostarczona przez Vision Layer. " +
            "TECHNICZNE: Agreguje rekordy tablicy `Retention` (Prisma) filtrowane po `status: LOCKED`. " +
            "Wartość jest odejmowana z Czystej Gotówki, ale NIE zmniejsza salda bankowego bezpośrednio — to tylko rezerwa logiczna. " +
            "Uwolnienie następuje przez `retentionReleaseDate` lub ręcznie przez protokół zamknięcia projektu.",
        technicalSource: "ledger",
        formula: "SUMA(Kaucje GDZIE status = ZABLOKOWANA)",
        dependsOn: ["safe-to-spend"],
        related: ["retention-short", "retention-long", "project-closure"],
        uiTargets: ["Dashboard → Wartość Skarbca (Kaucje)", "Project List → Retention column"],
        vector: "Vector 117"
    },

    // ─────────────────────────────────────────────────────────
    // SHORT-TERM RETENTION
    // ─────────────────────────────────────────────────────────
    {
        id: "retention-short",
        title: "Kaucja Krótkoterminowa",
        category: "glossary",
        summary: "Część wartości faktury zatrzymana do czasu odbioru robót lub okresu rękojmi.",
        description:
            "[VISION LAYER] Definicja kontraktowa wg umowy z inwestorem zostanie dostarczona przez Vision Layer. " +
            "TECHNICZNE: Procent przechowywany w `project.retentionShortTermRate`. " +
            "Automatycznie naliczana dla kategorii MONTAŻ/USŁUGA/PROJEKT przy zapisie faktury kosztowej.",
        technicalSource: "ledger",
        formula: "Netto (lub Brutto) faktury × Stopa Kaucji Krótkiej",
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
        title: "Kaucja Długoterminowa",
        category: "glossary",
        summary: "Część wartości faktury zatrzymana na cały okres gwarancji (zwykle 2-5 lat).",
        description:
            "[VISION LAYER] Definicja kontraktowa zostanie dostarczona przez Vision Layer. " +
            "TECHNICZNE: Procent przechowywany w `project.retentionLongTermRate`.",
        technicalSource: "ledger",
        formula: "Netto (lub Brutto) faktury × Stopa Kaucji Długiej",
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
        title: "Saldo VAT (Zobowiązanie)",
        category: "concept",
        summary: "Netto pozycja VAT: różnica między VAT z faktur kosztowych a sprzedażowych.",
        description:
            "[VISION LAYER] Znaczenie podatkowe i taktyczne definiuje Vision Layer. " +
            "TECHNICZNE: Wynika z zapisów Ledger o `source: INVOICE_VAT`. " +
            "Formuła: SUMA(VAT z faktur KOSZTOWYCH) − SUMA(VAT z faktur PRZYCHODOWYCH). " +
            "Wynik ujemny = Zobowiązanie VAT (do zapłaty). Wynik dodatni = Nadpłata VAT. " +
            "Odejmowane od Czystej Gotówki jeśli ujemne.",
        technicalSource: "ledger",
        formula: "SUMA(VAT Koszty) − SUMA(VAT Sprzedaż)",
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
        title: "Rezerwa CIT",
        category: "concept",
        summary: "Odłożone 9% od zrealizowanego zysku netto — automatyczna rezerwa na podatek dochodowy.",
        description:
            "[VISION LAYER] Taktyczne znaczenie dla planowania podatkowego definiuje Vision Layer. " +
            "TECHNICZNE: Obliczana jako: Zysk Realny × 0.09. " +
            "Traktowana jako TWARDE ZOBOWIĄZANIE — odejmowana z Czystej Gotówki zawsze, gdy Zysk Realny > 0.",
        technicalSource: "ledger",
        formula: "MAX(0, Zysk Realny) × 0.09",
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
        summary: "Zysk wygenerowany na projektach (Netto).",
        description:
            "[VISION LAYER] Znaczenie strategiczne definiuje Vision Layer. " +
            "TECHNICZNE: Agreguje zapisy Ledger przypisane do projektów (wartości NETTO). " +
            "NIE UWZGLĘDNIA kosztów ogólnych firmy.",
        technicalSource: "ledger",
        formula: "SUMA(Przychody Projektowe Netto) − SUMA(Koszty Projektowe Netto)",
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
        title: "Zysk Realny",
        category: "concept",
        summary: "Ostateczny wynik firmy po odjęciu kosztów ogólnych i Rezerwy CIT.",
        description:
            "[VISION LAYER] Interpretacja zarządcza definiuje Vision Layer. " +
            "TECHNICZNE: Wynik MEMORIAŁOWY — uwzględnia faktury wystawione ale jeszcze nie opłacone. " +
            "Różny od Czystej Gotówki (która jest kasowa / potwierdzona bankowo).",
        technicalSource: "ledger",
        formula: "Zysk Netto (Memoriałowy) − Rezerwa CIT",
        dependsOn: ["project-margin", "cit-reserve"],
        related: ["safe-to-spend", "project-margin"],
        uiTargets: ["Dashboard → Zysk po opodatkowaniu card"],
        vector: "Vector 125"
    },

    // ─────────────────────────────────────────────────────────
    // BANK ANCHOR
    // ─────────────────────────────────────────────────────────
    {
        id: "bank-anchor",
        title: "Saldo Bankowe",
        category: "concept",
        summary: "Ostatnie potwierdzone saldo bankowe z wyciągu PKO BP.",
        description:
            "TECHNICZNE: Przechowywane w `BankBalanceState`. " +
            "Podstawa do wyliczenia Czystej Gotówki.",
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
        title: "Status faktury i płatności",
        category: "concept",
        summary: "Statusy rozliczenia dokumentu i weryfikacji bankowej.",
        description:
            "TECHNICZNE: `invoice.paymentStatus` (UNPAID / PAID) to stan rozliczenia. " +
            "`invoice.reconciliationStatus` (PENDING / MATCHED / GAP) to potwierdzenie bankowe. " +
            "Vector 160: jeśli data wystawienia = data płatności → status POS/GOTÓWKA.",
        technicalSource: "ledger",
        dependsOn: [],
        related: ["safe-to-spend", "bank-anchor"],
        uiTargets: ["Finance → Transaction History → InvoicePaymentToggle"],
        vector: "Vector 160"
    }
]
