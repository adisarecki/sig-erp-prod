# KSeF Data Integrity & Enrichment (DNA Vectors 098-099)

This knowledge item documents the architectural standards for ensuring financial data hygiene during KSeF synchronization.

## 1. Absolute Duplicate Shield (Vector 098.1)

To prevent duplicate cost entries from multiple sync attempts or mixed OCR/KSeF sources, the system Enforce a strict **findUnique** pre-check before any create/upsert operation.

- **Check-Before-Write**: API routes (`/api/ksef/sync`) must verify if `ksefId` already exists.
- **Skip Policy**: If `ksefId` is present, the sync must either skip or perform a timestamp `update`, never a new `create`.

## 2. XML Context Binding (Vector 098.2)

Phase 2 (Deep Sync/Processing) must be strictly bound to the metadata context created in Phase 1.

- **Strict Update**: Decoding XML data (`/api/ksef/process`) must use `prisma.invoice.update` with `where: { ksefId }`.
- **Forbidden**: `prisma.invoice.create()` or `upsert()` based on `invoiceNumber` is prohibited in the XML parsing loop to prevent "vacuum" record creation.

## 3. Smart Enrichment Engine (Vector 099)

The enrichment process decodes the XML `<NrRB>` bank account and `<Adres>` fields to propose contractor updates.

- **Human-in-the-loop**: Proposals are stored in `ENRICHMENT_PROPOSAL` notifications. The user must approve before data is merged.
- **Self-Learning**: Bank accounts (`bankAccounts` field) are appended to contractor profiles to improve future bank import matching.

## Key Files
- `src/app/api/ksef/sync/route.ts` (Phase 1)
- `src/app/api/ksef/process/route.ts` (Phase 2)
- `src/lib/finance/contractorEnricher.ts` (Enrichment Logic)
- `docs/AI_look.md` (Standard Documentation)
