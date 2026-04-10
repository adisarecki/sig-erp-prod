/**
 * Vector 150: Knowledge Hub — Structured Changelog
 *
 * RULE: NO runtime markdown parsing. Sorted DESC by date at import.
 * Render: first 5 entries on /help homepage.
 */

export interface ChangelogEntry {
    date: string              // ISO date string YYYY-MM-DD
    vector: string            // e.g. "Vector 160"
    title: string
    type: "feature" | "fix" | "security" | "breaking"
    description: string
    relatedHelpIds?: string[] // Links to help/[id] for related concepts
}

export const changelogEntries: ChangelogEntry[] = [
    {
        date: "2026-04-10",
        vector: "Vector 160",
        title: "Smart Auto-Pay dla faktur POS/Gotówka",
        type: "feature",
        description:
            "Faktury, dla których data wystawienia równa się terminowi płatności (np. Orlen, sklep) są automatycznie " +
            "oznaczane jako OPŁACONE (POS/GOTÓWKA) z zielonym banerem zamiast czerwonego 'DO ZAPŁATY'. " +
            "Kategorie PALIWO i FLOTA domyślnie ustawiają metodę płatności CASH. Dodano przycisk 'Cofnij' dla wyjątkowych przypadków.",
        relatedHelpIds: ["howto-pos-payment", "invoice-status"]
    },
    {
        date: "2026-04-10",
        vector: "Vector 140",
        title: "VAT Shield — Wykaz Podatników MF",
        type: "feature",
        description:
            "Integracja z publicznym API Ministerstwa Finansów (bez klucza API). " +
            "Po fetchu GUS, system automatycznie sprawdza status VAT kontrahenta i zwraca listę zarejestrowanych rachunków bankowych. " +
            "Badge 🟢/🟡/🔴/⚪ widoczny przy dodawaniu kontrahenta i na liście CRM (on-demand, limit 100 req/dzień).",
        relatedHelpIds: ["howto-vat-whitelist", "howto-gus-lookup"]
    },
    {
        date: "2026-04-10",
        vector: "Vector 130",
        title: "GUS BIR 1.1 — Automatyczny onboarding kontrahentów",
        type: "feature",
        description:
            "Wdrożono klienta SOAP/MTOM dla GUS BIR 1.1. NIP → automatyczne pobranie nazwy, adresu i REGON. " +
            "Dual-trigger: auto-fetch po 10. cyfrze NIPu + ręczny przycisk 🔍. " +
            "Parser regex-first odporny na błędy MTOM w środowisku serverless.",
        relatedHelpIds: ["howto-gus-lookup"]
    },
    {
        date: "2026-04-09",
        vector: "Vector 131",
        title: "Full Cascade Deletion — Zero Zombie Data",
        type: "fix",
        description:
            "Usunięcie faktury teraz kaskadowo czyści: zapisy Ledger, statusy transakcji bankowych (revert → UNPAIRED), " +
            "InvoicePayment links oraz powiązane transakcje. Eliminuje 'zombie data' powodujące błędne metryki finansowe.",
        relatedHelpIds: ["invoice-status"]
    },
    {
        date: "2026-04-09",
        vector: "Vector 126",
        title: "Bank Staging Hardening — Immutable Import Records",
        type: "security",
        description:
            "Rekordy BankStaging są teraz niemodyfikowalne po imporcie. Dodano normalizację tytułu transakcji PKO BP " +
            "(usuwanie szumów textowych: 'Rachunek', 'Nazwa'). Hub weryfikacji obsługuje dopasowanie z-retencją.",
        relatedHelpIds: ["bank-anchor"]
    },
    {
        date: "2026-04-06",
        vector: "Vector 120",
        title: "Reconciliation Hub — Ręczna Weryfikacja Bankowa",
        type: "feature",
        description:
            "Przejście z 'Silent Import' (automatyczne wstrzyknięcie do Ledger) na 'Triage Hub' " +
            "(staging → ludzka weryfikacja → akceptacja). BankStaging jako bufor bezpieczeństwa. " +
            "Real-time revalidacja salda po zatwierdzeniu.",
        relatedHelpIds: ["bank-anchor"]
    },
    {
        date: "2026-04-04",
        vector: "Vector 125",
        title: "CIT jako Hard Liability",
        type: "fix",
        description:
            "Rezerwa CIT (9%) jest teraz hard-subtracted z Safe to Spend zawsze gdy realProfit > 0. " +
            "Wcześniej była wyświetlana informacyjnie. Zmiana odzwierciedla rzeczywiste zobowiązanie podatkowe.",
        relatedHelpIds: ["cit-reserve", "safe-to-spend"]
    }
]

/**
 * Returns changelog entries sorted DESC by date, limited to `limit`.
 */
export function getRecentChangelog(limit = 5): ChangelogEntry[] {
    return [...changelogEntries]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, limit)
}
