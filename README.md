# Sig ERP – Instrukcja Obsługi (User Manual)

Witaj w centrum dowodzenia Twoją firmą. System Sig ERP został zaprojektowany, aby dać Ci pełną kontrolę nad finansami, projektami i relacjami z kontrahentami w czasie rzeczywistym.

---

## 🛠️ Podręcznik Modułów

### 🤝 Kontrahenci (CRM)
- **Dodawanie Firm**: Wyszukiwanie po NIP automatycznie pobiera dane (jeśli zintegrowane) lub pozwala na ręczny wpis.
- **Automatyczne Obiekty**: Przy dodaniu Inwestora system sam stworzy lokalizację „Siedziba Główna”, abyś mógł od razu przypisać do niego Projekt.
- **Typy Firm**: Oznaczaj czy to *Inwestor*, *Dostawca* czy *Hurtownia* dla lepszej filtracji.

### 🏗️ Projekty
- **Katalog Inwestycji**: Każdy projekt jest przypisany do konkretnego obiektu Twojego klienta.
- **Etapy Budowy**: Dziel projekt na mniejsze części, aby śledzić budżet i postęp prac.
- **Zyskowność**: System na bieżąco sumuje faktury kosztowe i przychodowe przypisane do projektu.

### 💰 Finanse i Cash Flow
- **Rejestr Transakcji**: Wszystkie wydatki i wpływy w jednym miejscu.
- **Koszty Ogólne (Zarząd)**: Wydatki nieprzypisane do konkretnej budowy (biuro, paliwo, telefony). Znajdziesz je w zakładce „Ogólne / Administracyjne”.
- **Wzbogacanie Danych**: Jeśli transakcja z banku nie ma projektu, możesz ją później „Przypisać do projektu” jednym klikiem.
- **Inteligentny Import (Drag & Drop)**: Funkcja "Importuj wyciąg" w Panelu Szybkich Akcji obsługuje teraz przeciąganie plików MT940 (SWIFT) i CSV bezpośrednio do przeglądarki.

---

## 📈 Dashboard CEO (Widok Strategiczny)

- **Czysta Gotówka (Safe to Spend)**: Ile pieniędzy możesz realnie wypłacić z firmy po odliczeniu VAT i rezerwy na podatek dochodowy (9%).
- **Realny Zysk**: Obliczany jako `Suma Marż z Projektów - Koszty Ogólne Zarządu`.
- **Alarm Płynności**: Jeśli status zmieni się na „Realista”, oznacza to, że uwzględniamy możliwe 14-dniowe opóźnienia wpłat od klientów.

---

## 🔐 Procedury Awaryjne i Bezpieczeństwo

### 📦 Backup & Restore (Skarbiec)
1. **Kopia**: W zakładce `Ustawienia` pobierz plik JSON. Rób to przed każdą większą zmianą danych.
2. **Odtwarzanie**: Wymaga hasła autoryzacyjnego. Pamiętaj, że wgranie kopii **usuwa** obecne dane przed przywróceniem starych.

### 🧨 Master Reset (Atomic Purge)
Funkcja "Wyczyść wszystkie dane" usuwa absolutnie wszystko powiązane z Twoją firmą (Firestore + SQL). Używaj tylko w sytuacjach krytycznych.

---

### 🛠️ Bug Fix #012: Stabilizacja Kontrahentów & NIP
- **Unikalność NIP per Tenant**: Zmieniono schemat bazy danych Prisma, aby umożliwić wielu osobom (tenantom) posiadanie faktur od tego samego dostawcy (np. ORLEN S.A.). NIP jest teraz unikalny w obrębie jednej firmy, a nie globalnie.
- **Wzorzec Find-or-Create**: Rejestracja kosztów i przychodów wykorzystuje teraz bezpieczny wzorzec wyszukiwania kontrahenta przed zapisem, co eliminuje błędy `Unique constraint failed`.
- **Koszty Ogólne**: Faktury bez przypisanego projektu są teraz poprawnie klasyfikowane jako `GENERAL_COST` w obu bazach danych (Dual-Sync).
- **Opcjonalność Projektu**: Zmiana w Prisma Schema: Ustawiono `projectId` jako opcjonalne w modelach `Invoice` i `Transaction`, aby umożliwić pełną obsługę Kosztów Ogólnych Firmy (GENERAL_COST).
- **Synchronizacja Produkcyjna**: Wymuszono synchronizację schematu Prisma podczas buildu Vercel (db push && generate).
- **Logika Formularza (UI/UX)**: Sekcja "Kaucja Gwarancyjna" jest teraz renderowana warunkowo – pojawia się tylko przy kategorii **INWESTYCJA**, co upraszcza księgowanie standardowych kosztów i paliwa.

---
### 📅 Status Wdrożenia (2026-03-23)
- **Sukces**: Pomyślnie wdrożono i przetestowano obsługę Kosztów Ogólnych (GENERAL_COST).
- **Fix**: Poprawiono synchronizację Prisma Schema na Vercel – `projectId` jest teraz opcjonalny.
- **UI**: Wprowadzono warunkowe ukrywanie sekcji kaucji dla dokumentów kosztowych.
- **Finanse**: Potwierdzono poprawność wzoru: **Safe to Spend = Bilans - VAT - CIT (9%)**.

---
- **Form Clarity**: Dodano wyraźne pola "Tytuł wydatku / przychodu" w formularzach, aby ułatwić nazywanie transakcji.

---
### 📅 Status Wdrożenia (2026-03-23 v3 - Data Integrity)
- **Data Healing**: Wprowadzono przycisk `Health Check (Orlen)` w CRM, który usuwa duplikaty bez NIP-u, rozwiązując problem "śmieciowych" danych.
- **Strict Validation**: Wprowadzono blokadę tworzenia partnerów o tej samej nazwie bez NIP-u (Deduplikacja prewencyjna).
- **UI Overflow Fix**: Ograniczono wysokość list rozwijanych do 240px w modalach, co przywróciło pełną obsługę pól "Projekt" i "Kategoria" na mniejszych ekranach.

---
### 📅 Status Wdrożenia (2026-03-23 v4 - CRM Consistency)
- **Prisma-First CRM**: Lista kontrahentów pobiera teraz dane bezpośrednio z Prismy (SQL), zapewniając 100% spójności z wyszukiwarkami i raportami.
- **Master Sync SQL**: Dodano funkcję pełnej synchronizacji `Firestore -> SQL` dla kontrahentów i statusów faktur.
- **Ujednolicone UI CRM**: Wprowadzono manualne zakładki [WSZYSTKIE], [INWESTORZY], [DOSTAWCY] w stylu Rejestru Transakcji oraz badge typów przy nazwach.
- **Formuła Real Debt**: Saldo kontrahenta bazuje na `SUM(amountGross) WHERE status NOT IN ('PAID', 'REVERSED')`. Badge "ZALEGA" znika z DOM przy bilansie 0.
- **Poprawa Modali**: Zaimplementowano `max-h-[70vh]` dla list rozwijanych (Select/Dropdown).
- **Skaner OCR Gemini 3 Flash Preview**: Wdrożono inteligentne skanowanie faktur z automatycznym mapowaniem kontrahentów (Smart Match) i blokadą duplikatów (Anti-Duplicate Shield).
- **Naprawa Typów OCR & Prisma Config**: Rozwiązano problem walidacji `vatRate` (number/string) i zmigrowano konfigurację Prisma do `prisma.config.ts`.
- **Selektor Lat w Analityce**: Wdrożono dynamiczny wybór roku na Dashboardzie, umożliwiający precyzyjne przeglądanie statystyk (Miesiąc/Kwartał/Rok) dla lat ubiegłych.
- **Aktywacja Ratownika Płynności**: Ożywiono przycisk "Zarządzaj Kosztami" w module Alarmu Płynności – teraz przekierowuje on do listy nieopłaconych faktur (UNPAID) z automatycznym sortowaniem po terminie płatności.

---
### 📅 Status Wdrożenia (2026-03-24 - OCR Inbox & Refinement)
- **Quick Action: Opłać**: Dodano przycisk szybkiego opłacania faktur na liście dokumentów, który jednym kliknięciem zmienia status na PAID i tworzy powiązaną transakcję.
- **Skarbiec Kaucji (Retention Vault)**: Wdrożono moduł zarządzania środkami zamrożonymi u inwestorów z obsługą kaucji manualnych, procentowych oraz systemem ostrzegania 30 dni przed wygaśnięciem.
- **Quick Add (Kaucje)**: Umożliwiono błyskawiczną rejestrację nowych firm (Inwestorów) i Projektów bezpośrednio z formularza kaucji, co przyspiesza wprowadzanie danych historycznych.
- **Dynamiczna Agregacja Budżetu**: Wdrożono dynamiczne odliczanie rzeczywistych kosztów (faktur EXPENSE Brutto) od budżetu projektu w module Analizy Zdrowia, zapewniając realny status "Bezpieczny/Zagrożenie".
- **Moduł Rentowności Jednostkowej (P&L Projektu)**: Wdrożono widok rentowności w modalu analizy: Przychody Netto vs Koszty Netto = Marża, z automatycznym alertem dla projektów niedochodowych.
- **Przemodelowanie Logiki Projektu**: Pasek postępu przełączono na Progress Fakturowania. Dodano wizualizację "podgryzania" marży przez koszty rzeczywiste (Wektor 033). Budżet (ProgressBar) śledzi teraz postęp fakturowania klienta, a sekcja P&L skupia się na realnym zysku.
- **Automatyzacja Kaucji (Wektor 034)**: Wdrożono automatyczne harmonogramowanie zwrotów kaucji na podstawie daty zakończenia prac i okresu gwarancji. Poprawiono trwałość danych w formularzu edycji projektu (Memory Fix) oraz dodano system ostrzeżeń (Guardrail) przy zmianie parametrów kaucji.
- **Zero-Day Auto-Pay**: Brakujące ogniwo automatyzacji – system automatycznie oznacza faktury jako opłacone, gdy data wystawienia pokrywa się z terminem płatności.
- **OCR Inbox**: Wdrożono Inbox OCR z obsługą wielu dokumentów na jednym skanie oraz wstępną weryfikacją przed księgowaniem.
- **Safe Delete & Quick View**: Wdrożono funkcję Safe Delete (usuwanie z potwierdzeniem) oraz podgląd detali dokumentu finansowego z danymi OCR (NIP, Daty, Projekt).
- **Auto-Matching (Pewniak)**: Jeśli system rozpozna NIP dostawcy z bazy, automatycznie przypisuje mu ostatnio użytą kategorię i projekt. Takie pola są oznaczane jako "Pewniak" (Sparkles).
- **Bulk Action**: Dodano przycisk "Zaksięguj Wszystkie Prawidłowe", który jednym kliknięciem zapisuje wszystkie poprawnie zweryfikowane dokumenty do bazy.
- **Multi-Entity OCR**: Obsługa wielu faktur/paragonów na jednym zdjęciu oraz seryjne przesyłanie do 5 plików.
- **Wektor 035: Protokół Zamknięcia Projektu**: Wdrożono inteligentny modal zamknięcia inwestycji (`ClosureProjectModal`), który oblicza kwotę pozostałą do zafakturowania, blokuje przypisywanie nowych kosztów (Archive Lock) oraz precyzyjnie przelicza daty zwrotu kaucji na podstawie daty odbioru protokołu.
- **Wektor 036: Alerty Fakturowania i Powiadomienia**: Zaimplementowano system powiadomień systemowych (Notifications) oraz dedykowany widżet Dashboardu "Do Zafakturowania", który pilnuje, aby każda zamknięta budowa została rozliczona do ostatniego grosza.

---
---
### 📅 Status Wdrożenia (2026-03-24 v2 - Finalizing OCR Workflow)
- **OCR Inbox Perfection**: System obsługuje teraz pełen cykl od skanu wielostronicowego do seryjnego księgowania z automatycznym wykrywaniem typu dokumentu (Wektor 037).
- **Quick Entities**: Możliwość błyskawicznego dodawania nowych firm i projektów bezpośrednio z Inboxa OCR (Wektor 038).
- **Safe-to-Deploy**: Kod został oczyszczony z niebezpiecznych rzutowań `any` i przygotowany do pełnej kompilacji na Vercel (Wektor 039).
- **Automatyka Kaucji & Rentowności**: System w pełnej skali monitoruje marżę projektową i dba o kaucje gwarancyjne (Wektory 034-036).
- **Wykres Dynamiki Finansowej**: Zaktualizowano wykres Analizy Zdrowia na wieloliniowy wykres dynamiki finansowej (Revenue vs Cost vs Profit vs Runway) z narastającym zyskiem oraz dynamiczną linią ROI.
- **Wskaźniki ROI & Marży (Wektor 040)**: Wdrożono analitykę ROI i Marży Netto dla każdego projektu z wizualizacją progów rentowności (Super biznes / Alarm).

*Dla programistów: Techniczna dokumentacja DNA znajduje się v [docs/AI_look.md](./docs/AI_look.md)*

---
#### 🛠️ Ostatnie poprawki (2026-03-24 v3)
- **UI Persistence Fix**: Naprawiono błąd wyświetlania kaucji w edycji projektu (zaciąganie aktualnych wartości % z bazy).
- **Retention Activation Protocol**: Wdrożono system automatycznej aktywacji kaucji na podstawie faktycznej daty odbioru inwestycji (Status: `DRAFT` -> `ACTIVE`).
- **Final Invoice Prompt**: Dodano automatyczne alerty o fakturach końcowych przy zamykaniu projektu.
- **Dynamic Project Health Chart**: Wdrożono skumulowany wykres dynamiki finansowej (Revenue/Cost/Profit/Runway) z dodatkową linią ewolucji ROI.
- **Profitability Dashboard**: Dodano widżety ROI i Marży Netto w Project Cockpit z kolorystyką warunkową (Badges).
- **Wektor 041: Silnik Uzgadniania Bankowego (MT940)**: Wdrożono pełną obsługę standardu SWIFT MT940. System automatycznie parsuje wyciągi, dopasowuje przelewy do faktur, obsługuje niedopłaty (Red Light Alert) oraz separuje koszty zarządu od budżetów projektowych.
- **Live Profit Tracking**: Zielona linia zysku na wykresach odzwierciedla teraz rzeczywiste wpływy i wydatki z banku, zapewniając 100% precyzji Cash Flow.
- **Wektor 042: Integracja KSeF 2.0 (Krajowy System e-Faktur)**: Wdrożono moduł `ksef-service` umożliwiający automatyczne pobieranie faktur FA(3) bezpośrednio z Portalu Podatnika. Dokumenty trafiają do Inboxu jako `UNVERIFIED` (Draft). Tryb **Tylko Odczyt** zapewnia 100% bezpieczeństwo operacyjne.
- **Wektor 044: Optymalizacja PKO BP & UI Cleanup**: Refinement parsera MT940 pod kątem sub-tagów PKO BP (`~`). Rozszerzono listę auto-kategoryzacji o stacje paliw (Orlen, BP, Shell itp.) oraz wdrożono funkcjonalny Drag & Drop w toolbarze.
- **Wektor 045: Refactored MT940 UI & Sanitization**: Refaktoryzacja komponentu listy transakcji. Wdrożono sanitację backendową tagu `:86:`, automatyczne matchowanie kontrahentów z bazą danych oraz middleware do tagowania wydatków (np. `[PALIWO]`).
| Vector 046 | Finance / Engine | FIXED | Phase 11b: Transition from MT940 to CSV. | Pivot na format CSV. Wdrożono `CSVBankParser` z obsługą dedykowanych kolumn PKO BP, sanitację prefiksów i routing ZUS/Podatki. |
| Vector 047 | Database / Admin | FIXED | Phase 11c: Emergency Database Purge Utility. | Wdrożono endpoint `/purge-all` i modal bezpieczeństwa w UI. Resetuje statusy faktur i usuwa transakcje bez przypisanego projektu. |
| Vector 048 | Database / Sync  | FIXED | HOTFIX: Resolved Sync: error after purge. | Wdrożono "Deep Purge" (czyszczenie dual-source), poprawiono obsługę błędów w `/health` i wymuszono odświeżanie cache w UI. Wdrożono Deep Purge: Pełna synchronizacja czyszczenia bazy SQL i Firestore (kaucje). Rozwiązano problem osieroconych rekordów. |
| Vector 049 | Finance / Parser | FIXED | Phase 12: PKO BP CSV Standard & Sync Reset. | Implementacja dedykowanego parsera PKO BP (kolumny 0,3,5,6,7), sanitacja prefiksów i auto-routing ZUS/Zarząd. Wdrożono `/api/finance/sync` do resetu stanu. |
| Vector 050 | Finance / Engine | FIXED | Phase 13: 3-Layer Bank Import Pipeline. | Refaktoryzacja potoku importu (Parser -> Normalizer -> Mapper). Obsługa `win1250` przez `iconv-lite` oraz wydajny batch saving (`createMany`). |
| Vector 051 | Finance / Engine | FIXED | Phase 14: Cascading Contractor Identification. | Wdrożenie systemu "Kaskady" (Konto -> NIP -> Nazwa). Auto-nauka NRB z faktur (OCR/KSeF), aktualizacja modelu Contractor i refaktoryzacja maperów bankowych. |
| Vector 052 | Finance / Engine | FIXED | Phase 14b: Bi-directional Contractor Enrichment. | Wdrożono system bi-directional enrichment dla Kontrahentów. System automatycznie uczy się numerów kont z wyciągów bankowych (Scenario 1) i łączy je z profilami firm na podstawie nazw i numerów NIP (Scenario 2). |
| Vector 053 | System / UX | FIXED | HOTFIX: V.053 - RESCUE (Charts, CORS, 500 Errors). | Naprawiono błąd renderowania wykresów (min-h-[400px]), wdrożono Proxy dla API Net-Pocket (CORS Fix) oraz utwardzono Master Reset i Pipeline'y (Stability Fix). |
| Vector 054 | Finance / Engine | FIXED | Master Parser & Self-Learning Engine. | Wdrożono 3-warstwowy potok (Pipeline) dla PKO BP CSV. Regex Normalizer (Condition A/B), Bi-directional Enrichment (IBAN learning) i Auto-Routing (ZABKA/ZUS). [ACTIVE] 🟢 |
| Vector 055 | Finance / Engine | FIXED | HOTFIX: Aggressive Regex Engine & Column Consolidation. | Wdrożono konsolidację kolumn opisowych PKO BP (slice od kolumny 5, join). Zastąpiono słabe Condition A/B pełnym silnikiem Regex z Lookaheadami: IBAN, Nazwa, Tytuł, Lokalizacja. UI wyświetla teraz czyste dane (brak "Rachunek nadawcy:" w Rejestrze Transakcji). |
| Vector 056 | Finance / Engine | FIXED | HOTFIX: Refined Regex & Golden Rule Fallback. | Doprecyzowano Regex dla Nazwy (obsługa 'Adres:' dla kart), wdrożono czyszczenie technicznych przedrostków (Z/K/000) oraz 'Złotą Regułę' (fallback na Tytuł przy pustej nazwie). Rozszerzono auto-routing o Auchan/Biedronkę. |
| Vector 057 | Finance / UI     | FIXED | Mandatory Bank Account Selection. | Wdrożono selektor konta bankowego w widoku importu. System automatycznie pre-selektuje konto domyślne (`isDefault`) i blokuje import bez przypisanego ID konta SQL. |
| Vector 058 | Finance / Engine | FIXED | Production Reliability & Dual-Sync. | Wdrożono serylizowalne obiekty odpowiedzi `{ success, results, error }` dla akcji serwerowych, eliminując błędy 500 na Vercelu. Poprawiono Dual-Sync dla kontrahentów. |
| Vector 059 | Finance / Engine | FIXED | MT940 Firestore Fix (Strict Nulls). | Naprawiono błąd krytyczny `Cannot use "undefined" as a Firestore value` w potoku MT940 poprzez wymuszenie jawnych wartości `null` dla opcjonalnych pól (NIP, Adres). |
| Vector 060 | Finance / Architecture | PIVOT | Always CSV, Never MT940. | Oficjalne wycofanie wsparcia dla formatu MT940 na rzecz CSV. Zaktualizowano UI (QuickActions, Import Page) i Route Handlery, aby wymusić i promować stabilniejszy format wyciągów. |

- **HOTFIX: Wdrożono Dual-Sync i serylizację wyników (V.058).** 
- **Build Verified**: Projekt przeszedł testy statyczne (`tsc`) i jest gotowy do wdrożenia na Vercel.

*Vercel & Firestore Ready 🚀*
