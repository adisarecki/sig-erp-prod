/**
 * Vector 150: Knowledge Hub — Glossary (Source of Truth)
 *
 * RULE: Definitions MUST reflect real system logic (Ledger, Engine, VAT).
 * RULE: Definitions MUST reflect real system logic (Ledger, Engine, VAT).
 */

export interface HelpEntry {
    id: string
    title: string
    category: "glossary" | "howto" | "concept"
    /** Short, contextual description for tooltips (max ~200 chars) */
    summary: string
    /** Full explanation reflecting real system logic. */
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
            "To kwota, którą możesz realnie wydać lub wypłacić z firmy bez strachu o jutro. To Twoja \"twarda\" płynność.\n\n" +
            "Dlaczego to ważne? Saldo w banku to iluzja – są tam pieniądze Urzędu Skarbowego i zamrożone kaucje. SIG ERP odejmuje je od razu, żebyś widział tylko to, co faktycznie należy do Ciebie.",
        technicalSource: "ledger",
        formula: "Gotówka w Banku - Kaucje - VAT - CIT - Niezapłacone Rachunki",
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
            "Miejsce, w którym system \"zamyka\" kaucje gwarancyjne potrącone przez Inwestora.\n\n" +
            "Dlaczego to ważne? Te pieniądze wrócą do Ciebie za 3-5 lat. Do tego czasu system traktuje je jako niedostępne, żebyś nie uwzględniał ich w bieżących wydatkach.",
        technicalSource: "ledger",
        formula: "Suma zablokowanych kaucji",
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
            "Część wartości faktury zatrzymana do czasu odbioru robót lub okresu rękojmi zgodnie z Twoją umową.",
        technicalSource: "ledger",
        formula: "Wartość faktury × Stopa kaucji",
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
            "Część wartości faktury zatrzymana na cały okres gwarancji (zwykle 2-5 lat).",
        technicalSource: "ledger",
        formula: "Wartość faktury × Stopa kaucji długiej",
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
            "To suma podatku VAT, którą musisz oddać do Urzędu Skarbowego.\n\n" +
            "Dlaczego to ważne? System automatycznie rezerwuje te pieniądze przy każdej fakturze. Dzięki temu 25. dzień miesiąca nigdy Cię nie zaskoczy brakiem środków na przelew podatkowy.",
        technicalSource: "ledger",
        formula: "Suma VAT z kosztów − Suma VAT ze sprzedaży",
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
            "Wirtualna „skarbonka”, w której odkładamy 9% od Twojego zysku na podatek dochodowy.\n\n" +
            "Dlaczego to ważne? Zysk netto wygląda dobrze tylko na papierze. My pokazujemy Ci zysk już po \"odcięciu\" doli dla państwa, żebyś widział realny wynik swojej pracy.",
        technicalSource: "ledger",
        formula: "Zysk Realny × 9%",
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
            "Zysk wygenerowany na projektach po odjęciu kosztów wykonawstwa.",
        technicalSource: "ledger",
        formula: "Przychody z projektów − Koszty projektów",
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
            "Ostateczny wynik Twojej firmy po uwzględnieniu wszystkich kosztów i rezerw podatkowych.",
        technicalSource: "ledger",
        formula: "Zysk Netto − Rezerwa CIT",
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
            "Ostatnie potwierdzone saldo pieniędzy na Twoim koncie bankowym.",
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
            "Informacja o tym, czy faktura została już rozliczona i czy płatność została potwierdzona na wyciągu bankowym.\n\n" +
            "Kodowanie Kolorami:\n" +
            "W SIG ERP zielony kolor i znak plus (+) zawsze oznaczają przychód Twojej firmy. Czerwony i minus (-) to Twoje wydatki. Dzięki temu jednym rzutem oka na listę finansów wiesz, czy dany dzień był 'na plusie'.",
        technicalSource: "ledger",
        dependsOn: [],
        related: ["safe-to-spend", "bank-anchor"],
        uiTargets: ["Finance → Transaction History → InvoicePaymentToggle"],
        vector: "Vector 160"
    },

    // ─────────────────────────────────────────────────────────
    // BANK VERIFICATION (WHITE LIST MF)
    // ─────────────────────────────────────────────────────────
    {
        id: "bank-verification",
        title: "Weryfikacja Konta Bankowego (Biała Lista MF)",
        category: "concept",
        summary: "Automatyczna weryfikacja rachunku bankowego kontrahenta w oficjalnym wykazie Ministerstwa Finansów.",
        description:
            "To mechanizm ochronny, który sprawdza, czy numer konta, na który zamierzasz przelać pieniądze, jest oficjalnie zgłoszony i zweryfikowany przez państwo (tzw. Biała Lista).\n\n" +
            "Dlaczego to ważne? Zapłacenie ponad 15 000 PLN na konto spoza listy może wiązać się z brakiem możliwości zaliczenia wydatku do kosztów uzyskania przychodu oraz odpowiedzialnością solidarną za VAT. System sam pilnuje tego za Ciebie.",
        technicalSource: "mf-whitelist",
        related: ["safe-to-spend", "vat-debt"],
        uiTargets: ["AddContractorModal → BankAccount input", "RegisterCostModal → BankAccount field"],
        vector: "Vector 140.1"
    },

    // ─────────────────────────────────────────────────────────
    // KSEF & BANK LEARNED ACCOUNTS (Vector 140.2)
    // ─────────────────────────────────────────────────────────
    {
        id: "ksef-bank-account-learning",
        title: "Automatyczna nauka numerów kont (KSeF & Bank)",
        category: "concept",
        summary: "System automatycznie zapamiętuje numery kont bankowych wykryte w fakturach KSeF i wyciągach bankowych, oznaczając je odpowiednim statusem weryfikacji.",
        description:
            "System SIG ERP jest inteligentny – uczy się nowych numerów kont bezpośrednio z faktur KSeF oraz wyciągów bankowych. " +
            "Jeśli nowy numer nie został jeszcze potwierdzony przez Ministerstwo Finansów, zobaczysz przy nim żółty znak ostrzegawczy (⚠️). " +
            "Daje Ci to pełną kontrolę nad tym, komu przelewasz pieniądze.\n\n" +
            "Jak to działa?\n" +
            "1. Przy każdym imporcie faktury KSeF system wyciąga numer konta bankowego sprzedawcy.\n" +
            "2. Nowe konta są automatycznie zapisywane w bazie danych pod profilem kontrahenta.\n" +
            "3. Konta potwierdzone przez Białą Listę MF → oznaczenie ✅ (ZWERYFIKOWANE, źródło: MF_API).\n" +
            "4. Konta znalezione tylko w KSeF/wyciągu → oznaczenie ⚠️ (NIEZWERYFIKOWANE, źródło: KSEF_LEARNED).\n" +
            "5. Przy dopasowywaniu transakcji bankowych — konta MF-zweryfikowane mają wyższy priorytet (+0.2 confidence) niż konta KSEF-learned.\n\n" +
            "Zawsze możesz ręcznie zweryfikować konto przez wyszukanie NIP-u kontrahenta na Białej Liście.",
        technicalSource: "ksef",
        related: ["bank-verification", "safe-to-spend"],
        uiTargets: [
            "RegisterCostModal → BankAccount dropdown (badge ✅/⚠️)",
            "RegisterIncomeModal → BankAccount dropdown",
            "ContractorProfile → Accounts tab"
        ],
        formula: "isVerified = source === 'MF_API' → ✅ | source === 'KSEF' → ⚠️",
        vector: "Vector 140.2"
    },

    // ─────────────────────────────────────────────────────────
    // VECTOR 170: FLEET MANAGEMENT
    // ─────────────────────────────────────────────────────────
    {
        id: "zarzadzanie-flota",
        title: "Zarządzanie Flotą",
        category: "concept",
        summary: "Monitorowanie pojazdów firmowych, ich statusu oraz kosztów eksploatacji.",
        description:
            "Centralny rejestr pojazdów (samochody, maszyny), który pozwala śledzić ich wydajność i koszty.\n\n" +
            "Dlaczego to ważne? Pojazdy to jeden z największych kosztów pośrednich. System pozwala sprawdzić, ile realnie kosztuje utrzymanie konkretnej jednostki (paliwo, naprawy, ubezpieczenia) w skali 30 dni.",
        technicalSource: "ledger",
        related: ["magazyn-narzedzi", "fleet-cost-allocation"],
        uiTargets: ["Zasoby → Flota i Pojazdy"],
        vector: "Vector 170"
    },

    // ─────────────────────────────────────────────────────────
    // VECTOR 170: TOOL REGISTRY
    // ─────────────────────────────────────────────────────────
    {
        id: "magazyn-narzedzi",
        title: "Magazyn Narzędzi",
        category: "concept",
        summary: "Ewidencja elektronarzędzi i wyposażenia z przypisaniem do pracowników lub projektów.",
        description:
            "Rejestr drobnego sprzętu i narzędzi (wiertarki, niwelatory, laptopy).\n\n" +
            "Dlaczego to ważne? Pozwala na szybką lokalizację sprzętu i przypisanie odpowiedzialności materialnej. Każdy zakup narzędzia może być od razu powiązany z wpisem w rejestrze, co ułatwia inwentaryzację.",
        technicalSource: "ledger",
        related: ["zarzadzanie-flota"],
        uiTargets: ["Zasoby → Zasoby i Narzędzia"],
        vector: "Vector 170"
    },

    // ─────────────────────────────────────────────────────────
    // VECTOR 170: COST ALLOCATION POLICY
    // ─────────────────────────────────────────────────────────
    {
        id: 'fleet-cost-allocation',
        term: 'Alokacja kosztów floty',
        definition: 'Mechanizm przypisywania dokumentów finansowych (faktur i płatności) do konkretnych jednostek floty (pojazdów i maszyn).',
        businessContext: 'W systemie SIG ERP rozróżniamy dwa poziomy alokacji: 1. Koszt Memoriałowy (Faktura) - wpływający na rentowność i wynik, oraz 2. Wypływ Gotówki (Płatność) - wpływający na płynność floty (Cash Flow). Dzięki funkcji "Smart Link", system automatycznie wykrywa powiązane transakcje bankowe przy przypisywaniu faktur do pojazdów, zapobiegając deficytom w raportowaniu przepływów pieniężnych.',
        description:
            "Na obecnym etapie (Stage 1) przypisanie kosztu do pojazdu SŁUŻY WYŁĄCZNIE WIDOCZNOŚCI. \n\n" +
            "Ważne: Połączenie faktury za paliwo z samochodem NIE zmienia automatycznie marży projektu, na którym ten samochód pracuje. Zapobiega to \"fałszywej ekonomii\" przed wdrożeniem pełnego silnika alokacji motogodzin i kilometrówki.",
        technicalSource: "ledger",
        related: ["project-margin", "zarzadzanie-flota"],
        uiTargets: ["Zasoby → Header Info"],
        vector: "Vector 170"
    },

    // ─────────────────────────────────────────────────────────
    // EXPECTED PAYMENTS (RECEIVABLES) - Vector 160.1
    // ─────────────────────────────────────────────────────────
    {
        id: "expected-payments",
        title: "Oczekiwane wpłaty (Należności)",
        category: "concept",
        summary: "Suma wystawionych faktur sprzedażowych, za które jeszcze nie wpłynęły środki (po odjęciu kaucji).",
        description:
            "Całkowita kwota, którą masz otrzymać od swoich kontrahentów za wykonane usługi lub sprzedane towary.\n\n" +
            "Dlaczego to ważne? Pokazuje Twoją przyszłą płynność. SIG ERP odejmuje od tej kwoty kaucje (zamrożone w Skarbcu), żebyś wiedział, ile realnej gotówki faktycznie wpłynie na Twoje konto w najbliższym terminie.",
        technicalSource: "ledger",
        formula: "Suma(Brutto) - Skarbiec (Kaucje)",
        dependsOn: ["retention-vault"],
        related: ["safe-to-spend", "bank-anchor"],
        uiTargets: ["Dashboard → Hero Bar → Oczekiwane wpłaty"],
        vector: "Vector 160.1"
    }
]
