# Sig ERP – Historia Techniczna (Technical Changelog)

Ten plik zawiera szczegółową historię zmian technicznych (Wektory) dla programistów i audytorów AI.

---

### 🛠️ Wykaz Wektorów (Zatwierdzone Zmiany)

| ID | Moduł | Status | Opis | Szczegóły Techniczne |
|:---|:---|:---|:---|:---|
| Vector 001 | Finanse | FIXED | Błąd serializacji Decimal w RSC. | Konwersja na String/Number przed wysyłką. |
| Vector 007 | Project Drift | FIXED | Projekty widoczne tylko w Firestore. | Poprawiono `projects.ts`, dodano tryb Healer dla synchronizacji. |
| Vector 009 | Fetcher Error | FIXED | NoSQL limit `in` (max 30 id). | Wdrożono Chunking zapytań w `crm.ts`. |
| Vector 011 | Dashboard | FIXED | Błędna matematyka marży (Gross vs Net). | Obliczenia zysku oparte teraz wyłącznie o wartości Netto. |
| Vector 012 | RegisterIncomeModal | FIXED | Brak kategorii "INWESTYCJA". | Dodano kategorię do słowników w `lib/categories`. |
| Vector 013 | Build / Vercel | FIXED | Null constraint violation (projectId). | Wymuszono `db push` w `package.json`. |
| Vector 014 | UI/UX Drift | FIXED | Kaucja widoczna dla kosztów paliwa. | Warunkowy rendering kaucji (tylko dla INWESTYCJA). |
| Vector 015 | Data Integrity | FIXED | Śmieciowe rekordy "Orlen" bez NIP. | Wdrożono `contractorHealer.ts` i walidację unikalności nazw. |
| Vector 016 | UI/UX | FIXED | Dropdowny uciekają poza modal. | `max-h-60` i `overflow-y-auto` dla Select. |
| Vector 017 | Architecture | FIXED | Drift danych Firestore vs Prisma. | Ujednolicono źródło danych na Prisma-First. |
| Vector 018 | Logic Error | FIXED | Błędne saldo kontrahenta. | Formuła `SUM(...) WHERE status NOT IN ('PAID', 'REVERSED')`. |
| Vector 019 | Logic / Compliance | FIXED | CIT Rate mismatch (19% vs 9%). | Zmieniono stawkę CIT na 9% (Mały Podatnik). |
| Vector 020 | AI / Automation | FIXED | Manual data entry for invoices. | Wdrożono `scanInvoiceAction` (Gemini Flash). |
| Vector 025 | AI / Batch OCR | FIXED | Multi-document OCR & Batch Mode. | Obsługa wielu dokumentów na jednym zdjęciu. |
| Vector 029 | AI / Finance / Logic | FIXED | Brak Skarbca Kaucji. | Wdrożono moduł Retention Vault. |
| Vector 031 | Project Health / Logic | FIXED | Dynamic Budget Aggregation. | Obliczenia oparte o faktury EXPENSE (Brutto). |
| Vector 035 | Project Closure | FIXED | Closure Protocol (Archive Lock). | Modal zamknięcia inwestycji blokujący koszty. |
| Vector 041 | Finance / Bank | FIXED | Bank Reconciliation Engine. | Wdrożono parser MT940 i algorytm uzgadniania. |
| Vector 042 | KSeF / Integration | FIXED | KSeF 2.0 Integration. | Zaimplementowano `ksef-service` (Read-only). |
| Vector 046 | Finance / Engine | FIXED | Transition from MT940 to CSV. | Pivot na format CSV dla wyciągów PKO BP. |
| Vector 050 | Finance / Engine | FIXED | 3-Layer Bank Import Pipeline. | Parser -> Normalizer -> Mapper (iconv-lite). |
| Vector 054 | Finance / Engine | FIXED | Master Parser & Self-Learning. | Regex Normalizer i Bi-directional IBAN learning. |
| Vector 057 | Finance / UI | FIXED | Mandatory Bank Account Selection. | Selektor konta w UI + pre-selekcja `isDefault`. |
| Vector 058 | Finance / Engine | FIXED | Production Reliability (Serializable). | Server Actions zwracają `{ success, results, error }`. |
| Vector 059 | Finance / Engine | FIXED | Firestore Strict Nulls. | Jawne rzutowanie na `null` dla pól nip/address/iban. |
| Vector 060 | Finance / Architecture | PIVOT | Always CSV, Never MT940. | Usunięcie MT940 z UI i potoków ze względu na błędy. |
| Vector 061 | Finance / Pipeline     | FIXED | High-Precision Bank Import (CSV). | Wdrożono auto-detekcję separatorów (`,`/`;`), zaawansowany silnik wyciągania NIP/Nazw i poprawiono obsługę kodowania znaków. Rozwiązano błąd 0,00 PLN i braków danych. |
| Vector 062 | Finance / CRM | FIXED | Smart Import Hub. | Wdrożono `Smart Import Hub` (Ledger/CRM) z `analyzeImportMatches`. |
| Vector 063 | KSeF / Core | FIXED | Sprint 1: KSeF Read-Only. | Wdrożono `ksefService.ts` (Auth -> Query -> Fetch -> Parse). Model `KsefInvoice` (Prisma) z obsługą Raw XML Fa(2). Zweryfikowano `tsc --noEmit`. |
| Vector 064 | KSeF / Prod | FIXED | Production Direct Token. | Wdrożenie API produkcyjnego MF, autoryzacja Direct Token (Bearer), usunięcie RSA i diagnostyka `/verify-all`. |
| Vector 065 | KSeF / Architecture| FIXED | Dynamic Public Key & Native Paging. | Wdrożono dynamiczne pobieranie klucza publicznego KSeF do pamięci (Runtime) oraz rygorystyczną paginację (limit 50) i filtrowanie dat. Usunięto zależność od plików PEM. |
| Vector 066 | KSeF / Production  | FIXED | HOTFIX: Handshake 404 & DER Parsing. | Naprawiono błąd 404 poprzez korektę endpointów na `/v2/` oraz wdrożenie binarnego parsowania certyfikatu SPKI/DER. Pełna zgodność z produkcją MF (timestampMs). |
| Vector 068 | KSeF / Architecture| FIXED | Official 4-Step Handshake v2.0. | Wdrożono 4-stopniowy proces autoryzacji (Challenge -> X509/Encryption -> KSeF-Token -> Redeem). Obsługa X509Certificate (Node 18+), 3x retry dla kluczy i 55-minutowy cache dla Access Tokena. |
| Vector 069 | KSeF / Architecture| FIXED | KSeF Query V2 Fix (404/Step 5). | Zmieniono endpoint zapytania na poprawny `/v2/invoice/query/query` oraz skorygowano payload kryteriów (`subject2`, `incremental`). Przywrócono widoczność metadanych faktur kosztowych. |
| Vector 070 | KSeF / Architecture| FIXED | KSeF Sync Query Refinement. | Przejście na oficjalny protokół nagłówka `SessionToken` (bez Bearer) oraz endpoint `/v2/online/Query/Invoice/Sync` z kryterium `acquisitionTimestampThreshold`. Pełna zgodność z modelem synchronicznym MF. |
| Vector 071 | KSeF / Architecture| FIXED | KSeF Sync Query Casing & Range Fix. | Skorygowano URL na małe litery `/v2/online/query/invoice/sync` oraz zmieniono typ zapytania na `range` (invoicingDate). Rozwiązano problem 404 w Kroku 5. |
| Vector 072 | KSeF / Architecture| FIXED | KSeF Sync Query Cased & Incremental Fix. | Skorygowano URL na wielkie litery `/v2/online/Query/Invoice/Sync` oraz zmieniono typ zapytania na `incremental` (acquisitionTimestamp). Rozwiązano bloker Step 5/6. |
| Vector 073 | KSeF / Architecture| FIXED | Inwentor KSeF v2.0 Step 5 Fix. | Wdrożono funkcję `fetchInvoiceMetadata` z precyzyjną obsługą błędów 404, mapowaniem `invoiceHeaderList` i ujednoliconym nazewnictwem w całym projekcie (Vector 073). |
| Vector 074 | KSeF / Parser| FIXED | KSeF FA (3) XML Parser. | Uaktualniono parser XML (`fast-xml-parser`) do obsługi schematu FA (3). Wdrożono `removeNSPrefix`, wymuszenie tablicy dla `FaWiersz` oraz mapowanie pozycji liniowych faktury. |
| Vector 075 | KSeF / Parser| FIXED | Inwentor Step 6 Finalization. | Wdrożono bezpieczną obsługę pustych wyników zapytania oraz zaktualizowano mapowanie dla schematu FA (3) (Poczta Polska spec). Walidacja kwot brutto (`P_15`) przez parseFloat. |
| Vector 076 | KSeF / Diagnostics| FIXED | Inwentor Step 6 Diagnostic & Step 7 Auth Fix. | Dodano hardcoded test XML (Poczta Polska) do suity /verify-all. Uszczelniono logikę 404/401 dla Step 7 (Auth-Fix). |
| Vector 077 | KSeF / Parser| FIXED | Inwentor Step 6 Mapping Fix. | Naprawiono mapowanie pól dla podmiotów zwolnionych (P_13_7) oraz skorygowano namespace w diagnostyce na `crd.gov.pl`. |
| Vector 078 | KSeF / Parser| FIXED | KSeF FA (3) Final Refinement. | Zaimplementowano pełną obsługę stawek zwolnionych (P_13_7) dla schematu FA (3) oraz priorytetyzację pola P_15. |
| Vector 079 | KSeF / Parser| FIXED | KSeF FA (3) Polymorphic Mapping. | Wdrożono obsługę faktur zaliczkowych (ZAL) oraz ekstrakcję pozycji z sekcji `ZamowienieWiersz`. Podwójny test diagnostyczny w suicie `/verify-all`. |
| Vector 080 | KSeF / Parser| FIXED | KSeF Vendor Profile Extraction. | Rozbudowano parser o ekstrakcję danych sprzedawcy (NIP, Nazwa, Adres) z sekcji `Podmiot1`. Weryfikacja multi-tożsamości w diagnostyce. |
| Vector 081 | KSeF / Parser| FIXED | KSeF FA (3) ZAL Refinement. | Wdrożono ekskluzywne mapowanie `ZamowienieWiersz` dla faktur ZAL. Aktualizacja danych POLON-ALFA S.A. (NIP 5540311901). Weryfikacja liczby pozycji w Step 6. |
| Vector 082 | KSeF / Architecture| FIXED | KSeF JWT v2 Standard Implementation. | Wdrożono 5-etapowy Handshake z pollingiem statusu (`GET /v2/auth/{referenceNumber}`). Przejście na `Authorization: Bearer` oraz strukturę `filters`/`paging` dla zapytań metadanych. Obsługa strefy czasowej `+01:00`. |
| Vector 083 | KSeF / Resilience  | FIXED | Resilient Handshake (Exponential Backoff). | Refaktoryzacja Pollingu Statusu. Wprowadzono wykładnicze opóźnienie (2s -> 16s) oraz wydłużono timeout do 60s. Dodano szczegółowe logowanie statusów MF (np. 310 Processing). |
| Vector 084 | KSeF / Architecture| FIXED | Edge Runtime & Robust Fetching Optimization. | Wdrożono `runtime: 'edge'` dla routerów API. Zastosowano "Pancerny Kod" (defensive fetch) oraz offset `+02:00` dla polskiego czasu letniego. Skrócono zasięg test-sync do 48h. |
| Vector 085 | KSeF / Architecture| REVERT | Node.js Runtime compatibility fix. | Przywrócono standardowy Node.js runtime zamiast Edge, aby zachować pełną zgodność z modułem `crypto` i `X509Certificate`. Rozwiązano błąd Vercel Build "Module not found". |
| Vector 086 | KSeF / Architecture| FIXED | Workflow V2.1 "Sztafeta" Implementation. | Wdrożono nowy protokół autoryzacji: KSeF-Token -> Polling z Bearer (authTok) -> Redeem. Dodano `AbortSignal.timeout(25000)` do wszystkich fetchy oraz przywrócono `runtime: 'edge'`. |
| Vector 087 | KSeF / Architecture| FIXED | JWT Manager & Persistence Architecture. | Wdrożono `KsefSessionManager` z obsługą `refreshToken` w bazie Prisma. Implementacja logiki "Check & Refresh" (JWT decode) dla automatyzacji procesów w tle. |
| Vector 088 | KSeF / Architecture| FIXED | Metadata Query Typo (sale -> sales) & JWT Integration. | Naprawiono błąd 400 (21405) poprzez zmianę `invoiceType` na `sales` (plural). Pełna integracja `KsefSessionManager` z endpointem `/api/ksef/invoices`. |
| Vector 093 | KSeF / Architecture| FIXED | Stage 1: Shallow Sync (Płytki Sync). | Wdrożono flow: Metadata -> Upsert Contractor (PENDING) -> Upsert Invoice (XML_MISSING). Izolacja Prisma-only. Priorytet nazwy systemowej Kontrahenta. Obsługa kwot 0 PLN. |
| Vector 094 | KSeF / UI Bugfix    | FIXED | Quick Sync UI Fix. | Rozwiązano problem "cichego błędu" w `/api/ksef/invoices`. Zaktualizowano mapowanie pól (subject1/2) pod KSeF v2.0. Poprawiono obsługę błędów (success: false), co pozwala UI wyświetlić komunikat o błędzie. |
| Vector 095 | KSeF / Architecture| FIXED | KSeF Real Field Mapping. | Ostateczna synchronizacja z JSON-em produkcyjnym KSeF na podstawie logów Vercel. Wdrożono mapowanie dla `ksefNumber` oraz obiektów `seller`/`buyer`. Rozwiązano problem "pustej listy" przy poprawnym pobraniu danych. |
| Vector 096 | KSeF / Debug        | FIXED | Strict Sync Logging (Investigation). | Wdrożono rygorystyczne logowanie `[PRISMA_SUCCESS]` i `[PRISMA_UPSERT_ERROR]` w celu śledzenia rurociągu danych. Dodano logowanie kierunku (REVENUE/EXPENSE) oraz NIP-ów do debugowania "zaginionych faktur". |
| Vector 097 | KSeF / Debug        | FIXED | Emergency Mode: Log or Die. | Wdrożono rygorystyczne logowanie `[SYNC_PROCESS]` i `[PRISMA_SUCCESS]` z ID rekordu. Skorygowano ekstrakcję NIP (Buyer: identifier.value vs Seller: nip). Zapewniono pełne `await` dla stabilności w środowisku Vercel. |
| Vector 098 | KSeF / Architecture| FIXED | KSeF Meta Result Key Fixed. | Rozwiązano problem "pustej pętli" poprzez dodanie obsługi klucza `invoices` w `KSeFService.metadataQuery`. Było to główne wąskie gardło uniemożliwiające zapisanie faktur mimo ich poprawnego pobraniu z API. |
| Vector 099 | Finance / Engine | FIXED | DNA Vector 099: Centralized Financial Engine. | Wdrożono `financeMapper.ts` jako jedyne źródło prawdy dla znaków i kolorów. Zakupy (Net -, VAT +, Gross -), Sprzedaż (Net +, VAT -, Gross +). |
| Vector 100 | Finance / Engine | FIXED | Runtime Guard for toUpperCase. | Dodano zabezpieczenie przed `undefined` w `financeMapper.ts`, eliminując błąd TypeError w przeglądarce. |
| Vector 120 | Finance / Reconciliation | FIXED | Smart Bank Reconciliation Hub. | Wdrożenie BankStaging (Strefa Zrzutu) i Triage UI. Zastąpienie cichych importów ręczną weryfikacją z podpowiedziami AI. |

---

### 📝 Dodatkowe Notatki Audytowe

### 2026-03-30 (Vector 097)
- **Vector 097**: **Retention Audit (Skarbiec Kaucji)**:
    - Dodano relację `invoiceId` do modelu `Retention` w Prisma.
    - Wdrożono automatyczne tworzenie rekordów kaucji przy dodawaniu faktur kosztowych i przychodowych.
    - Zaimplementowano `Popover` w `RetentionVault.tsx` wyświetlający detale audytu (numer faktury, opis P_7).
    - Stworzono skrypt `heal-retentions` dla odzyskania historycznych danych.

- **Vector 100**: Financial Engine Stability (toUpperCase Guard).
- **Vector 097**: Retention Vault Audit Implementation (Automatic Invoice Linkage & Popover).

*Ostatnia aktywność techniczna: 2026-03-30. Build Verified (TSC: OK).*
