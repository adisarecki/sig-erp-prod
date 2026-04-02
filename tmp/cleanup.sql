DELETE FROM "LedgerEntry" WHERE "date" >= '2026-04-02' AND "date" < '2026-04-03';
DELETE FROM "InvoicePayment" WHERE "createdAt" >= '2026-04-02' AND "createdAt" < '2026-04-03';
DELETE FROM "Transaction" WHERE "createdAt" >= '2026-04-02' AND "createdAt" < '2026-04-03';
DELETE FROM "Invoice" WHERE "createdAt" >= '2026-04-02' AND "createdAt" < '2026-04-03';
