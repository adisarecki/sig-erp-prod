/**
 * Vector 150: Knowledge Hub — How-To Guides
 *
 * Structured, typed guides for operational flows.
 * Structured, typed guides for operational flows.
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
            "KROK 2: Wpisz 10-cyfrowy NIP. Pobieranie danych uruchomi się automatycznie po wpisaniu 10 cyfr LUB po kliknięciu lupy 🔍. " +
            "KROK 3: System pobiera oficjalne dane z rejestru państwowego: Nazwę, Adres oraz numer REGON. " +
            "KROK 4: Dane automatycznie wypełniają formularz. " +
            "KROK 5: Jednocześnie sprawdzamy status VAT w Ministerstwie Finansów — informacja pojawi się pod numerem NIP. " +
            "UWAGA: Jeśli NIP jest błędny lub firma nie widnieje w rejestrze, zobaczysz komunikat błędu, ale Twoje wpisane dane nie zostaną skasowane.",
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
            "STATUS 🟢 CZYNNY: Firma jest aktywnym podatnikiem VAT. Możesz bezpiecznie odliczać podatek z ich faktur kosztowych. " +
            "STATUS 🟡 ZWOLNIONY: Firma nie płaci VAT-u (np. ze względu na profil działalności lub obroty). Otrzymasz fakturę bez doliczonego podatku. " +
            "STATUS 🔴 NIEZAREJESTROWANY: Firma nie figuruje w rejestrze VAT. Uwaga: odliczanie podatku z ich faktur może być ryzykowne. " +
            "STATUS ⚪ NIEZNANY: Błąd połączenia z serwerem Ministerstwa Finansów (np. przeciążenie serwerów rządowych). " +
            "WERYFIKACJA KONTA BANKOWEGO: Zanim wykonasz przelew, kliknij 'Weryfikuj' przy numerze konta — system sprawdzi, czy rachunek znajduje się na Białej Liście Ministerstwa Finansów.",
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
            "KROK 1: W widoku projektu kliknij 'Zamknij Projekt'. " +
            "KROK 2: System oznaczy projekt jako archiwalny. " +
            "KROK 3: Aktywujemy blokadę kosztów — od teraz nie przypiszesz już żadnej nowej faktury do tego projektu. " +
            "KROK 4: Zablokowane kaucje z tego projektu zostaną przeniesione do Twojego Skarbca, gdzie będą czekać na termin zwrotu. " +
            "KROK 5: Projekt znika z listy aktywnych, żeby nie rozpraszać Twojej uwagi.",
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
            "Gdy kupujesz coś \"od ręki\" (np. paliwo, zakupy biurowe) i data na fakturze jest taka sama jak termin zapłaty, system automatycznie rozliczy to jako płatność gotówką lub kartą. Nie musisz ręcznie zaznaczać, że faktura jest opłacona – SIG ERP zrobi to za Ciebie, aby Twoja Czysta Gotówka zawsze była aktualna. Jeśli jednak płatność nie doszła do skutku, zawsze możesz ręcznie zmienić status faktury na 'Do zapłaty'.",
        technicalSource: "ledger",
        dependsOn: ["invoice-status"],
        related: ["safe-to-spend"],
        uiTargets: [
            "Finance → InvoicePaymentToggle → '✅ OPŁACONE (POS / GOTÓWKA)' state",
            "Finance → RegisterCostModal → Auto-toggle isPaidImmediately"
        ],
        vector: "Vector 160"
    },

    // ─────────────────────────────────────────────────────────
    // BANK ACCOUNT SAFEGUARD (MF WHITE LIST)
    // ─────────────────────────────────────────────────────────
    {
        id: "howto-bank-safeguard",
        title: "🛡️ Automatyczny import i weryfikacja kont bankowych",
        category: "howto",
        summary: "System automatycznie pobiera konta z MF i pilnuje ich zgodności przy każdym koszcie.",
        description:
            "KROK 1: Przy dodaniu kontrahenta (GUS) system pobiera wszystkie rachunki przypisane do firmy w Ministerstwie Finansów. Jeśli jest jeden – uzupełni go sam. Jeśli więcej – pozwoli Ci wybrać.\n\n" +
            "KROK 2: Przy wpisywaniu faktury kosztowej, system sprawdza numer konta w czasie rzeczywistym. Widzisz to dzięki ikonom tarczy:\n" +
            "- 🟢 **Zweryfikowane**: Konto jest na Białej Liście. Możesz bezpiecznie płacić.\n" +
            "- 🔴 **Brak na liście**: Ryzyko pomyłki lub oszustwa. Sprawdź dokładnie numer konta u dostawcy.\n\n" +
            "KROK 3: Jeśli konto nie figuruje na liście, system wyświetli pulsacyjne ostrzeżenie obok pola numeru konta.",
        technicalSource: "mf-whitelist",
        dependsOn: ["bank-verification"],
        related: ["howto-gus-lookup"],
        uiTargets: ["RegisterCostModal → Bank Account Safeguard Anchor"],
        vector: "Vector 140.1"
    }
]
