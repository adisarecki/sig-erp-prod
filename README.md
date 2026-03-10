# Firmowy System Finansowo-Zarządczy (v. 0.2)

## 1. Wizja i Cel Projektu
Stworzenie w pełni skalowalnego, autorskiego systemu do zarządzania finansami, płynnością i relacjami biznesowymi. System ma stanowić "tarczę ochronną" dla płynności finansowej oraz centralną bazę wiedzy o kontrahentach.

## 2. Architektura i Wymagania Techniczne
**Infrastruktura:** Lekka, skalowalna i optymalna kosztowo na start.
- **Architektura początkowa:** Serverless (np. deployment na platformie Vercel). Eliminuje to koszty stałych serwerów; płacimy tylko za rzeczywiste użycie (ułamki centów). Pozwala to na "bezbolesne skalowanie" - od zera po tysiące zapytań bez naszej interwencji.
- **Baza danych:** Serverless PostgreSQL (np. Supabase lub Neon). Relacyjna struktura i transakcyjność (ACID) to absolutny wymóg dla aplikacji finansowych (zero tolerancji na zgubione transakcje).
- **Backend/API:** Node.js / TypeScript (wykorzystanie Next.js API Routes / Server Actions dla zwięzłości repozytorium). ORM: Drizzle lub Prisma do zapewnienia pełnego bezpieczeństwa typów.

**Bezpieczeństwo:** Rygorystyczne szyfrowanie danych wrażliwych i szczegółowe zarządzanie uprawnieniami.
- Wbudowana autoryzacja z obsługą Role-Based Access Control (RBAC). 
- Row Level Security (RLS) realizowane po stronie bazy PostgreSQL, wymuszające dostęp wyłącznie do danych przypisanych do danej dzierżawy (tenant) lub użytkownika.
- Szyfrowanie At-Rest i In-Transit (TLS 1.3). Zgodność z OWASP.

**Stos technologiczny:** Stabilny, powszechnie wspierany framework minimalizujący dług technologiczny.
- **Frontend:** Next.js (React) + TypeScript. Obecnie rynkowy standard.
- **Styling:** Tailwind CSS + shadcn/ui. Minimalizuje czas budowy interfejsów przy zachowaniu najwyższej jakości UX.
- **Komunikacja email:** Resend lub SendGrid z dedykowanymi IP dla najwyższej dostarczalności.
- **Open Banking API:** GoCardless (Nordigen), Plaid lub Tink jako agregator kont bankowych wspierający polskie banki i dyrektywę PSD2.

## 3. Moduły Krytyczne (Faza 1 - MVP)
**Silnik Cash Flow i Zobowiązań:**
- Rejestrowanie wpływów i wydatków.
- Harmonogramy spłat (kredyty/leasingi) blokujące środki w prognozach.
- Alerty o zbliżających się terminach wymagalności (ochrona płynności).
*Wyzwania techniczne:*
- **Transakcyjność:** Ścisła konsystencja ułamków i precyzja matematyczna (użycie typu `DECIMAL`/`NUMERIC` w Postgres, nigdy `FLOAT`).
- **Czas i strefy czasowe:** Precyzyjne modelowanie dat zapadalności, zamrożenia środków i unikanie błędów przesunięć czasowych w logice silnika.

**Fakturowanie i Rozrachunki:**
- Zgodność z polskimi standardami (KSeF, Split Payment).

**Integracja Bankowa:**
- Automatyczne pobieranie wyciągów (Open Banking) i parowanie płatności.
*Wyzwania techniczne:*
- **Idempotentność webhooków:** Agregatorzy bankowi mogą wysyłać to samo zdarzenie wielokrotnie. API musi rozpoznawać i ignorować duplikaty, aby nie zaksięgować płatności podwójnie.
- **Normalizacja i heurystyka parowania:** Różne banki dostarczają opisy przelewów w różnych formatach. Do automatycznego parowania faktur z wpłatą potrzebny będzie sprytny algorytm wyszukiwania (fuzzy search na numerach faktur/NIP) ewentualnie wsparty w przyszłości przez AI.
- **Utrzymywanie sesji:** Zgody PSD2 (tokeny) wygasają co 90-180 dni. System musi proaktywnie przypominać użytkownikowi o reautoryzacji konta.

## 4. Moduł Relacji z Kontrahentami (CRM i Komunikacja)
**Centralna Baza Kontrahentów:**
- Pełna historia współpracy, przypisane faktury, warunki handlowe i ocena wiarygodności płatniczej.

**Zarządzanie Mailingiem:**
- Tworzenie i segmentacja list mailingowych.
- Zautomatyzowane kampanie mailowe (np. przypomnienia o płatnościach, wezwania do zapłaty).
- Masowa wysyłka ofert i komunikacji marketingowej do wybranych grup klientów.
*Wyzwania techniczne:*
- **Izolacja reputacyjna (Deliverability):** Krytycznym błędem jest wysyłanie masowego marketingu i "twardych" wezwań do zapłaty przez ten sam kanał/subdomenę. Należy rozdzielić dostawców lub subdomeny na ruch *transakcyjny* (pewna dostarczalność) oraz *marketingowy*.
- **Asynchroniczność i kolejkowanie:** Wysyłka pętli 5000 wezwań do zapłaty "zabije" typowy endpoint Serverless przez timeout. Niezbędny jest system kolejkujący (np. wstępnie QStash / Redis, później AWS SQS) i worker pracujący w tle.
- **Higiena bazy (Bounce handling):** Odbieranie webhooków od operatora maili, by odznaczać z bazy CRM błędne adresy e-mail (Hard Bounce) i chronić sprawność wysyłek.

## 5. Status Projektu
Obecnie system znajduje się w Fazie Pierwszej - ukończono inicjalizację architektury pod fundamenty ERP oraz zbudowanie pierwszych szkieletów wizualnych:

- **Środowisko Bazy Danych:** Skonfigurowane z wykorzystaniem zewnętrznej, rozproszonej bazy danych PostgreSQL (Neon.tech). Baza jest produkcyjnie i developersko połączona z Prisma ORM z zastosowaniem uszczelnionej strategii Multi-Tenancy i logami z modułu AuditTrail.
- **Wdrożenie Pulpitu Menedżerskiego:** Główne repozytorium (Dashboard) generuje dane z agregatu Marż, nadchodzących przychodów CashFlow oraz podpowiada terminowość top-3 alertów faktur kosztowych i leasingowych w firmie. System wylicza zyski używając dokładności natywnej Postgresa (`DECIMAL`).
- **Modele i Zarządzanie Użytkownikami:** Architektura gotowa (Role, Tenants, Kontrahenci).
- **Projekty Inżynieryjne (`/projects`):** Gotowy widok na żywo zestawiający projekty, ich przypisane wydatki, budżety oraz kalkulujący na żywo "Obecną Marżę Zysku".
- **Seedowanie:** Baza jest wypełniana realistycznymi danymi testowymi odwzorowującymi rzeczywiste firmy (jak Budimex). Wdrożono częściowe płatności faktur.
- **Wbudowana Warstwa Edukacyjna (Help Layer):** Nowy moduł Globalnych Podpowiedzi (UX Tooltips) został wdrożony jako centralna część GUI. Żaden techniczny lub księgowy wskaźnik ("zaksięgowany przychód", status "IN_REVIEW") nie pozostawiony jest domysłom - na każdym module obecne są interaktywne znaczki weryfikujące wiedzę z pomocą języka korzyści.

## 6. Model Danych (Struktura Bazy)
System oparty jest o zaawansowaną relacyjną bazę PostgreSQL z rygorystyczną izolacją danych (Multi-tenancy).

### Architektura Dzierżawy (Multi-tenancy)
- **Tenants (Dzierżawy):** Główna tabela firmy. Każdy rekord (np. `Contractors`, `Projects`, `Invoices`) ma klucz obcy `tenantId`, zapewniający, że jedna firma nie widzi danych innej firmy.
- **AuditLogs (Dziennik Zdarzeń):** Pełen zapis zmian (`action`, `entity`, `details`). Jest to nasz bezpiecznik i gwarancja szczelności. Każda akcja w systemie jest przypisywana do użytkownika i dzierżawy.

### Zarządzanie Użytkownikami i Dostępem (RBAC)
- **Users:** `id`, `tenantId`, `email`, `role_id` (FK).
- **Roles:** Autoryzacja i zbiór pozwoleń (np. OWNER, MANAGER).

### CRM, Kontrahenci i Obiekty Inżynieryjne
- **Contractors (Kontrahenci):** Baza firm współpracujących (GW, Deweloperzy) w ramach jednego `tenantId`.
- **Objects (Obiekty / Lokalizacje):** Reprezentuje fizyczne miejsce inwestycji, powiązane z `Contractors`.

### Projekty (Serce Systemu)
- **Projects (Projekty):** Skupia wykonawstwo, finanse i lokalizację. Relacje: `contractorId`, `objectId`. Kolumny dla cash flow: `budgetEstimated` (DECIMAL), `budgetUsed`.

### Finanse (Transakcje, Faktury, Płatności Częściowe)
- **Invoices (Faktury):** Dokumenty księgowe przypisane do `Project`. Posiadają nowe statusy: `UNPAID`, `PARTIALLY_PAID`, `PAID` oraz pole `scanUrl` dla systemów skanowania (OCR).
- **Payments (Płatności - powiązanie krzyżowe):** Tabela służąca obsłudze płatności ratunkowych / zaliczkowych. Tworzy powiązanie "Wiele do Jednego" pomiędzy Fakturą a faktycznym wpływem kwoty bazowej. Umożliwia obsłużenie scenariusza: Faktura na 100 tys. -> dwie transakcje bankowe po 50 tys.
- **Transactions (Cash Flow):** Rzeczywiste obciążenia i przychody. Ścisła kontrola przez typ `DECIMAL`. Posiada linki OCR (`scanUrl`).

### Moduł Bankowy
- **BankAccounts (Konta Bankowe):** Baza przypisanych rachunków firmowych na rzecz dzierżawy (IBAN, waluta, integracja PSD2 / ID dostawcy).
- **BankTransactionRaw (Surowe Transakcje z API):** Tabela buforowa, trzymająca zrzut operacji bankowych przypisanych do odpowiedniego konta, gotowych aby sparować je z `Transactions`.

## 7. Środowisko (Chmura)
Aby uruchomić projekt na swoim komputerze, podpięliśmy produkcyjną bazę danych PostgreSQL w chmurze (np. Neon, Supabase). Nie ma już potrzeby lokalnej instalacji Dockera.

1. **Zainstaluj zależności** w głównym katalogu projektu:
   ```bash
   npm install
   ```

2. **Skonfiguruj zmienne środowiskowe:**
   Upewnij się, że w głównym katalogu znajduje się plik `.env` bazujący nawiązujący do naszej darmowej bazy cloudowej. Plik powinien wyglądać tak:
   ```env
   DATABASE_URL="postgresql://<URL_CHMURY>"
   NEXTAUTH_SECRET="twoj-sekretny-klucz-dla-sesji"
   NEXTAUTH_URL="http://localhost:3000"
   ```

3. **Wygeneruj model i pobierz aktualny stan z chmury:**
   Architektura bazuje na chmurowym modelu Prisma. Aktualizuj lokalne środowisko twardymi komendami:
   ```bash
   npx prisma db pull
   npx prisma generate
   ```
   *Uwaga dotycząca seedowania (Danych Testowych):* Model danych obsługuje wstrzykiwanie bezpiecznych i odizolowanych firm testowych. W każdej chwili możesz wlać do pracującego środowiska Cloud nową pulę transakcji i faktur używając `npm run prisma db seed`.

5. **Uruchom serwer deweloperski:**
   ```bash
   npm run dev
   ```

6. **Śledzenie wizualne:**
   Wejdź pod adres [http://localhost:3000](http://localhost:3000) w przeglądarce, by zobaczyć, jak aplikacja przetwarza swoje ścieżki (Dashboard, CRM, Finanse, Projekty). Zobaczysz w akcji wygenerowane wyliczenia z danych testowych!

## 8. Wsparcie dla OCR i Dane Testowe (Seed)
**Gotowość na Systemy OCR:**
Model danych został rozszerzony o pole `scanUrl` w tabelach `Invoices` oraz `Transactions`. Umożliwia to zrzucanie plików faktur i paragonów do zewnętrznego magazynu (np. AWS S3 / Supabase Storage) i linkowanie skanów bezpośrednio do wydatków w systemie.

**Jak zasilić bazę danymi testowymi?**
Aby zobaczyć system w akcji z rzeczywistymi danymi wygenerowanymi dla branży inżynieryjnej (Kontrahenci tacy jak Budimex S.A., Obiekty logistyczne, biegnące projekty elektryczne oraz wyliczenia rynkowej marży):

1. Upewnij się, że Twój `DATABASE_URL` w pliku `.env` wskazuje na poprawną, działającą bazę PostgreSQL.
2. Zbuduj schemat bazy (jeżeli jeszcze tego nie zrobiłeś):
   ```bash
   npx prisma db push
   ```
3. Uruchom skrypt seedujący:
   ```bash
   npm run prisma db seed
   ```
4. Po udanym seedowaniu, przejdź na adres `http://localhost:3000/projects`, aby zobaczyć wykalkulowane w locie zyski oraz koszty wdrożeń dla sztucznych projektów.

### 10. Przygotowanie do startu produkcyjnego (Czyszczenie)
System posiada wbudowany mechanizm bezpiecznego usuwania danych testowych, aby umożliwić "czysty start" z rzeczywistymi danymi:
1. Przejdź do zakładki **Ustawienia** w menu bocznym.
2. W sekcji **Strefa Deweloperska** użyj przycisku **"Usuń wszystkie dane operacyjne"**.
3. System usunie wszystkie Projekty, Kontrahentów, Faktury i Transakcje powiązane z Twoim kontem, pozostawiając samą strukturę i użytkowników.
4. Możesz teraz zacząć wprowadzać własne dane za pomocą przycisków "Dodaj Kontrahenta" w CRM oraz "Nowy Projekt" w sekcji Projekty.

## 9. Analityka Finansowa Enterprise (Business Intelligence)
Począwszy od Sprintu 6 system zyskał pełnoprawną warstwę analityczną, opartą na strategiach finansowych największych graczy:

- **Zasada "Profit First" (Wskaźnik Bezpiecznej Wypłaty):** Na żywo wylicza dostępną gotówkę chroniąc prywatne pieniądze zarządu. Algorytm odcina od aktualnej płynnej gotówki wszystkie Nadchodzące Zobowiązania (w perspektywie 30 dni) oraz bezpieczną Rezerwę Podatkową (domyślnie 19%).
- **Moduł "Cash is King" (Gdzie są pieniądze?):** Wykorzystuje interaktywny Wykres Kołowy (`recharts`), pokazując błyskawiczny rzut oka na podział kapitału: Należności zablokowane w fakturach, Skumulowane Koszty Poniesione oraz Czysty Zysk Zrealizowany.
- **Zdrowie Projektu - Zarządzanie przez wyjątki (Werdykt dla Laika):** Zgodnie z **Zasadą Globalnej Empatii**, analityka nie tylko pokazuje dane, ale interpretuje je dla użytkownika. W oknie modalnym wyświetlany jest jasny werdykt tekstowy (🟢 Bezpieczny / 🔴 Zagrożenie) wraz z informacją o % wykorzystania budżetu i pozostałej kwocie. Wykres Burn-down zyskał ludzkie opisy w legendzie (np. "Nasz zaplanowany budżet") oraz pełnozdaniowe tooltipy, co eliminuje barierę wejścia dla osób nietechnicznych.
- **Trendy i Agregacje (Rozwój):** Silnik analityczny przygotowano pod zaplanowane w roadmapie historyczne "Trendy Sezonowe". Zacznie odnotowywać historyczne doliny sprzedażowe co miesiąc, ułatwiając długoterminowe prognozowanie.
- **Cykl Życia Projektu (Archiwizacja):** System obsługuje pełny cykl życia inwestycji. Projekty domyślnie trafiają do widoku **Aktywne**. Po zakończeniu prac, użytkownik może skorzystać z funkcji **"Zakończ i Archiwizuj"**, która przenosi projekt do zakładki **Archiwum**. Dzięki temu Dashboard i lista główna pozostają przejrzyste, a historyczne dane finansowe są zachowane do celów analitycznych (brak usuwania danych z bazy).

## 10. Backlog - Faza 2 (Funkcje Premium)
System przewiduje w kolejnych iteracjach wdrożenie poniższych mechanizmów na poziomie korporacyjnym:
- **Contractor Scoring:** Algorytm wyliczający wiarygodność płatniczą klienta na podstawie historycznych opóźnień (`average_delay_per_client`). Pozwala z wyprzedzeniem unikać nierzetelnych kontrahentów.
- **Mechanizm Idempotency Keys:** Potężne zabezpieczenie architektoniczne chroniące przed podwójnym księgowaniem webhooków z banku, idealne przy asynchronicznym wczytywaniu transakcji.

## 11. Architektura i Protokoły Techniczne
- **Serializacja Typów z Bazy (Prisma do Client Components):** System posiada sprecyzowane zasady serializacji na granicy warstw backend/frontend. Surowe typy `Decimal` dostarczane z bazy Prisma są mapowane podczas przejścia na typy proste (`Number`), aby zapobiec ograniczeniom ekosystemu Next.js 15 ("Only plain objects can be passed to Client Components") przy renderowaniu interaktywnych komponentów, np. dynamicznych wykresów.
- **Pattern Stabilnego Wykresu (Hydracja Next.js):** Aby uniknąć błędów `width(-1)` i `height(-1)` w bibliotece Recharts, wszystkie komponenty wykresów (np. `MoneyPieChart`) wykorzystują hook montowania (`isMounted`) oraz kontenery o sztywnej wysokości (`h-[300px]`). Zapobiega to próbom renderowania wykresu przed stabilizacją layoutu w przeglądarce.
