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
    }
]
