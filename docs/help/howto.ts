/**
 * Vector 150: Knowledge Hub — How-To Guides
 *
 * Structured, typed guides for operational flows.
 * Descriptions marked [VISION LAYER] require user input for final text.
 */

import type { HelpEntry } from "./glossary"

export const howtoEntries: HelpEntry[] = [
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
