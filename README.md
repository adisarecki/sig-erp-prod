# Sig ERP – Jak żyć z systemem Ekstraklasa Management 🚀

Witaj w **Sig ERP** – Twoim cyfrowym biurze, które pilnuje pieniędzy, terminów i Twojego spokoju. Ten program jest stworzony dla firm budowlanych i usługowych, które chcą mieć pełną kontrolę bez walki z tabelkami.

---

## 🏗️ 1. Twoje Główne Narzędzia (Gdzie oszczędzasz czas?)

### 💰 Inteligentna Bankowość
- **Przeciągnij i Upuść**: Wrzucasz wyciąg CSV z banku, a system automatycznie rozpoznaje Twoich dostawców, dopasowuje przelewy do faktur i **sam oznacza je jako OPŁACONE**.
- **Wykrywanie Firm**: System uczy się numerów kont Twoich kontrahentów – przy kolejnych przelewach już wie, komu płacisz.

### 🤖 Szybkie Skanowanie Faktur (AI)
- **Skanuj & Zapomnij**: Wrzucasz PDF lub zdjęcie faktury – nasza Sztuczna Inteligencja sama odczyta NIP, kwoty i daty.
- **Skanowanie Seryjne**: Masz paczkę faktur? Wrzucasz je wszystkie naraz, a system przetworzy je w tle.

### 🏗️ Zarządzanie Budowami (Inwestycje)
- **Zdrowie Projektu (Wektor 101)**: Widzisz na żywo realny wpływ gotówki (**Real Inflow 90%**) zamiast "pustych milionów". System automatycznie odejmuje kaucje od budżetów, pokazując Ci faktyczny limit operacyjny.
- **Podwójny Pasek Postępu**: Wizualizacja rozdzielona na gotówkę dostępną (Zielony) oraz kaucję zamrożoną (Szary 🔒).
- **Skarbiec Kaucji**: Pilnujemy pieniędzy zamrożonych u inwestorów. Przypomnimy Ci o nich, zanim termin zwrotu minie.

### 🧾 Integracja KSeF (Bramka KSeF Inbox)
- **Bramka (Gatekeeper)**: System nie importuje faktur "w ciemno". Po kliknięciu pobierania, otwiera się **Inbox KSeF**, gdzie przeglądasz wykryte dokumenty.
- **Pełna Kontrola**: Sam decydujesz, które faktury mają stać się kosztem firmy. Zaznaczasz wybrane, a system resztę zrobi za Ciebie (pobierze XML, uzupełni dane kontrahenta i przeliczy budżet).
- **Czysta Baza**: Niechciane dokumenty możesz odrzucić jednym kliknięciem, aby nie zaśmiecały Twojego widoku w przyszłości.

---

## 🧼 2. Operacja Czysta Kasa (Faza 0)
Plan strategiczny mający na celu przywrócenie pełnej integralności danych przed testami produkcyjnymi:
- **Twardy Reset Finansów**: Usunięcie błędnych faktur, transakcji i duplikatów przy jednoczesnym zachowaniu bazy Inwestorów i Projektów.
- **KSeF First**: Re-import historycznych danych wyłącznie przez oficjalną Bramkę KSeF (Vector 103), co gwarantuje 100% zgodności z MF.
- **Jedno SSoT**: Wyeliminowanie "dryfu" danych między SQL (Prisma) a NoSQL (Firestore).

---

## 💡 Instrukcja "Na Start"

- **Pasek Szybkich Akcji**: To Twoje centrum dowodzenia. Stąd dodasz fakturę, zaimportujesz wyciąg lub sprawdzisz projekt.
- **Konto Bankowe**: Przed pierwszym importem dodaj swój numer konta firmowego w ustawieniach.
- **Safe to Spend**: Zawsze spójrz na tę liczbę na pulpicie – to ona mówi Ci, ile pieniędzy masz naprawdę do dyspozycji.

---
**Sig ERP – Twoja firma pod pełną kontrolą.**

*Dokumentacja techniczna dla programistów i AI znajduje się w [docs/AI_look.md](./docs/AI_look.md).*
