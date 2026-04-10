# Sig ERP – Jak żyć z systemem Ekstraklasa Management 🚀

Witaj w **Sig ERP** – Twoim cyfrowym biurze, które pilnuje pieniędzy, terminów i Twojego spokoju. Ten program jest stworzony dla firm budowlanych i usługowych, które chcą mieć pełną kontrolę bez walki z tabelkami.

---

## 🏆 ZŁOTA ZASADA: KNOWLEDGE-FIRST DEVELOPMENT
**Każda zmiana w kodzie (nowa logika, UI, dane) MUSI zostać odzwierciedlona w Bazie Wiedzy (`/docs/help/`).** Funkcjonalność uznaje się za "Wdrożoną" dopiero po zaktualizowaniu Glosariusza lub Instrukcji dla użytkownika biznesowego.

---

## 🛡️ 0. NOWE: Centra Rekoncyliacji Bankowej (VECTOR 120) 🆕

System rezygnuje z "Cichych Importów". Teraz każda złotówka z wyciągu trafia do bezpiecznej **Strefy Zrzutu (BankStaging)**, gdzie Ty masz ostatnie słowo.

### Główne filary Hub-a:
- **Landing Zone (Triage UI)**: Transakcje nie zmieniają ksiąg automatycznie. Widzisz je w kolejce oczekującej na Twoją decyzję.
- **Auto-Match (High Confidence)**: System sam oblicza kaucje i sugeruje dopasowanie do faktur. Jeśli kwota się zgadza (z uwzględnieniem **Vector 117**), wystarczy kliknąć [Zatwierdź].
- **On-the-fly Create**: Jeśli wydatek nie ma faktury (np. paliwo, przegląd), tworzysz transakcję jednym przyciskiem. System uczy się kategorii na podstawie historii Twoich dostawców.
- **Handover Protocol (VECTOR 117.3)**: Po zakończeniu inwestycji, system automatycznie rozbija zgromadzone kaucje na Krótko- i Długoterminowe i przenosi je do **Globalnego Skarbca**.

---

## 🏗️ 0.5. Scentralizowane Kaucje (VECTOR 117.B) 🔐

Zmieniliśmy filozofię kaucji z budżetowej na **fakturową**. Koniec z "zamrażaniem" wirtualnych pieniędzy, których jeszcze nie zarobiłeś.

### Jak to działa:
- **Kaucja Wyzwalana Fakturą**: System nalicza kaucję dopiero w momencie wystawienia lub opłacenia faktury, a nie na start projektu.
- **Precyzyjny Skarbiec**: W Skarbcu lądują tylko realne kwoty wynikające z wystawionych dokumentów. Po zamknięciu projektu ([Zakończ Inwestycję]), kaucje są transferowane do widoku globalnego z precyzyjnymi datami zwrotu.
- **Monitoring Płynności**: Dashboard rozróżnia teraz **Należności** (+ zielone) i **Zobowiązania** (- czerwone), dając Ci jasny obraz tego, ile pieniędzy do Ciebie płynie, a ile musisz oddać.

### Safe-to-Spend (Twoja Prawdziwa Płynność)
System wylicza "Czystą Gotówkę" (Real Profit) odejmując od salda bankowego:
- 🛡️ Dług VAT
- 💰 Rezerwę CIT/PPE (**Hard Liability**) – nie celebrujemy pieniędzy Urzędu Skarbowego.
- 🔒 Zamrożone kaucje (Skarbiec)
- 🔴 Zobowiązania (nieopłacone faktury kosztowe)

---

## 🏗️ 1. Twoje Główne Narzędzia (Gdzie oszczędzasz czas?)

- [x] **Vector 120: Bank Reconciliation Hub** – Manuany terytorium rozliczeń z landing zone `BankStaging`.
- [x] **Vector 130: GUS BIR 1.1 Integration** – Automatyczne pobieranie danych kontrahentów po NIP.
- [x] **Vector 140.1: Bank Account Safeguard** – Automatyczna weryfikacja kont na Białej Liście MF.
- [ ] **Vector 140: Inteligentne Sugestie AI** – Predykcyjne dopasowanie kategorii kosztów.

### 💰 Inteligentna Bankowość
- **Centrum Weryfikacji (Landing Zone)**: Wrzucasz wyciąg CSV z banku, a transakcje trafiają do poczekalni (Triage). System rozpoznaje dostawców, sugeruje dopasowania do faktur i **uczy się Twoich nawyków**.
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
- **Hardened Mobile Shell**: Pełna adaptacja do telefonów (360px-430px) bez błędów layoutu.
- **Responsive Navigation**: Sidebar na komputerze zamienia się w wysuwaną szufladę (Drawer/Sheet) na telefonie.
- **Smart Data Display**: Finanse i listy projektów zoptymalizowane pod małe ekrany z obsługą przewijania tabel (`TableWrapper`).
- **Native-Like Modals**: Wszystkie formularze (Przychód, Koszt, KSeF) otwierają się jako wygodne "szuflady" dolne na urządzeniach mobilnych.

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
