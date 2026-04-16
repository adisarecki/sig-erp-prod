# Investigation Mode - Fiscal Audit System

## Overview

Investigation Mode is a dedicated audit layer for financial documents. It allows you to:

- create persistent audit sessions for historical or batch invoice ingestion,
- upload and review batches of documents without clearing the queue,
- perform autonomous verification for high-confidence OCR items,
- generate monthly and annual audit reports,
- isolate audit data from operational dashboards using `isAudit: true`.

## Key Features

- Persistent session state across multiple uploads
- Real-time VAT and CIT aggregation
- Semantic color-coded liability reporting
- PEWNIAK auto-verification with NIP and license plate anchors
- Bulk approve button (`ZATWIERDŹ WSZYSTKIE`)
- Finalize session and generate audit report (`Zakończ Wczytywanie`)

## Notes

The system sets `isAudit: true` on audit invoice entries, so they do not pollute 2026 operational dashboards, while remaining fully queryable for audit reporting.
