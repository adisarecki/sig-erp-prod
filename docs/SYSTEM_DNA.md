# SYSTEM DNA – Single Source of Truth (NoSQL Edition)

This document contains the core technical rules, models, and logic of the SIG ERP system. It is the primary reference for AI Agents and developers.

## 1. Database Architecture: Cloud Firestore (NoSQL)

### Multi-tenancy Isolation
- **Tenant Scope**: Every document in Firestore (`contractors`, `projects`, `invoices`, `transactions`, `legacyDebts`, etc.) must contain a `tenantId` field.
- **Security Rule**: Queries and writes are strictly restricted by `tenantId` in the Backend API layer.

### Key Collections & Document Schema
- **Invoices**: Logical documents containing `amountNet`, `amountGross`, `taxRate`, `issueDate`, `dueDate`, `status` (`ACTIVE`/`PAID`), and `externalId` (Nr faktury).
- **Transactions**: The Append-Only Ledger. Records of actual cash flow (`PRZYCHÓD`/`KOSZT`).
- **LegacyDebts**: Management of pre-system liabilities with automated installment generation.

### Manual Uniqueness (NoSQL Shield)
Since Firestore lacks native unique constraints on fields, the system implements **Manual Uniqueness Checks** in Server Actions before writing to sensitive collections (`invoices`).

---

## 2. Security: Fort Knox (Gatekeeper)

### Authentication & Authorization
- **Provider**: Firebase Auth (Google Sign-In).
- **Gatekeeper Layer**: A mandatory React wrapper (`Gatekeeper.tsx`) that blocks the entire `/src/app` for unauthorized users.
- **Whitelist**: Hardcoded list of authorized emails (CEO & Partners). Only whitelisted users can pass the Gatekeeper.

### API Security
- **Server-Side Validation**: Every server action verifies the `tenantId` and `userSession` via Firebase Admin SDK.

---

## 3. Finance Engine & Accounting Logic

### Append-Only Ledger
All financial movements are recorded as immutable `Transaction` documents. Errors are corrected via Reversals (`reversalOf`), never by deleting original data.

### Double-Entry Logic (NoSQL Implementation)
1. **Invoice Registration**: Creates an `invoice` document with status `ACTIVE`.
2. **Payment Confirmation**: Updates `invoice` status to `PAID` AND creates a linked `transaction` document.
3. **Dashboards**: Aggregate data in real-time from these two collections using `Decimal.js` for 100% precision.

---

## 4. Premier League Management (Ekstraklasa)

To najwyższy poziom kontroli finansowej, wdrożony w architekturze NoSQL.

### Advanced Tax Guard (Ochrona Podatkowa)
System automatycznie oblicza i blokuje środki na przyszłe podatki:
1.  **VAT Netto**: `Suma VAT z faktur INCOME (PAID) - Suma VAT z faktur COST (PAID)`.
2.  **Total Tax Reserve**: `(Zysk Netto * 19%) + VAT Netto`.
3.  **Czysta Gotówka (Clean Cash)**: `Płynna Gotówka - Total Tax Reserve`. To jest kwota wolna od obciążeń fiskalnych.

### Cash Reality Simulator (Symulator Realizmu)
System zakłada scenariusz bezpieczny dla płynności:
1.  **REVENUE_BUFFER = 14 dni**: Wszystkie prognozowane wpływy (nieopłacone faktury przychodowe) są w symulacji przesuwane o 14 dni w przód.
2.  **Koszty bez Zmian**: Wszystkie zobowiązania kosztowe pozostają przy swoich pierwotnych terminach.
3.  **Alert Płynności**: Jeśli symulacja "Realista" spadnie poniżej zera w ciągu 30 dni – system wyświetla krytyczne ostrzeżenie.

---

## 5. Tarcza Anty-Dubel (Anti-Double Shield)

Rygorystyczna blokada duplikacji w warstwie logicznej NoSQL. Przed zapisem każdej faktury, system wykonuje zapytanie sprawdzające:
- **`tenantId` + `contractorId` + `externalId` (Numer Faktury) + `type`**.
Jeśli dokument o takich parametrach już istnieje, zapis zostaje zablokowany z komunikatem błędu dla użytkownika.
ynności**: Jeśli symulacja "Realista" spadnie poniżej zera w ciągu 30 dni, system wyświetla czerwone ostrzeżenie na Dashboardzie.
