/**
 * Vector 150: Knowledge Hub — How-To Guides
 *
 * Structured, typed guides for operational flows.
 * Descriptions marked [VISION LAYER] require user input for final text.
 */

import type { HelpEntry } from "./glossary"

export const gettingStartedGuide: HelpEntry = {
    id: "jak_zaczac_prace",
    title: "🚀 Wielki Start: Przewodnik krok po kroku po SIG ERP",
    category: "howto",
    summary: "Kompletny przewodnik po SIG ERP: od dodania firmy, przez projekty i faktury, aż po zrozumienie Czystej Gotówki.",
    description: `
Ten poradnik przeprowadzi Cię przez cały system – od dodania pierwszej firmy, aż po moment, w którym dowiesz się, ile naprawdę masz pieniędzy.

KROK 1: Dodawanie Kontrahentów (Magia GUS)
Zanim wystawisz fakturę, potrzebujesz klienta lub podwykonawcy. 
Wejdź w "Dodaj firmę", wpisz NIP i kliknij lupkę. System sam pobierze nazwę i adres z bazy GUS. Następnie automatycznie sprawdzi w Ministerstwie Finansów (Biała Lista VAT), czy ta firma uczciwie płaci podatki. Jeśli zobaczysz zielony znaczek [VAT: Czynny] – jesteś bezpieczny.

KROK 2: Tworzenie Projektu (Twoja teczka)
Każda złotówka w firmie musi mieć swój cel. Dlatego tworzymy "Projekty" (Inwestycje). To do nich będziesz przypinać wszystkie koszty (np. materiały, koparki) i przychody (faktury dla Inwestora).

KROK 3: Wprowadzanie Faktur i Płatności
- Faktury Kosztowe (Czerwone): Kupiłeś kable? Wpisujesz fakturę. Jeśli data wystawienia to ten sam dzień co termin płatności (np. paliwo na Orlenie), system od razu uzna ją za "OPŁACONĄ" (POS/Gotówka).
- Faktury Przychodowe (Zielone): Wystawiasz fakturę Inwestorowi. Od razu podajesz kwotę Netto, a system sam wylicza VAT.

KROK 4: System Rezerw (Skarbiec i Podatki)
Tutaj dzieje się prawdziwa magia SIG ERP. Ty nic nie musisz liczyć. Gdy wprowadzisz faktury, system w tle automatycznie:
1. Odcina podatek VAT i chowa go do "Salda VAT".
2. Odcina 9% zysku na poczet "Rezerwy CIT".
3. Odcina kaucje (np. 5% lub 10% gwarancji) i zamyka je w "Skarbcu" na określony czas.

KROK 5: Dowodzenie (Dashboard i Czysta Gotówka)
Wracasz na główny ekran (Dashboard). Pamiętaj o złotej zasadzie: SALDO W BANKU TO NIE SĄ TWOJE PIENIĄDZE.
System bierze Twoje saldo bankowe i odejmuje od niego: VAT, CIT, niezapłacone faktury dostawców oraz zamrożone kaucje.
Wynik, który widzisz na samej górze to CZYSTA GOTÓWKA (Safe to Spend). To jedyna kwota, którą możesz bezpiecznie wydać na rozwój firmy lub wypłacić, bez strachu o jutro.
  `.trim(),
    uiTargets: ["dashboard", "help_index"],
    related: ["safe_to_spend", "vault", "vat_balance", "cit_reserve"]
};

export const howtoEntries: HelpEntry[] = [
    gettingStartedGuide,
    // ─────────────────────────────────────────────────────────
    // GUS BIR LOOKUP
    // ─────────────────────────────────────────────────────────
    {
        id: "howto-gus-lookup",
        title: "Jak sprawdzić kontrahenta przez GUS BIR",
        category: "howto",
        summary: "Wpisz NIP w formularzu kontrahenta — dane firmy zostaną pobrane automatycznie z rejestru GUS BIR 1.1.",
        description:
            "KROK 1: Otwórz 'Dodaj kontrahenta' (CRM) lub 'Dodaj Koszt' (Finanse). " +
            "KROK 2: Wpisz 10-cyfrowy NIP. Fetch uruchomi się automatycznie po 10. cyfrze LUB kliknij 🔍. " +
            "KROK 3: System wywołuje GUS BIR 1.1 (SOAP/MTOM). Pobiera: Nazwa, Adres (ul., nr, kod, miasto), REGON. " +
            "KROK 4: Dane auto-wypełniają formularz. Zielony flash = sukces. " +
            "KROK 5: Jednocześnie odpytywany jest Wykaz MF (VAT Shield) — badge VAT pojawia się pod NIPem. " +
            "UWAGA: Jeśli NIP jest nieaktywny w GUS lub błędny — wyświetlany jest komunikat błędu. Dane formularza NIE są czyszczone.",
        technicalSource: "gus",
        dependsOn: [],
        related: ["howto-vat-whitelist"],
        uiTargets: ["CRM → AddContractorModal → Pole NIP", "Finance → ContractorSearch → Pole NIP"],
        vector: "Vector 130"
    },

    // ─────────────────────────────────────────────────────────
    // WHITE LIST VAT INTERPRETATION
    // ─────────────────────────────────────────────────────────
    {
        id: "howto-vat-whitelist",
        title: "Jak interpretować status VAT (Wykaz MF)",
        category: "howto",
        summary: "Po fetchu GUS, system automatycznie sprawdza legalność VAT kontrahenta na Wykazie Ministerstwa Finansów.",
        description:
            "STATUS 🟢 CZYNNY: Kontrahent jest aktywnym podatnikiem VAT. Faktury kosztowe od niego uprawniają do odliczenia VAT-u. " +
            "STATUS 🟡 ZWOLNIONY: Kontrahent jest zwolniony z VAT (np. mały podmiot). Faktury bez VAT-u. " +
            "STATUS 🔴 NIEZAREJESTROWANY: Podmiot nie widnieje w rejestrze VAT. RYZYKO: faktury kosztowe mogą nie uprawniać do odliczenia VAT. " +
            "STATUS ⚪ NIEZNANY: Nie udało się odpytać API MF (błąd sieci lub limit 100 req/dzień). " +
            "WERYFIKACJA KONTA BANKOWEGO: Przed dodaniem IBAN do kontrahenta, kliknij 'Weryfikuj' — system sprawdzi czy konto figuruje w Wykazie MF dla tego NIPu. " +
            "LIMIT API: Wykaz MF zezwala na 100 zapytań 'search' dziennie per IP. Dlatego lista CRM używa przycisku on-demand, a nie auto-fetch przy ładowaniu.",
        technicalSource: "mf-whitelist",
        dependsOn: ["howto-gus-lookup"],
        related: ["vat-debt"],
        uiTargets: ["CRM → AddContractorModal → VAT Badge", "CRM → lista → VatCheckButton"],
        vector: "Vector 140"
    },

    // ─────────────────────────────────────────────────────────
    // PROJECT CLOSURE / HANDOVER
    // ─────────────────────────────────────────────────────────
    {
        id: "howto-project-closure",
        title: "Jak zamknąć projekt (Protokół Przekazania)",
        category: "howto",
        summary: "Zamknięcie projektu 'mrozi' wszelkie dalsze koszty i inicjuje release kaucji do Skarbca.",
        description:
            "KROK 1: W widoku projektu kliknij 'Zamknij Projekt'. Wymagane potwierdzenie. " +
            "KROK 2: System ustawia `project.status = CLOSED` i `project.lifecycleStatus = ARCHIVED`. " +
            "KROK 3: Aktywowane 'Zamrożenie Kosztów' — nowe faktury kosztowe dla zamkniętego projektu są BLOKOWANE. " +
            "KROK 4: Wszystkie rekordy RETENTION_LOCK z tego projektu są agregowane i przenoszone do Skarbca Kaucji (RetentionVault) z datami uwolnienia. " +
            "KROK 5: Projekt znika z aktywnego dashboardu (filtr `lifecycleStatus == ACTIVE`). " +
            "[VISION LAYER] Procedury handover i protokół gwarancyjny definiuje Vision Layer.",
        technicalSource: "ledger",
        dependsOn: ["retention-vault"],
        related: ["retention-long", "retention-short"],
        uiTargets: ["Projects → Project Card → 'Zamknij' button"],
        vector: "Vector 117.3"
    },

    // ─────────────────────────────────────────────────────────
    // IMMEDIATE PAYMENT LOGIC (issueDate == dueDate)
    // ─────────────────────────────────────────────────────────
    {
        id: "howto-pos-payment",
        title: "Logika natychmiastowej płatności (POS/Gotówka)",
        category: "howto",
        summary: "Gdy data wystawienia = termin płatności, system automatycznie traktuje fakturę jako opłaconą (POS/Gotówka).",
        description:
            "REGUŁA WYZWALAJĄCA: issueDate === dueDate → faktura jest oznaczana jako PAID z metodą CARD lub CASH. " +
            "KATEGORIE POS: PALIWO, FLOTA, KOSZT_FIRMOWY, BIURO, KOSZTY_OGOLNE, INNE. " +
            "WPŁYW NA CASHFLOW: Faktura natychmiast redukuje Safe to Spend (SHADOW_COST w Ledgerze). " +
            "NIE ZMIENIA ROZPOZNANIA PRZYCHODU: To reguła płatności operacyjnej, nie zasada rachunkowości. " +
            "ODWRACALNOŚĆ: Użytkownik może kliknąć 'Cofnij (oznacz jako do zapłaty)' — InvoicePaymentToggle wraca do stanu standardowego. " +
            "PRIORYTET BANKOWY: Faktury POS są priorytetowe w dopasowaniu z wyciągiem bankowym (jeśli płacono kartą).",
        technicalSource: "ledger",
        dependsOn: ["invoice-status"],
        related: ["safe-to-spend"],
        uiTargets: [
            "Finance → InvoicePaymentToggle → '✅ OPŁACONE (POS / GOTÓWKA)' state",
            "Finance → RegisterCostModal → Auto-toggle isPaidImmediately"
        ],
        vector: "Vector 160"
    }
]
