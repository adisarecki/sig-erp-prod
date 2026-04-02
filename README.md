# Sig ERP – Jak żyć z systemem Ekstraklasa Management 🚀

Witaj w **Sig ERP** – Twoim cyfrowym biurze, które pilnuje pieniędzy, terminów i Twojego spokoju. Ten program jest stworzony dla firm budowlanych i usługowych, które chcą mieć pełną kontrolę bez walki z tabelkami.

---

## 🏗️ 1. Twoje Główne Narzędzia (Gdzie oszczędzasz czas?)

### 💰 Inteligentna Bankowość
- **Przeciągnij i Upuść**: Wrzucasz wyciąg CSV z banku, a system automatycznie rozpoznaje Twoich dostawców, dopasowuje przelewy do faktur i **sam oznacza je jako OPŁACONE**.
- **Wykrywanie Firm**: System uczy się numerów kont Twoich kontrahentów – przy kolejnych przelewach już wie, komu płacisz.

### 🏦 Przewodnik po Rozliczeniach Bankowych (Vector 104/105)
System Sig ERP wykorzystuje inteligentny silnik parowania wyciągów PKO BP:
1. **Hierarchia Danych (Master/Reconciler)**: KSeF jest jedynym źródłem faktur księgowych. Wyciąg bankowy służy wyłącznie do **rozliczania** (zmiana statusu na PAID).
2. **Auto-Match (Regex)**: Silnik szuka fraz takich jak `FV`, `FA`, `FAKTURA` w tytule przelewu (Col 8). Jeśli numer się zgadza – faktura jest opłacana automatycznie.
3. **Shadow Costs (Direct Expense)**: Wydatki bezfakturowe (ZUS, US, Żabka, Tax) są automatycznie klasyfikowane jako `DirectExpense` i trafiają bezpośrednio do księgi transakcji.
4. **Tarcza Anty-Dubel**: System blokuje próby ponownego zaksięgowania tej samej faktury (Double-Shield Validation).

### � Dokładne Liczby (bez Defaults)
- **Kaucje**: Sys wykazuje dokładnie to co ustawiłeś - 0%, 5%, 10%, 30%, bez defaultowania.
- **Paliwo Projektu**: Liczmy z precyzją - jeśli 0% kaucji, to paliwo = 100% budżetu (nie 90%).
- **Failsafe Integrity**: Wartości null/undefined są konwertowane na 0 zarówno w Firestore jak i Postgres - zero rozbiezności.

### �📊 Drążenie w Szczegóły Finansowe
- **Kliknięcie = Przejrzystość**: Każda liczba na karcie projektu (Przychody, Koszty, Marża) jest klikalna.
- **Tabela Faktur**: Po kliknięciu zobaczysz wszystkie faktury z datą, numerem, kwotą netto/brutto i dostawcą.
- **Zrozumienie Marż**: Zamiast patrzeć na suche liczby (np. "-11 685,00 zł"), widzisz dokładnie które faktury składają się na tę kwotę – i dlaczego.

### 🤖 Szybkie Skanowanie Faktur (AI)
- **Skanuj & Zapomnij**: Wrzucasz PDF lub zdjęcie faktury – nasza Sztuczna Inteligencja sama odczyta NIP, kwoty i daty.
- **Skanowanie Seryjne**: Masz paczkę faktur? Wrzucasz je wszystkie naraz, a system przetworzy je w tle.

### 🏦 Centrala Weryfikacji Salda (Vector 106)
Nowy standard "Prawdy Finansowej" w Sig ERP:
1. **Absolutna Kotwica (Anchor)**: System nie tylko liczy pieniądze – on je weryfikuje. Fizyczne saldo z Twojego banku (PKO BP) jest nadrzędnym źródłem prawdy.
2. **Weryfikacja Integralności**: Zamiast importu "gdzie popadnie", używasz centralnego modułu **VerifyBalance**. System porównuje stan konta z księgami i wystawia certyfikat zgodności (`VERIFIED_STABLE`) lub ostrzeżenie o rozbieżności.
3. **Automatyka Rozliczeń**:
    - **Auto-Match**: Dopasowanie faktur z KSeF po numerze (Regex).
    - **Shadow Costs**: Automatyczne księgowanie ZUS, podatków i drobnych wydatków (Żabka, Tax) bez potrzeby posiadania faktury.

### 🏗️ Zarządzanie Budowami (Inwestycje)
- **Architektura Płynności (Wektor 101.1)**: System priorytetyzuje **Paliwo (Realny Limit Operacyjny)** – Twoją faktyczną gotówkę netto (90%).
- **Double-Layer Locking System**: Pasek postępu posiada stałą, wizualną barierę dla **Skarbca (Kaucja 🔒)**. Widzisz, ile pieniędzy jest zamrożonych długoterminowo, co chroni Cię przed błędnym planowaniem marży.
- **Interaktywne Tooltipy**: Każda kluczowa metryka posiada podpowiedź wyjaśniającą jej znaczenie dla Twojej płynności (Liquidity-First).

### 🧮 Przejrzysta Hierarchia Kontraktu (Vector 113)
- **Trzy Warstwy Wizualne**: 📋 UMOWA (pełna wartość) → 🔒 KAUCJA (zabezpieczenie) → 💚 DOSTĘPNE (gotówka do operacyjnego wydania)
- **Hover Tooltips**: Każde tooltip pokazuje całą hierarchię - eliminuje dwuznaczność co do tego, ile pieniędzy rzeczywiście masz do dyspozycji
- **Przykład Praktyczny**: "Umowę mam na 330k, 0% kaucji, mogę wydać 330k" (bez mylenia z domyślnym 10%)
- **Modal Przejrzystości**: Kliknięcie na kwotę otwiera tabelę faktur - wiesz dokładnie, co stoi za każdą liczbą

### 🧾 Integracja KSeF (Bramka KSeF Inbox)
- **Bramka (Gatekeeper)**: System nie importuje faktur "w ciemno". Po kliknięciu pobierania, otwiera się **Inbox KSeF**, gdzie przeglądasz wykryte dokumenty.
- **Inteligentne Zakresy (Hardened Date Engine - Vector 114)**: System sam pilnuje limitów MF. Możesz pobierać dane z zakresu do 90 dni, a silnik automatycznie koryguje przesunięcia czasu (letni/zimowy) i strefy czasowe, gwarantując 100% spójności z polskim kalendarzem.
- **Pełna Kontrola**: Sam decydujesz, które faktury mają stać się kosztem firmy. Zaznaczasz wybrane, a system resztę zrobi za Ciebie (pobierze XML, uzupełni dane kontrahenta i przeliczy budżet).
- **Czysta Baza**: Niechciane dokumenty możesz odrzucić jednym kliknięciem, aby nie zaśmiecały Twojego widoku w przyszłości.

### 📱 Mobilne Centrum Dowodzenia (Vector 117)
- **Pełna Responsywność**: System adaptuje się do ekranów telefonów (360px-430px). Sidebar ustępuje miejsca wysuwanemu menu (Drawer), a modale zajmują cały ekran, co ułatwia pracę w terenie.

---

## 🧼 2. Operacja Czysta Kasa (Faza 0)
Plan strategiczny mający na celu przywrócenie pełnej integralności danych przed testami produkcyjnymi:
- **Twardy Reset Finansów**: Usunięcie błędnych faktur, transakcji i duplikatów przy jednoczesnym zachowaniu bazy Inwestorów i Projektów.
- **KSeF First**: Re-import historycznych danych wyłącznie przez oficjalną Bramkę KSeF (Vector 103), co gwarantuje 100% zgodności z MF.
- **Jedno SSoT**: Wyeliminowanie "dryfu" danych między SQL (Prisma) a NoSQL (Firestore).

---

## 💡 Instrukcja "Na Start"

- **Centrala Finansowa**: To Twój najważniejszy punkt kontrolny. Tu wgrywasz wyciągi i sprawdzasz, czy system "widzi" to samo co bank.
- **Konto Bankowe**: Przed pierwszym importem dodaj swój numer konta firmowego w ustawieniach.
- **Potwierdzone Saldo**: Zawsze spójrz na tę liczbę połączoną z Salda Bankowym – ona mówi Ci, ile pieniędzy masz naprawdę do dyspozycji.

---
**Sig ERP – Twoja firma pod pełną kontrolą.**

*Dokumentacja techniczna dla programistów i AI znajduje się w [docs/AI_look.md](./docs/AI_look.md).*
