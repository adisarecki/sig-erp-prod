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

---
*Ostatnia aktywność techniczna: 2026-03-27. Build Verified (TSC: OK).*
