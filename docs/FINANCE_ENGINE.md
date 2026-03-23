# Finance Engine & Accounting Logic

## Accounting Core
- **Base Units:** All calculations (Profit, Liquid Cash, Tax Reserve) must be performed on **NET** amounts.
- **Tax Handling:** Mandatory VAT rate calculation: `Net * VAT Rate % = VAT Amount`.
- **Precision:** All monetary operations use `decimal.js` on the server. The database layer uses PostgreSQL `DECIMAL(12,2)`. The UI receives pre-formatted strings — never raw floats.

## KPIs & Logic

### Profit First (Safe Withdrawal)
- **Algorithm:** `Liquid Cash (Net) - Upcoming Liabilities (30d Gross) - Tax Reserve (9% of Net Profit)`.
- **Purpose:** Protects management capital by ensuring all future obligations and taxes are covered before determining payout availability.

### Cash Flow Projection
- **Source of Truth:** Invoices' `dueDate` and Liabilities' `paymentDayOfMonth`.
- **Horizon:** 30-day looking forward visualization of combined income and expenses.

---

## Reconciliation Engine

The Reconciliation Engine automatically pairs bank transactions (`BankTransactionRaw`) with unpaid invoices using a multi-factor confidence scoring algorithm.

### Confidence Score Algorithm

The score is composed of up to 3 independent signals:

| Signal | Weight | Condition |
|---|---|---|
| **Amount Match** | +0.40 | `transaction.rawAmount === invoice.amountGross` (exact, using `Decimal.equals()`) |
| **Invoice Number in Description** | +0.50 | `normalizeText(description).includes(normalizeText(invoice.externalId))` |
| **Contractor Name Fuzzy Match** | up to +0.30 | Levenshtein similarity > 0.6: `weight = similarity * 0.3` |

**Final Score:** `confidence = min(sum_of_signals, 1.0)`

### Confidence Tiers

| Tier | Range | Action |
|---|---|---|
| **AUTO** | `>= 0.95` | Marked for automatic processing; excluded from manual review UI |
| **REVIEW** | `0.60 – 0.94` | Displayed in "Poczekalnia Sugestii" (UI) for one-click manual approval |
| **REJECT** | `< 0.60` | Filtered out; not shown anywhere |

### Color Coding in UI
- 🟢 **Green Badge** (`≥ 80%`): High confidence, likely correct.
- 🟡 **Amber Badge** (`60–79%`): Moderate confidence, requires visual verification.

### Normalization Layer
Before any text comparison, strings are processed by `normalizeText()`:
```
lowercase → NFD decomposition → remove diacritics → remove special chars → collapse spaces
```

### Levenshtein Distance
Used for contractor name fuzzy matching. Similarity score: `1 - (distance / max_length)`. Only similarities `> 0.6` contribute to the confidence score.

### Split & Partial Payments
- One `BankTransactionRaw` can be split across **multiple** invoices.
- Each split creates one `Transaction` + one `InvoicePayment` record.
- Invoice status is recalculated after each split: `PAID` if `totalPaid >= amountGross`, otherwise `PARTIALLY_PAID`.

### Bank Commission & VAT Tolerance
> [!NOTE]
> When matching by amount, the engine uses **exact** comparison via `Decimal.equals()`. This prevents rounding errors but may cause near-misses for transactions with bank commissions deducted. Future: add configurable tolerance (`±0.50 PLN`) as a secondary check.

### Reversal Mechanism
If an incorrect reconciliation is created, a correcting reversal entry is created:
1. A new `Transaction` with `type = "KOREKTA"` and `reversalOf = originalTransactionId` is created.
2. A new `InvoicePayment` links the reversal transaction to the invoice with a **negative** `amountApplied`.
3. The invoice status is recalculated automatically.
4. The original records are **never modified or deleted** (Append-Only Ledger principle).

## Data Entry Protocols
- **Standard Documents:** Every financial movement must be backed by an `Invoice` record.
- **Idempotency:** `ProcessedEvent` table tracks unique `eventId` from external sources (PKO BP CSV) to prevent duplicates.
- **Mobile Friendly:** Numeric-first input modes for fast decimal value entry.
