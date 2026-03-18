# Sig ERP – Strategic Overview & Technical Context (AI_look.md)

This document is the **Strategic Brain** and **Technical Anchor** of the project. It is intended for both the **USER** and for **Conversational AI** (Gemini, ChatGPT) to ensure 100% context synchronization.

---

## 🚀 1. AI Drogowskazy (Signposts for Assistants)

To maintain the "Money Constitution," follow these strict rules:

### 🛠 Coding Standards
- **Zero Trust Architecture**: Never assume data is valid until it passes through a Gatekeeper API (Zod + decimal.js).
- **Backend First**: Complex logic (OCR parsing, financial math) belongs on the backend, not the client.
- **Prisma Precision**: Use Prisma Agregates for KPIs. Avoid fetching raw records for JS-side summation.
- **Mobile First**: All UI components must support touch targets (min 44px) and numeric input modes.

### 💰 The Money Constitution
1. **Integer Cents**: All internal math uses integer cents (`amountCents`).
2. **Decimal.js**: Use `decimal.js` for all string/float to integer conversions. Rejects the draft if `net + vat != gross`.
3. **Immutability**: Financial records are Append-Only. Errors = Reversal entries, never `UPDATE` or `DELETE`.
4. **NET-Based**: Dashboard KPIs are calculated using **NET** amounts unless stated otherwise.

---

## 🏗 2. Architecture & Tech Stack

- **Framework**: Next.js 15 (App Router) + TypeScript.
- **Database**: PostgreSQL (Neon) + Prisma ORM.
- **Security**: RBAC (OWNER, MANAGER, EMPLOYEE) + Multi-tenancy (`tenantId` isolation).
- **Idempotency**: `ProcessedEvent` table prevents duplicate processing of bank/external imports.
- **Stability**: Stable Hydration Pattern (Charts) using `isMounted` hooks.

---

## 📄 3. API Contracts & Data Flow

### OCR Pipeline (Zero Trust)
1. **Frontend (`InvoiceScanner.tsx`)**: Raw file upload to `/api/ocr/scan`.
2. **Engine (`/api/ocr/scan/route.ts`)**: Gemini 1.5 Flash (Multimodal) extracts raw `OcrInvoiceData`.
3. **Gatekeeper (`/api/intake/ocr-draft/route.ts`)**: 
   - **Validation**: Zod schema.
   - **Amounts**: String → Integer Cents conversion.
   - **Logic**: If `dueDate` is empty/text ("Zapłacono"), set `dueDate` = `issueDate`.

### Payload Specification (POST `/api/intake/ocr-draft`)
| Field | Type | Validation |
|---|---|---|
| `nip` | `string` | Exactly 10 digits |
| `netAmount` | `string` | Decimal string (e.g. "125.50") |
| `type` | `enum` | `"COST"` or `"INCOME"` |
| `tenantId` | `N/A` | **FORBIDDEN** (Server-injected) |

---

## 🔍 4. Finance & Reconciliation Engine

### Logic Rules
- **Safe Withdrawal**: `Liquid Cash (Net) - Upcoming Liabilities (30d Gross) - Tax Reserve (19% of Net Profit)`.
- **Reconciliation Algorithm**:
  - **Match**: `Amount (+0.4)`, `Invoice Number (+0.5)`, `Fuzzy Name (up to +0.3)`.
  - **Tiers**: `AUTO` (≥0.95), `REVIEW` (0.60–0.94), `REJECT` (<0.60).

### Bank Importing (Regex Maszynka)
- **NIP**: `(?<!\d)\d{10}(?!\d)` after stripping separators.
- **Prefixes**: Strip `Przelew z rachunku`, `Płatność kartą`, etc.
- **Formats**: Supports PKO BP (Native XML/CSV) and ISO 20022 (camt.053).

---

## 🗄 5. Database Schema: Contractor (CRM)

```prisma
model Contractor {
  id           String    @id @default(uuid())
  tenantId     String
  nip          String?   @unique // 10-digit tax ID
  name         String
  address      String?
  status       String    @default("ACTIVE") // ACTIVE, IN_REVIEW
}
```

**Business Rule**: On OCR import, lookup by normalized NIP + `tenantId`. If found → Auto-link; if not found → Propose creation.

---

## 🗺 6. Roadmap & State (Beta Phase)

- **In Progress**: Contractor Scoring, Idempotency Keys, Advanced BI Trends.
- **Future**: KSeF Integration, OCR Background Workers, Global Accounting (Multi-currency).

---

> [!TIP]
> Use this file as the **System Prompt** for any AI agent helping with Sig ERP. It contains the complete logic and structural DNA of the project.
