# Database Schema & Data Models

## Multi-tenancy Architecture
- **Tenant Isolation:** Every operational record (Contractor, Project, Invoice, Transaction, InvoicePayment) contains a `tenantId`.
- **Access Control:** Queries are strictly scoped by `tenantId` to ensure data isolation between different organizations.
- **Audit Logging:** Global `AuditLog` table records all mutations (`action`, `entity`, `details`) linked to a specific user and tenant.

## Core Models

### Entities
- **Tenants:** Organization/Company definition.
- **Users:** Authentication and RBAC (Roles: OWNER, MANAGER, etc.).
- **Contractors:** Baza firm (GW, Investors). Indexed by `tenantId`.
- **Objects:** Physical locations/sites linked to Contractors.

### Operations
- **Projects:** Central execution hub. Links Contractor, Object, and Financials. Tracks `budgetEstimated` (Decimal).
- **Invoices:** Formal accounting documents (Income/Cost). Statuses: `ACTIVE`, `PARTIALLY_PAID`, `PAID`, `REVERSED`.
- **Transactions:** Actual cash flow events in the Append-Only Ledger.
- **InvoicePayment:** N:M join table linking Invoices to Transactions.

## InvoicePayment – N:M Relation (New in v0.3.0)

This model replaces the former 1:1 `Payment` model and enables:
- **Partial Payments:** One invoice can be covered by multiple transactions over time.
- **Split Transactions:** One bank payment can be split across multiple invoices.
- **Cumulative Reconciliation:** Invoice status is calculated from the sum of all related `InvoicePayment.amountApplied` values.

```
Invoice ──< InvoicePayment >── Transaction
              amountApplied
              createdAt (no updatedAt - immutable)
```

### Immutability Enforcement
The `InvoicePayment` model has **no `updatedAt` field**, making it impossible to track mutations — enforcing the Append-Only principle at the schema level. Errors are corrected via a new `InvoicePayment` with a negative `amountApplied` linked to a reversal `Transaction`.

## Implementation Details
- **Type Precision:** All monetary values use PostgreSQL `DECIMAL(12,2)`. JS layer uses `decimal.js` exclusively.
- **Audit Trail:** Automatic timestamping (`createdAt`, `updatedAt`) for all mutable records.
- **Safe Resets:** Build-in `TRUNCATE CASCADE` logic for operational tables.

## Indexing Strategy (Performance & Multi-Tenancy)

All organization-bound models carry `@@index([tenantId])`. High-frequency composite indexes:

| Model | Index | Purpose |
|---|---|---|
| `Transaction` | `(tenantId, transactionDate)` | Dashboard aggregations, date-range filters |
| `Invoice` | `(tenantId, dueDate)` | Cash flow projection queries |
| `Invoice` | `(tenantId, status)` | Reconciliation: filter `ACTIVE`/`PARTIALLY_PAID` |
| `Project` | `(tenantId, status)` | Project pipeline views |
| `InvoicePayment` | `(invoiceId)` | Calculate total paid per invoice |
| `InvoicePayment` | `(transactionId)` | Reverse lookup: which invoice a transaction covers |
| `InvoicePayment` | `UNIQUE(invoiceId, transactionId)` | Prevent duplicate payment entries |

## Event Integrity (Idempotency)
- `ProcessedEvent` table tracks unique `eventId` from external sources (PKO BP CSV) to prevent record duplication.

## Append-Only Ledger Standards
All `Transaction` records follow the ledger pattern:
- `status`: (`ACTIVE`, `REVERSED`, `DRAFT`) — governs record mutability.
- `source`: (`MANUAL`, `INVOICE`, `BANK_IMPORT`) — tracks origin of funds.
- `reversalOf`: Pointer to the reversed transaction's UUID.
- `externalId`: Unique identifier for external system integration.
