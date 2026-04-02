# Sig ERP – AI Master Context (AI_look.md)

Ten plik jest „DNA” technologicznego systemu SIG ERP. Jest przeznaczony wyłącznie dla modeli LLM (AI), aby zapewnić 100% zrozumienia architektury, logiki finansowej i rygorystycznych standardów bez konieczności ponownego researchu.

---

## 🏗️ 1. Architektura i Stack Techniczny

- **Framework**: Next.js 15.2.8 (App Router), React 19, Tailwind 4.
- **Bazy Danych (Data Authority Model - Vector 109)**: 
    - **PostgreSQL (Prisma - LedgerEntry)**: ABSOLUTNE Jedyne Źródło Prawdy (SSoT) dla wszystkich wskaźników finansowych. Firestore jest dla finansów WYŁĄCZNIE lustrem odczytu (`LEDGER_DERIVED`).
    - **Firestore (Operational Primary)**: Nadrzędne źródło dla danych technicznych/operacyjnych środków trwałych (Assets) oraz cache dla szybkich operacji UI.
    - **PostgreSQL (Prisma - Master Entities)**: SSoT dla kontrahentów, projektów i ramy strukturalnej systemu.
- **AI**: Gemini 3.0 Flash (OCR & Analiza) via `@google/generative-ai`.
- **Finanse**: `decimal.js` wykorzystywany w `financeMapper.ts` oraz w Central Ledgerze.

### 🔴 Lazy Initialization (Build Safety)
Inicjalizacja `firebaseAdmin.ts` MUSI być leniwa (gettery), aby uniknąć błędów podczas buildu na Vercelu (brak envs).

---

## 🧾 2. Logika KSeF i Parsowanie XML (FA/3)

### KSeF Handshake (JWT Protocol):
1. **Challenge** (`/v2/auth/challenge`).
2. **Encryption** (token|timestampMs via RSA-OAEP SHA-256).
3. **Init & Redeem** (Otrzymanie `SessionToken`).

### Parsowanie XML (Strict Mapping):
- **Pole <P_15>**: System traktuje je jako kwotę brutto dokumentu (np. `676.01` zł).
- **Stawki VAT**: Obsługa mapowania 23%, 8%, 5% oraz stawek zwolnionych (P_13_7).
- **Zasada Context Binding (Vector 098.2)**: Dekodowanie XML odbywa się zawsze przez `update` rekordu metadanych za pomocą `ksefId`.

---

## 💰 3. Silnik Finansowy (DNA Vector 099)

### Reguła Mapowania:
- **Koszty (Purchases)**: Netto (-), VAT (+) jako tarcza, Brutto (-).
- **Przychody (Sales)**: Netto (+), VAT (-) jako dług, Brutto (+).

### Safe to Spend:
Obliczany dynamicznie: `Wpływy - Rezerwa CIT (9%) - VAT Należny + VAT Naliczony - Faktury do zapłaty`.

---

## 🛡️ 4. Standardy Kodowania i Integrity Vectors

- **Vector 098.1 (Duplicate Shield)**: Rygorystyczny `findUnique` przed zapisem faktury wykorzystujący `ksefId` jako klucz unikalny. To zapewnia, że żadna faktura MF nie zostanie zapisana dwukrotnie, nawet jeśli sync zostanie przerwany.
- **Vector 101.1 (Liquidity-First Architecture)**: Dashboard i Lista Projektów stosują model **Real Cash Inflow**.
    - **Math Logic**:
        - `retentionMultiplier = 1 - retentionRate`
        - `NetOperatingLimit (Paliwo) = budgetEstimated * retentionMultiplier`
        - `NetInflowActual = totalIncomesNet * retentionMultiplier`
    - **Visual**: **Double-Layer Locking** – Pasek postępu posiada stałą strefę `locked-zone` (ostatnie $x$% tracka) z ikoną kłódki 🔒.
    - **Interaction**: Interaktywne podpowiedzi (Tooltip Help) wyjaśniają parametry językiem korzyści płynnościowej.
- **Vector 103 (Gatekeeper Flow)**: Nowy standard importu. Zamiast zapisu bezpośrednio do bazy `Invoice`, dane wpadają do tymczasowej tabeli `KsefInvoice` (Inbox). Dopiero po akceptacji Wizjonera (Deep Sync), są migrowane do właściwych struktur finansowych.
- **Vector 058 (Serializable Actions)**: Server Actions zwracają `{ success, results, error }`.
- **Vector 061 (Bank CSV)**: Obsługa `win1250` i separatora `;` dla PKO BP.
- **Vector 104 (Bank Reconciliation Engine)**: Silnik rozliczeniowy PKO BP.
    - **Mapping**: Col 0 (Data), Col 3 (Kwota), Col 6 (Nadawca/Odbiorca), Col 8 (Tytuł).
    - **Level 1**: Regex match `/(FV|FA|FAKTURA|RACH)\s?[\w\d\/]+/i` on Col 8.
    - **Level 2**: Fuzzy match Col 6 + Exact Amount on Col 3.
- **Vector 105 (Data Authority Hierarchy)**:
    - **Master**: KSeF (XML) – nadrzędne źródło metadanych księgowych (NIP, Kwoty, Rachunek).
    - **Reconciler**: Bank CSV – służy wyłącznie do parowania i oznaczania faktur jako PAID.
    - **Shadow Costs**: Automatyczna klasyfikacja jako `DirectExpense` dla ZUS, US, Żabka, Tax oparta na nazwie kontrahenta.
- **Vector 098.3 (Double-Shield Anchor)**: Dwustopniowa walidacja unikalności: Tier 1 (ksefId) + Tier 2 (contractorId + invoiceNumber).
- **Vector 106 (Financial Truth & UI Decoupling)**:
    - **Philosophy**: Przejście z modelu "Data Entry" na "State Verification".
    - **Absolute Anchor**: Fizyczne saldo z wyciągu bankowego (PKO BP Col 9) jest nadrzędną prawdą.
    - **Integrity Engine**: Funkcja `verifyIntegrity` porównuje sumę ledgerów (`ledgerSum`) z fizycznym saldem (`physicalBalance`).
    - **Status Machine**:
        - `VERIFIED_STABLE`: Delta wynosi 0. System jest zsynchronizowany z bankiem.
        - `DISCREPANCY_ALERT`: Delta > 0. Wykryto lukę w księgowaniu / brakujące transakcje.
    - **UI Enkapsulacja**: Usunięcie importów z Dashboard/Project views. Centralizacja w `/finance/verify-balance`.
- **Vector 107 (Central Ledger Engine)**:
    - **SSoT**: Tabela `LedgerEntry` staje się ostatecznym źródłem prawdy. Wszystkie wskaźniki (Real Cash, Fuel, Vault) są sumowane WYŁĄCZNIE z tej tabeli.
    - **Mapping Principles (Signs)**:
        - `INCOME`: Przychód netto z faktury (+).
        - `EXPENSE`: Koszt netto z faktury/shadow (-).
        - `VAT_SHIELD`: Kwota VAT. Dodatnia (+) dla zakupów (tarcza), ujemna (-) dla sprzedaży (dług).
        - `RETENTION_LOCK`: Kwota kaucji (+). Zamrożona w wirtualnym "Skarbcu".
    - **Flow**:
        - `createInvoice`: Synchroniczne `createMany` (Net, VAT, Retention).
        - `executeAutoMatch` (Payment): Generowanie `BANK_PAYMENT` entry (Cash Flow).
- **Vector 115: Asset Management Engine (Hardened)**:
    - **SSoT Strategy**: Dual-Sync mandatory. Write once to Firestore (NoSQL) and mirror to Prisma (Postgres).
    - **Asset Hardening**: Expanded operational fields (VIN, Registration, Insurance, Tech Inspection).
    - **Duplicate Shield**: Tier 1 (Invoice bound) + Tier 2 (Name/Date/Value bound) unique markers.
    - **KSeF Synergy**: 1-click conversion from Invoice to Asset.
- **Vector 108: Dual-DB Consistency Engine**:
    - **Authority Layer**: FS (Operational Primary for Assets) -> SQL (Analytical Reconciler).
    - **Audit Engine**: `SyncAuditRecord` in SQL tracks field-level drift.
    - **Sync Health**: Dashboard `/finance/sync-health` with Side-by-Side Diff View for manual repair.
- **Vector 109: Data Authority Finalization**:
    - **Lock Down**: Wyeliminowanie "dual-primary". Każda domena danych ma jednego właściciela (Master).
    - **Financial Master (PG)**: Agregaty Dashboardu MUSZĄ pochodzić z `LedgerService` (Postgres). Zakaz sumowania z Firestore dla wskaźników KPI.
    - **Operational Master (FS)**: Środki trwałe (Asset registry) zapisywane najpierw do FS. Konsekwencje finansowe zakupu -> synchronicznie do PG Ledger.
    - **Write Guards**: Mechanizm `assertAuthorityWrite` blokuje próby zapisu do bazy będącej mirror'em dla danej domeny.
- **Vector 111 (Financial Transparency – Invoice Drill-Down)**:
    - **Interactive Details Modal**: Kliknięcie na pola kwot (Przychody, Koszty, Marża) otwiera tabelaryczny breakdown wszystkich faktur powiązanych z projektem.
    - **Columns**: Data | Nr Faktury | Kwota Netto | Kwota Brutto | Kontrahent | Typ Faktury.
    - **Subsumming**: Modal pokazuje szczegóły netto i brutto RAZEM (suma wszystkich faktur) na dole.
    - **Filter Logic**: Przychody = `['SPRZEDAŻ', 'INCOME', 'REVENUE', 'PRZYCHÓD']` | Koszty = `['KOSZT', 'EXPENSE', 'ZAKUP', 'WYDATEK']` | Marża = obie razem.
    - **UX Signal**: Hover effect (opacity-75) + cursor-pointer na kwotach sygnalizuje interaktywność.
    - **Implementation**: Komponent `ProjectFinancialDetailsModal.tsx` renderowany w `InteractiveProjectList.tsx`.
- **Vector 112 (Retention Rate Integrity Engine)**:
    - **Problem**: Firestore `set({...}, {merge: true})` z wartościami 0 były czasem ignorowane (0 jest "falsy" w JS).
    - **Solution**: Zamiana na `update()` dla explicit field overwrite - gwarantuje że 0% kaucji będzie zawsze zapisane.
    - **Failsafe**: `getProjects()` konwertuje null/undefined retention rates na 0: `Number(data.retentionShortTermRate ?? 0)`.
    - **Math Integrity**: Żaden fallback do default 10% - respect user-configured rates absolutnie.
    - **Dual-DB Sync**: Pisanie do POSTGRES (SSoT), mirror na FIRESTORE z guaranteed field update.
    - **UI Consistency**: Dashboard (`page.tsx`) i Projects List (`InteractiveProjectList.tsx`) obie używają ten sam failsafe logic - zero risk rozbiezności.
- **Vector 113 (Transparent Contract Hierarchy)**:
    - **UX Hierarchy**: Tooltip pokazuje hierarchię kontraktu: 📋 UMOWA (Całkowita kwota) → 🔒 KAUCJA (Zabezpieczenie) → 💚 DOSTĘPNE (Rzeczywista płynność)
    - **Label Clarity**: Zmiana z "Base operational liquidity (90%)" na "Dostępne do Operacyjnego Wydania" (unika mylącego oznaczenia %)
    - **Pro ERP Standard**: Nowoczesne ERP'y (SAP, Oracle, AXE) używają "Available for Operations" - nasz system podąża tą praktyką
    - **UX Signal**: Kliknięcie na kwoty (przychody/koszty/marża) otwiera modal ze szczegółami faktur - transparentność bez możliwości błędu
    - **Implementation**: Komponenty `InteractiveProjectList.tsx` (global summary card + project cards) i `ProjectFinancialDetailsModal.tsx` (modal pull)
- **Vector 110: Stability-First Mode**:
    - **Philosophy**: Najwyższym priorytetem jest determinizm i integralność procesów biznesowych (A-F).
    - **PG-First Rule**: Wszystkie akcje finansowe (Faktury, Płatności, Rozliczenia) MUSZĄ najpierw zapisać stan w PostgreSQL (Master), a dopiero po sukcesie wykonać synchronizację lustra Firestore (Mirror).
    - **Atomic Transactions**: Wykorzystanie `prisma.$transaction` dla każdego zdarzenia biznesowego, aby objąć zapis encji Master oraz wpis do Ledgera w jedną niepodzielną operację.
    - **Integrity Monitor**: Regularna weryfikacja dryfu (FS vs PG) za pomocą `IntegrityMonitor`.
- **Regex Entity Engine**: Wyciąganie NIP/IBAN z opisów bankowych z lookaheadami.
- **Vector 114 (Hardened Date Engine)**:
    - **Philosophy**: Logika dat KSeF jest "authoritative" i scentralizowana.
    - **SSoT**: Moduł `ksefDateUtils.ts` jest jedynym źródłem prawdy dla obliczeń kalendarzowych.
    - **Normalization**: Wszystkie daty są normalizowane do `Europe/Warsaw` (`YYYY-MM-DD`) przed walidacją, co eliminuje błędy DST i drift UTC.
    - **Server-Side Authority**: Backend (/api/ksef/*) samodzielnie wymusza limit 90 dni, niezależnie od stanu UI.
    - **Logging**: Każda operacja KSeF loguje `raw_input`, `normalized_range` i `calculation_result` for auditing.
- **Vector 116 (Contractor Intelligence Engine - HARDENED)**:
    - **Objective**: Unified Identity Resolution Layer mapping IBANs to NIPs.
    - **Constraints**: Tenant-scoped uniqueness (`@@unique([tenantId, iban])`).
    - **NIP Validation**: Mandatory 10-digit check + Mathematical Checksum validation.
    - **Conflict Protocol (Fail-Hard)**: Re-assignment of IBAN to different Contractor triggers `IdentityConflictRecord`.
    - **Normalization**: Advanced stripping of legal forms (Sp. z o.o., S.A.) and Polish diacritics.
    - **Idempotency**: Atomic `upsert` on identity links ensures zero redundant writes.
    - **Layer Isolation**: Identity Resolution is decoupled from Financial Truth (Vector 107/110).

---

## 📜 5. Change Log & Bug Recovery (History)

| Vector | Feature / Fix | Note |
| :--- | :--- | :--- |
| **092** | Gemini 500 Crash | Switching to Serializable Responses. |
| **094** | Type Mismatch | Enforcing NIP as String in Prisma. |
| **099** | Central Mapper | Unification of financial signs (+/-). |
| **098.2** | XML Context | Binding Phase 2 to metadata ID. |
| **101** | Real Cash Reality | Vector 101 Recalibration: Focus on 90% Real Inflow (Net) as primary metric. |
| **102.2** | Retention Fork | Decision Modal for Future vs Retroactive retention recalculation. |
| **099** | Smart Enrichment | Contractor data (IBAN/Address) enriched from XML via Enrichment Proposals. |
| **103** | KSeF Gatekeeper | Inbox buffer (KsefInvoice) for selective document import approval. |
| **104** | Bank Reconciliation | PKO BP 2-level automated settlement engine (Vector 104). |
| **106** | Financial Truth | UI Decoupling and Bank Balance Anchor (Vector 106). |
| **107.A** | Asset Module | 1-click KSeF to Asset conversion (Vector 115).|
| **109** | Data Authority | Vector 109: Final lock of write direction and domain ownership. |
| **110** | Stability-First | PG-First logic enforcement & Atomic Transactions (Vector 110). |
| **111** | Drill-Down | Financial Transparency - Drill-Down (Vector 111). |
| **114** | Date Engine | Authoritative Warsaw-based date validation (Vector 114). |
| **116** | Contractor Intelligence | HARDENED Identity Resolution Layer (NIP Checksum & Conflict Protocol). |
| **117** | Mobile Responsive Shell | HARDENED Mobile Drawer, Top App Bar & Full-Screen Modal Strategy. |

---

## 🧪 6. Founder Acceptance Flows (A-F)
Mandatory verification checklist for every deployment:
- **Flow A (Structure)**: Contractor → Project → Retention setup.
- **Flow B (Income)**: Sales Invoice → LedgerEntry → Dashboard (Liquidity Update).
- **Flow C (Cost)**: Cost Invoice → LedgerEntry → VAT Shield calculation.
- **Flow D (Settlement)**: Bank CSV → Match Engine → Invoice Status: PAID.
- **Flow E (Integrity)**: KSeF Inbox → Approval → Duplicate Shield Check.
- **Flow F (Recovery)**: Sync Drift detection → Manual Repair via Sync Health.

---

## 🚀 7. Deployment Discipline
From now on, no architectural update is considered complete without:
- **Database Consistency**: Successful `prisma migrate deploy` on production (Vercel).
- **Dual-DB Audit**: Verified side-by-side consistency check (Postgres vs Firestore).
- **Integrity Seal**: Running `verify-stabilization.ts` script to ensure Vector 110 compliance.

---
*Plik utrzymywany przez Antigravity dla kolejnych sesji AI.*
