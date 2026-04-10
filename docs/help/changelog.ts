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
        vector: "Vector 140.2",
        title: "Automatyczna nauka numerów kont bankowych (KSeF & Bank)",
        type: "feature",
        description:
            "System SIG ERP teraz automatycznie zapamiętuje numery kont bankowych wykryte w fakturach KSeF i wyciągach bankowych. " +
            "Konta potwierdzone przez Białą Listę MF otrzymują znaczek ✅, natomiast konta wykryte tylko z faktur – ⚠️. " +
            "Przy dopasowywaniu wyciągów bankowych konta MF-zweryfikowane mają wyższy priorytet (+0.2 confidence score). " +
            "Baza danych kontrahentów jest teraz prawdziwą tablicą wszystkich znanych kont – zarówno w modelu relacyjnym, jak i w szybkim polu tablicowym.",
        relatedHelpIds: ["ksef-bank-account-learning", "bank-verification"]
    },
    {
        date: "2026-04-10",
        vector: "Vector 160",
        title: "Automatyczne rozliczanie płatności gotówkowych i kartowych",
        type: "feature",
        description:
            "Faktury za zakupy 'od ręki' (np. paliwo, zakupy biurowe), gdzie data zakupu jest taka sama jak termin płatności, " +
            "są teraz automatycznie rozpoznawane jako OPŁACONE. System sam przypisuje im odpowiedni status, " +
            "dzięki czemu Twoja Czysta Gotówka jest zawsze aktualna bez ręcznego klikania.",
        relatedHelpIds: ["howto-pos-payment", "invoice-status"]
    },
    {
        date: "2026-04-10",
        vector: "Vector 140",
        title: "Tarcza VAT — Weryfikacja kontrahentów w Ministerstwie Finansów",
        type: "feature",
        description:
            "System automatycznie sprawdza każdego kontrahenta na Białej Liście Ministerstwa Finansów. " +
            "Dzięki temu od razu wiesz, czy firma jest aktywnym płatnikiem VAT i czy możesz bezpiecznie odliczyć podatek. " +
            "Status jest widoczny przy dodawaniu firmy oraz na liście kontrahentów.",
        relatedHelpIds: ["howto-vat-whitelist", "howto-gus-lookup"]
    },
    {
        date: "2026-04-10",
        vector: "Vector 130",
        title: "Magia GUS — Automatyczne pobieranie danych po NIP",
        type: "feature",
        description:
            "Koniec z ręcznym przepisywaniem danych firm. Wystarczy wpisać NIP, a system sam pobierze pełną nazwę, " +
            "adres i numer REGON prosto z państwowego rejestru GUS. Działa błyskawicznie i bezbłędnie.",
        relatedHelpIds: ["howto-gus-lookup"]
    },
    {
        date: "2026-04-09",
        vector: "Vector 131",
        title: "Całkowite usuwanie faktur i powiązanych danych",
        type: "fix",
        description:
            "Udoskonaliliśmy proces usuwania faktur. Od teraz usunięcie dokumentu czyści wszystkie powiązane z nim " +
            "zapisy finansowe i statusy bankowe. Dzięki temu Twoje statystyki są zawsze czyste i wiarygodne.",
        relatedHelpIds: ["invoice-status"]
    },
    {
        date: "2026-04-09",
        vector: "Vector 126",
        title: "Bezpieczny import historii bankowej",
        type: "security",
        description:
            "Wzmocniliśmy bezpieczeństwo importu wyciągów z PKO BP. System automatycznie czyści opisy transakcji " +
            "ze zbędnych znaków i chroni dane przed przypadkową zmianą, zapewniając 100% zgodności z wyciągiem.",
        relatedHelpIds: ["bank-anchor"]
    },
    {
        date: "2026-04-06",
        vector: "Vector 120",
        title: "Centrum Rozliczeń — Ręczna Kontrola Banku",
        type: "feature",
        description:
            "Zmieniliśmy sposób księgowania wyciągów. Zamiast automatycznego dodawania wszystkiego w ciemno, " +
            "teraz każda transakcja trafia do 'poczekalni', gdzie masz nad nią pełną kontrolę przed zatwierdzeniem.",
        relatedHelpIds: ["bank-anchor"]
    },
    {
        date: "2026-04-04",
        vector: "Vector 125",
        title: "Realne podejście do podatku dochodowego (CIT)",
        type: "fix",
        description:
            "Rezerwa na podatek dochodowy (9%) jest teraz odejmowana od Twojej Czystej Gotówki od razu, gdy wypracujesz zysk. " +
            "Wcześniej widziałeś ją tylko jako informację. Teraz Dashboard pokazuje Ci tylko tyle pieniędzy, ile faktycznie masz po 'odłożeniu' na podatek.",
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
