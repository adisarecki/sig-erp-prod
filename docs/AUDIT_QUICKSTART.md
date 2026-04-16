# Investigation Mode - Quick Start Guide for Developers

## Using the Audit System in Your App

### 1. Wrap Your Component with AuditSessionProvider

```tsx
import { AuditSessionProvider } from '@/components/audit';

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuditSessionProvider>
      {children}
    </AuditSessionProvider>
  );
}
```

### 2. Use Investigation Mode Panel

```tsx
"use client";

import { InvestigationModePanel } from '@/components/audit';
import { useSession } from 'next-auth/react';

export default function AuditPage() {
  const { data: session } = useSession();
  
  if (!session?.user?.id) return <div>Loading...</div>;

  return (
    <div className="p-6">
      <InvestigationModePanel 
        tenantId={session.user.tenantId}
        onClose={() => {/* Handle close */}}
      />
    </div>
  );
}
```

### 3. Access Audit Context (Advanced Usage)

```tsx
import { useAuditSession } from '@/components/audit';

export function CustomAuditComponent() {
  const {
    sessionId,
    liveSummary,
    isLoading,
    error,
    createSession,
    uploadItems,
    verifyAll,
    finalizeSession,
  } = useAuditSession();

  // Your custom implementation
}
```

## Backend: Using Audit Services Directly

### Create a Session

```typescript
import { AuditSessionService } from '@/lib/audit';
import Decimal from 'decimal.js';

const session = await AuditSessionService.createSession(
  'tenant-id',
  {
    sourceYear: 2025,
    sourceMonth: 3,
    citRate: new Decimal('0.09'),
    nipAnchor: '9542751368',
  }
);
```

### Add Items to Session

```typescript
const item = await AuditSessionService.addInvoiceItem(
  session.id,
  'tenant-id',
  {
    invoiceNumber: 'FV/2025/001',
    issueDate: new Date('2025-03-15'),
    nip: '1234567890',
    contractorName: 'ORLEN',
    netAmount: new Decimal('10000'),
    vatRate: new Decimal('0.23'),
    ocrConfidence: 98,
    licensePlate: 'WE452YS',
  }
);
```

### Auto-Verify (PEWNIAK System)

```typescript
import { VerificationEngine } from '@/lib/audit';

// Verify a single item
const result = await VerificationEngine.verifyItem(itemId);
console.log(result); // { isVerified: true, reason: "LICENSE_PLATE_MATCHED", confidence: 100 }

// Auto-verify entire session
const verifiedCount = await VerificationEngine.autoVerifySession(sessionId);
console.log(`Verified ${verifiedCount} items`);

// Detect duplicates
const duplicates = await VerificationEngine.detectDuplicates(sessionId);
```

### Generate Reports

```typescript
import { ReportGeneratorService } from '@/lib/audit';

// Generate report from completed session
const reportData = await ReportGeneratorService.generateReport(sessionId);
const report = await ReportGeneratorService.saveReport(sessionId, reportData);

// Get annual summary
const annualSummary = await ReportGeneratorService.generateAnnualSummary(
  'tenant-id',
  2025
);
```

### Fiscal Calculations

```typescript
import { FiscalCalculatorService } from '@/lib/audit';

// Calculate VAT
const vat = FiscalCalculatorService.calculateVAT(10000, 0.23); // 2300

// Calculate CIT
const cit = FiscalCalculatorService.calculateCIT(10000, 0.09); // 900

// Aggregate items
const totals = FiscalCalculatorService.aggregateItems(items, 0.09);

// Get colored liabilities
const liabilities = FiscalCalculatorService.calculateLiabilities(totals);
console.log(liabilities.vatSaldo); // { amount, color, label }
// { amount: Decimal, color: '#10b981', label: 'NADPLATA / ZWROT' }
```

## Database Queries

### Query All Items in a Session

```typescript
const items = await prisma.auditInvoiceItem.findMany({
  where: {
    auditSessionId: sessionId,
  },
  orderBy: { createdAt: 'desc' },
});
```

### Query Verified Items Only

```typescript
const verified = await prisma.auditInvoiceItem.findMany({
  where: {
    auditSessionId: sessionId,
    status: { in: ['VERIFIED', 'MANUAL_OVERRIDE'] },
  },
});
```

### Query Duplicates

```typescript
const duplicates = await prisma.auditInvoiceItem.findMany({
  where: {
    auditSessionId: sessionId,
    status: 'DUPLICATE',
  },
});
```

### Query Reports for a Tenant

```typescript
const reports = await prisma.auditReport.findMany({
  where: {
    tenantId: 'tenant-id',
    fiscalYear: 2025,
    isFinalized: true,
  },
  orderBy: { period: 'desc' },
});
```

## Color Coding Reference

Use these colors in your UI for consistent fiscal liability display:

```typescript
// Emerald Green - NADPLATA/ZWROT (VAT < 0, refund due)
#10b981

// Cyan Blue - TARCZA/STRATA (CIT < 0, loss carrier)
#06b6d4

// Rose Red - DO ZAPŁATY (Liability > 0, amount due)
#f43f5e
```

## Constants Reference

```typescript
import { 
  KNOWN_CONTRACTORS, 
  LICENSE_PLATE_ANCHOR,
  OCR_CONFIDENCE_THRESHOLD 
} from '@/lib/audit';

// KNOWN_CONTRACTORS = { ORLEN, STEFANIA_MACHNIEWSKA }
// LICENSE_PLATE_ANCHOR = 'WE452YS'
// OCR_CONFIDENCE_THRESHOLD = 95
```

## Type Definitions

```typescript
import type {
  LiveSummary,
  FiscalAggregates,
  AuditReportData,
  AuditItemVerificationResult,
  MonthlyReportSummary,
  DiscrepancyRecord,
} from '@/lib/audit';
```

## Troubleshooting

### Session Not Found
```typescript
// Verify tenantId matches current user's tenant
const session = await AuditSessionService.getSession(sessionId, tenantId);
```

### Import Errors
```typescript
// Correct: Import from default export
import prisma from '@/lib/prisma';

// Incorrect: Named import
import { prisma } from '@/lib/prisma'; // ❌
```

### Decimal Calculations
```typescript
// Always use Decimal.js for financial calculations
import Decimal from 'decimal.js';

const amount = new Decimal('10000.99');
const vat = amount.mul(new Decimal('0.23'));
const result = vat.toDP(2); // Round to 2 decimal places
```

---

**For full API documentation, see**: [AUDIT_SYSTEM_V180_IMPLEMENTATION.md](./AUDIT_SYSTEM_V180_IMPLEMENTATION.md)
