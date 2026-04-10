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

### Safe to Spend (Vector 117):
Obliczony dla MAKSYMALNEGO bezpieczeństwa: `Saldo Bankowe - Dług VAT - Rezerwa CIT (9%) - Kaucje (Skarbiec) - Zobowiązania (Unpaid Payables)`.
- **Należności (Receivables)** są wyświetlane w UI dla wizji przyszłości, ale **NIGDY** nie są zaliczane do Safe-to-Spend przed fizyczną płatnością.

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
- **Vector 120 (Bank Reconciliation Hub - Landing Zone)**:
    - **Staging Model**: New `BankStaging` table acts as an immutable landing zone for all CSV imports.
    - **Status Machine**: `PENDING` (Imported) -> `SUGGESTED` (Auto-Matched) -> `PROCESSED` (Finalized).
    - **Triage UI**: A separate reconciliation hub (VerifyBalanceClient) allowing manual human verification.
    - **On-the-fly Create**: Automated transaction creation for unmapped transfers (DirectExpense) with category prediction via historical `counterpartyRaw` lookup.
    - **Master Sync**: Real-time Saldo Anchor update via `revalidatePath` after every Triage action.

- **Vector 117.3 (Retention Handover Protocol)**:
    - **Aggregation**: Upon project closure, the system sums all `RETENTION_LOCK` entries in the Ledger (The Truth).
    - **Split**: The accumulated sum is split into `SHORT_TERM` (Warranty) and `LONG_TERM` (Stat. Liability) retention entries.
    - **Expiry Logic**:
        - Short Term Date: `Completion + Warranty Period`.
        - Long Term Date: `Completion + 5 Years`.
    - **Migration**: Records are created in the Global Vault (`Retention` model) with `source: HANDOVER`.

- **Vector 121 (Digital Banking UI Standards)**:
    - **Revolut-style Cards**: Use high-contrast gradients, glassmorphism icons, and bold "Monzo-style" typography (Outfit/Inter).
    - **Title Normalization**: PKO BP titles (Col 8) are cleaned from technical placeholders (NRB, PL, ...) to show human-readable purpose.
    - **Contextual Grouping**: Transactions are grouped by Date (Today, Yesterday) with sticky headers.

- **Vector 130 (GUS BIR 1.1 - Smart Onboarding)**:
    - **Technical Engine**: SOAP 1.1 client for BIR 1.1 (`DaneSzukajPodmioty`).
    - **Auth Protocol**: `Zaloguj(apiKey)` handshake returning `sid`.
    - **Session Persistence**: Server-side module-level caching of `sid` with 60-min TTL.
    - **Mapping**: Dynamic mapping of `Nazwa`, `Regon` and formatted address (`ul. [street] [nr]/[local], [zip] [city]`).
    - **UI Automation (Smart Form)**: 
        - Dual-trigger: Auto-fetch on 10th digit NIP entry + Manual 🔍 button.
        - Idempotency/Clearing: Changing NIP after fetch clears dependent fields to prevent data mismatch.
        - UX Signal: Green flash transition on auto-populated fields.

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
| **117** | Retention Engine & Liquidity Alerts | Dynamic retention-aware payment matching + VAT/Retention monitoring (Vector 117). |
| **120** | Bank Reconciliation Hub | Transition from Silent Imports to manual Triage Hub with Staging Zone. |

---

## � 7. Vector 117: Retention-Aware Payment Engine & Liquidity Monitoring

### Architecture
The system now implements intelligent retention calculations at the moment of bank payment matching. Unlike manual entry, bank reconciliation is PROJECT-AWARE and dynamically calculates expected payment amounts based on the invoice project's retention settings.

### Dynamic Expected Payment Logic
When a bank payment is matched to an invoice, the system calculates `expectedAmount`:

**If Project.retentionBase == NET**:
```
Formula: Expected = Brutto - (Net × Rate)
Example: Invoice Net 10,000 PLN, VAT 2,300 (23%), Rate 10%
Result: 12,300 - (10,000 × 0.10) = 11,300 PLN expected
```

**If Project.retentionBase == GROSS**:
```
Formula: Expected = Brutto × (1 - Rate)
Example: Same invoice, Rate 10%
Result: 12,300 × (1 - 0.10) = 11,070 PLN expected
```

### Automatic Settlement
When actual payment matches expected amount (within ±1 cent tolerance):
1. Invoice status → `PAID`
2. Create `RETENTION_LOCK` ledger entry (vaults retention in The Vault)
3. Create `Retention` record for tracking/release
4. Trigger post-match liquidity checks

### Ledger Entries for Retention
```
Type: INCOME
Amount: +10,000 PLN (Net)

Type: VAT_SHIELD
Amount: -2,300 PLN (VAT Debt for sales)

Type: RETENTION_LOCK
Amount: +1,230 PLN (Vaulted when payment received)
```

### Liquidity Alert System (Files: `liquidity-alerts.ts`)
Automated monitoring triggers:
- **⚠️ Retention Underpayment**: When received < expected (> 100 PLN or > 5%)
- **⚠️ High VAT Debt**: When VAT liab > 50% of cash balance
- **ℹ️ Retention Vault**: When locked > 30% of cash balance
- **🚨 CRITICAL**: When safe-to-spend < 0

### Safe-to-Spend Formula (Vector 117.B Edition)
```
SafeToSpend = RealCashBalance - VAT_Debt - Retention_Vault - Unpaid_Payables

Where:
- RealCashBalance = SUM(BANK_PAYMENT entries) - SUM(SHADOW_COST) in Ledger
- VAT_Debt = ABS(negative VAT_SHIELD entries)
- Retention_Vault = SUM(RETENTION_LOCK entries)
- Unpaid_Payables = Sum of all unpaid cost invoices (Accounts Payable)
```
*Note: Unpaid Receivables are EXCLUDED from this formula for liquidity safety.*

### Implementation Files
- **Engine**: `src/lib/bank/reconciliation-engine.ts` (automatic matching)
- **Alerts**: `src/lib/finance/liquidity-alerts.ts` (monitoring)
- **Service**: `src/lib/finance/ledger-service.ts` (Safe-to-Spend calculation)
- **Purge Script**: `scripts/vector-117-purge.ts` (test data cleanup)
- **Test Script**: `scripts/vector-117-test.ts` (verification)

### Test Case
**Scenario**: 10,000 PLN Net invoice with 10% retention (GROSS base)

**Expected Results**:
- ✓ Invoice Margin: +10,000 PLN (Net)
- ✓ Vault (Skarbiec): +1,230 PLN (locked)
- ✓ Expected Payment: 11,070 PLN
- ✓ Safe-to-Spend (approx): 9,840 PLN (after retention deduction)

**Verification**: Run `npx ts-node scripts/vector-117-test.ts`

### Sync Drift Diagnostic & Repair Engine (Dual-DB Consistency)
**Problem**: During development/testing, Firestore and PostgreSQL can drift (orphaned documents in FS, missing records in PG).

**Solution**: 
- **API Endpoint**: `GET/DELETE /api/maintenance/sync-drift?tenantId=<TENANT_ID>`
  - `GET`: Returns detailed comparison of invoices in both systems
    - Shows which invoices exist in Firestore but not PostgreSQL (orphaned)
    - Shows which invoices exist in PostgreSQL but not Firestore (PG-only)
    - Detailed sync status with amounts and creation dates
  - `DELETE`: Removes orphaned invoices from Firestore (for test data cleanup)

- **Diagnostic Script**: `npx tsc scripts/diagnose-sync-drift.ts --outDir ./.ts-build --skipLibCheck --esModuleInterop && node .ts-build/diagnose-sync-drift.js`
  - Shows PostgreSQL invoice counts by tenant
  - Useful for understanding current state before API calls

**Architecture**:
- Queries both Firestore (operational primary) and PostgreSQL (financial master)
- Identifies orphaned documents in either system
- Provides repair options: delete from FS or sync to PG
- Essential for maintaining data integrity between dual databases

---

## 📱 8. Responsive System & Layout Primitives

### Core Strategy:
- **Responsive Shell**: Split layout logic in `layout.tsx`. Persistent Sidebar (Desktop) vs `MobileNav` (Sheet-based Drawer).
- **Client Isolation**: `MobileNav` and `Sheet` components are "use client" to avoid converting the root layout to a client component.
- **Drawer Pattern**: High-density forms (Register Income/Cost) and tables use the `max-w-none h-[92vh] sm:h-auto` pattern for a native-like bottom drawer experience on small screens.

### Layout Primitives:
1. **<PageContainer />**: Standardized wrapper for page content. Handles responsive padding (`px-4 sm:px-6 md:px-8`) and consistent max-width.
2. **<TableWrapper />**: Essential for accessibility. Enforces `overflow-x-auto` with a clean border/shadow, preventing layout blowouts from wide financial tables.
3. **Dialog Hardening**: `dialog.tsx` (shadcn) updated with responsive positioning classes. Centers for desktop, anchors to bottom for mobile.

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
