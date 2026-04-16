/**
 * Vector 180.9: Knowledge Hub — Concepts (Net-First Philosophy)
 *
 * RULE: Focus on business logic vs technical implementation.
 */

export interface ConceptEntry {
    id: string
    title: string
    summary: string
    description: string
    vector: string
}

export const conceptEntries: ConceptEntry[] = [
    {
        id: "net-first-philosophy",
        title: "Filozofia Net-First (Logika Audytowa)",
        summary: "Podejście do księgowania, w którym kwota Netto jest jedynym twardym punktem odniesienia dla wyniku firmy.",
        description:
            "W systemie SIG ERP wierzymy, że zarządca firmy powinien operować na wartościach netto. " +
            "Brutto to tylko liczba na przelewie, która zawiera w sobie podatek VAT — pieniądze, które tylko 'przepływają' przez Twoje konto.\n\n" +
            "Dlaczego to ważne? Skupiając się na netto, widzisz realny koszt i realny zysk. Dlatego w naszym skanerze kwota Netto jest pogrubiona i wyeksponowana. " +
            "VAT i Brutto są danymi pomocniczymi, służącymi jedynie do weryfikacji zgodności z dokumentem papierowym.",
        vector: "Vector 180.9"
    },
    {
        id: "fiscal-audit-vault",
        title: "Skarbiec Audytowy (Audit Vault)",
        summary: "Izolacja danych historycznych i wątpliwych od bieżących wskaźników operacyjnych.",
        description:
            "Mechanizm pozwalający na przechowywanie dokumentów (np. z ubiegłych lat lub duplikaty) bez wpływu na bieżące KPI (Safe-to-Spend).\n\n" +
            "Jak to działa? Każdy dokument z datą z roku 2025 jest automatycznie kierowany do Skarbca Audytowego. " +
            "Dzięki temu Twój Dashboard 2026 pozostaje czysty, a historia firmy jest bezpiecznie zarchiwizowana i gotowa do wglądu dla księgowości.",
        vector: "Vector 180.9"
    },
    {
        id: "investigation-mode-audit",
        title: "Investigation Mode – Persistent Fiscal Audit (Vector 180.15)",
        summary: "Profesjonalny tryb audytu z trwałymi sesjami, weryfikacją PEWNIAK i generacją raportów podatkowych.",
        description:
            "Investigation Mode to dedykowany system dla audytów retrospektywnych i raportowania podatkowego.\n\n" +
            "**Kluczowe Funkcje:**\n" +
            "- **Sesja Persistent**: RozkSeF lub miesiąc, system nie czyści dokumentów między wrzutami (1-5 plików naraz)\n" +
            "- **Live Summary Bar**: Real-time agregacja VAT (23%) i CIT (9%) z dynamicznym kolorami\n" +
            "- **PEWNIAK System**: Automatyczna weryfikacja faktur z OCR confidence > 95%, znanych dostawców (Orlen, Stefania Machniewska) i pojazdu WE452YS\n" +
            "- **Bulk Approve (ZATWIERDŹ WSZYSTKIE)**: Zatwierdź wszystkie zweryfikowane faktury jednym przyciskiem\n" +
            "- **Zakończ Wczytywanie**: Generuje raport z agregacją miesięczną, podsumowaniem rocznym i logiem rozbieżności\n\n" +
            "**Semantyczne Kolory Zobowiązań:**\n" +
            "- 🟢 NADPLATA / ZWROT (VAT < 0): Emerald Green (#10b981) — Zwrot VAT\n" +
            "- 🔵 TARCZA / STRATA (CIT < 0): Cyan Blue (#06b6d4) — Utrata podatkowa\n" +
            "- 🔴 DO ZAPŁATY (Liability > 0): Rose Red (#f43f5e) — Zobowiązanie\n\n" +
            "**Izolacja Danych (isAudit Flag):**\nWszystkie faktury z sesji audytu trafiają z flagą `isAudit: true`, izolując je od dashbordów operacyjnych, ale pozostawiając je w pełni zapytywalne dla raportów.",
        vector: "Vector 180.15"
    },
    {
        id: "cit-audit-logic",
        title: "CIT Audit Logic – 9% Wyliczenie Podatku CIT",
        summary: "Automatyczne wyliczanie i raportowanie zobowiązań CIT na podstawie kwot netto.",
        description:
            "Podatek CIT (Podatek od Osób Prawnych) w Investigation Mode jest wyliczany automatycznie jako 9% od kwoty netto wszystkich dokumentów w sesji.\n\n" +
            "**Wzór:**\nCIT = Kwota Netto × 0.09\n\n" +
            "**Przykład Praktyczny:**\n" +
            "- Netto: 10,000 PLN\n" +
            "- VAT (23%): 2,300 PLN\n" +
            "- Brutto: 12,300 PLN\n" +
            "- CIT (9%): 900 PLN\n\n" +
            "**State Zobowiązania CIT:**\n" +
            "- Pozytywny CIT (normalnie) → DO ZAPŁATY (Liability, kolor czerwony)\n" +
            "- Negatywny CIT (strata) → TARCZA / STRATA (możliwość przeniesienia straty, kolor niebieski)\n\n" +
            "W Innovation Mode, CIT jest zawsze widoczny na Live Summary Bar z kolorami semantycznymi, umożliwiając szybką ocenę zobowiązania podatkowego.",
        vector: "Vector 180.15"
    },
    {
        id: "audit-isolation-protocol",
        title: "Audit Isolation Protocol – Odseparowanie Audytu od Operacji",
        summary: "Mechanizm utrzymujący czystość dashbordów operacyjnych poprzez izolację danych audytu.",
        description:
            "Audit Isolation Protocol zapewnia, że dokumenty przetworzone w Investigation Mode nie wpływają na bieżące wskaźniki operacyjne (2026), ale pozostają w pełni dostępne dla raportów podatkowych.\n\n" +
            "**Jak to działa:**\n\n" +
            "1. **Flaga isAudit**: Każda faktura z sesji Investigation Mode jest oznaczona `isAudit: true`\n" +
            "2. **Filtrowanie Dashboard**: Dashboard operacyjny (Safe-to-Spend, Current Year KPI) automatycznie pomija faktury z `isAudit: true`\n" +
            "3. **Report Queries**: Gen-y raportów podatkowych jawnie wybierają faktury `isAudit: true`, uzyskując pełny obraz audytu\n" +
            "4. **Rok/Miesiąc Mapping**: Dokumenty są mapowane na podstawie pola `issueDate`, umożliwiając raportowanie per rok/miesiąc\n\n" +
            "**Korzyści:**\n" +
            "- ✅ Możesz skanować historycze dokumenty bez zaburzania bieżących KPI\n" +
            "- ✅ Księgowość ma czyste dane do raportów (brak szumu operacyjnego)\n" +
            "- ✅ Łatwa audytowość — zawsze wiadomo, które dokumenty przetworzone były w trybie audytu\n" +
            "- ✅ Przenosi dokumenty z roku 2025 do Skarbca bez wpływu na Dashboard 2026",
        vector: "Vector 180.15"
    }
]
