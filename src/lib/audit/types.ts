/**
 * Fiscal Audit System Types - Vector 180.15
 * Type definitions for the persistent audit and investigation engine
 */

import { Decimal } from "@prisma/client/runtime/library";

export type SemanticIntent = 'income' | 'cost' | 'tax-shield' | 'warning' | 'neutral';

export interface AuditSessionConfig {
  citRate: Decimal;
  nipAnchor: string;
  sourceYear: number;
  sourceMonth?: number;
}

export type RecordContext = "OPERATIONAL" | "AUDIT_SESSION";

export interface AuditInvoiceItemInput {
  invoiceNumber: string;
  issueDate: Date;
  nip: string;
  contractorName: string;
  netAmount: Decimal | number;
  vatRate?: Decimal | number;
  vatAmount?: Decimal | number;
  grossAmount?: Decimal | number;
  ocrConfidence?: number;
  rawOcrData?: Record<string, any>;
  licensePlate?: string;
  category?: string;
  projectId?: string;
  transactionType?: string;
  correctionReference?: string;
  correctionGroup?: string;
  isCorrection?: boolean;
  linkedInvoiceId?: string;

  // VECTOR 200.50: Correction Model
  correctedInvoiceNumber?: string;
  correctedInvoiceDate?: Date | string;
  beforeNetAmount?: Decimal | number;
  beforeVatAmount?: Decimal | number;
  beforeGrossAmount?: Decimal | number;
  afterNetAmount?: Decimal | number;
  afterVatAmount?: Decimal | number;
  afterGrossAmount?: Decimal | number;
  deltaNetAmount?: Decimal | number;
  deltaVatAmount?: Decimal | number;
  deltaGrossAmount?: Decimal | number;
}

export interface AuditItemVerificationResult {
  isVerified: boolean;
  reason: string; // "OCR_CONFIDENCE" | "NIP_MATCHED" | "LICENSE_PLATE_MATCHED"
  confidence: number;
  matchedContractorId?: string;
}

export interface FiscalAggregates {
  netAmount: Decimal;
  vatAmount: Decimal;
  grossAmount: Decimal;
  citAmount: Decimal; // CIT = net * citRate
}

export interface LiveSummary {
  itemCount: number;
  verifiedCount: number;
  pendingCount: number;
  rejectedCount: number;
  totals: FiscalAggregates;
  vatSaldo: Decimal; // VAT amount (can be negative = NADPLATA/ZWROT)
  citLiability: Decimal; // CIT liability (can be negative = TARCZA/STRATA)
  grossLiability: Decimal; // DO ZAPŁATY
  citRate: Decimal;
}

export interface MonthlyReportSummary {
  month: number;
  year: number;
  netAmount: Decimal;
  vatAmount: Decimal;
  grossAmount: Decimal;
  citAmount: Decimal;
  itemCount: number;
  verifiedCount: number;
}

export interface DiscrepancyRecord {
  itemId: string;
  type: "DUPLICATE" | "UNRECOGNIZED_NIP" | "LOW_OCR_CONFIDENCE";
  details: string;
  flaggedAt: Date;
  resolvedAt?: Date;
}

export interface AuditReportData {
  period: string;
  fiscalYear: number;
  fiscalMonth?: number;
  totalNetAmount: Decimal;
  totalVatAmount: Decimal;
  totalGrossAmount: Decimal;
  totalCitAmount: Decimal;
  vatSaldo: Decimal;
  citLiability: Decimal;
  netLiability: Decimal;
  totalItemsProcessed: number;
  duplicateCount: number;
  unrecognizedNipCount: number;
  failedVerificationCount: number;
  discrepancyLog: DiscrepancyRecord[];
  monthlyBreakdown: MonthlyReportSummary[];
}

// Known Contractors for PEWNIAK System
export const KNOWN_CONTRACTORS = {
  ORLEN: { nip: "0000000000", names: ["ORLEN", "PKN ORLEN"] },
  STEFANIA_MACHNIEWSKA: { nip: "0000000000", names: ["Stefania Machniewska", "STEFANIA MACHNIEWSKA"] },
};

// License Plate Anchor
export const LICENSE_PLATE_ANCHOR = "WE452YS";

// OCR Confidence Threshold for Auto-Verification
export const OCR_CONFIDENCE_THRESHOLD = 95; // > 95%
