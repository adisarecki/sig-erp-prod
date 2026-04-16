/**
 * Report Generator Service - Vector 180.15
 * Generates monthly and annual audit reports with fiscal liability calculations
 */

import prisma from "@/lib/prisma";
import Decimal from "decimal.js";
import { AuditReportData, DiscrepancyRecord, MonthlyReportSummary } from "./types";

export class ReportGeneratorService {
  /**
   * Generate a comprehensive audit report from a completed session
   */
  static async generateReport(sessionId: string): Promise<AuditReportData> {
    const session = await prisma.auditSession.findUnique({
      where: { id: sessionId },
      include: { items: true },
    });

    if (!session) {
      throw new Error("Session not found");
    }

    // Get fiscal period
    const fiscalMonth = session.sourceMonth;
    const fiscalYear = session.sourceYear;
    const period =
      fiscalMonth !== null && fiscalMonth !== undefined
        ? `${fiscalYear}-${String(fiscalMonth).padStart(2, "0")}`
        : `${fiscalYear}`;

    // Aggregate items by status
    const verifiedItems = session.items.filter((i) => i.status === "VERIFIED" || i.status === "MANUAL_OVERRIDE");
    const rejectedItems = session.items.filter((i) => i.status === "REJECTED");
    const duplicateItems = session.items.filter((i) => i.status === "DUPLICATE");

    // Calculate totals from verified items only
    let netAmount = new Decimal(0);
    let vatAmount = new Decimal(0);
    let grossAmount = new Decimal(0);

    verifiedItems.forEach((item) => {
      netAmount = netAmount.add(item.netAmount);
      vatAmount = vatAmount.add(item.vatAmount);
      grossAmount = grossAmount.add(item.grossAmount);
    });

    const citAmount = netAmount.mul(session.citRate);

    // Calculate liabilities
    const vatSaldo = vatAmount; // Positive = liability, negative = refund due
    const citLiability = citAmount; // CIT amount to be paid or lost
    const netLiability = netAmount; // Total net amount subject to taxation

    // Count discrepancies
    const unrecognizedNips = session.items.filter(
      (i) => i.flaggedAsDiscrepancy && i.discrepancyReason === "UNRECOGNIZED_NIP"
    ).length;

    const lowOcrConfidenceItems = session.items.filter(
      (i) => i.ocrConfidence < 95
    ).length;

    // Build discrepancy log
    const discrepancyLog: DiscrepancyRecord[] = [];

    duplicateItems.forEach((item) => {
      discrepancyLog.push({
        itemId: item.id,
        type: "DUPLICATE",
        details: `Duplicate of ${item.duplicateOf}: ${item.invoiceNumber} from ${item.contractorName}`,
        flaggedAt: item.updatedAt,
      });
    });

    session.items
      .filter((i) => i.flaggedAsDiscrepancy && i.discrepancyReason === "UNRECOGNIZED_NIP")
      .forEach((item) => {
        discrepancyLog.push({
          itemId: item.id,
          type: "UNRECOGNIZED_NIP",
          details: `Unrecognized NIP: ${item.nip} (${item.contractorName})`,
          flaggedAt: item.updatedAt,
        });
      });

    session.items
      .filter((i) => i.ocrConfidence < 95)
      .forEach((item) => {
        discrepancyLog.push({
          itemId: item.id,
          type: "LOW_OCR_CONFIDENCE",
          details: `Low OCR confidence: ${item.ocrConfidence}% for ${item.invoiceNumber}`,
          flaggedAt: item.updatedAt,
        });
      });

    // Generate monthly breakdown
    const monthlyBreakdown = this._generateMonthlyBreakdown(
      verifiedItems,
      session.citRate
    );

    const reportData: AuditReportData = {
      period,
      fiscalYear,
      fiscalMonth: fiscalMonth ?? undefined,
      totalNetAmount: netAmount,
      totalVatAmount: vatAmount,
      totalGrossAmount: grossAmount,
      totalCitAmount: citAmount,
      vatSaldo,
      citLiability,
      netLiability,
      totalItemsProcessed: session.items.length,
      duplicateCount: duplicateItems.length,
      unrecognizedNipCount: unrecognizedNips,
      failedVerificationCount: rejectedItems.length + lowOcrConfidenceItems,
      discrepancyLog,
      monthlyBreakdown,
    };

    return reportData;
  }

  /**
   * Save generated report to database
   */
  static async saveReport(sessionId: string, reportData: AuditReportData) {
    const report = await prisma.auditReport.create({
      data: {
        auditSessionId: sessionId,
        tenantId: (
          await prisma.auditSession.findUnique({
            where: { id: sessionId },
            select: { tenantId: true },
          })
        )!.tenantId,
        period: reportData.period,
        fiscalYear: reportData.fiscalYear,
        fiscalMonth: reportData.fiscalMonth ?? undefined,
        totalNetAmount: reportData.totalNetAmount.toDP(2),
        totalVatAmount: reportData.totalVatAmount.toDP(2),
        totalGrossAmount: reportData.totalGrossAmount.toDP(2),
        totalCitAmount: reportData.totalCitAmount.toDP(2),
        vatSaldomonetaryUnit: reportData.vatSaldo.toDP(2),
        citLiability: reportData.citLiability.toDP(2),
        netLiability: reportData.netLiability.toDP(2),
        totalItemsProcessed: reportData.totalItemsProcessed,
        duplicateCount: reportData.duplicateCount,
        unrecognizedNipCount: reportData.unrecognizedNipCount,
        failedVerificationCount: reportData.failedVerificationCount,
        discrepancyLog: reportData.discrepancyLog as any,
        monthlyBreakdown: reportData.monthlyBreakdown as any,
        isFinalized: true,
        finalizedAt: new Date(),
      },
    });

    // Update session with report reference
    await prisma.auditSession.update({
      where: { id: sessionId },
      data: {
        generatedReport: { connect: { id: report.id } },
      },
    });

    return report;
  }

  /**
   * Generate monthly breakdown from items
   */
  private static _generateMonthlyBreakdown(
    items: any[],
    citRate: any
  ): MonthlyReportSummary[] {
    const monthMap = new Map<string, any>();

    items.forEach((item) => {
      const key = `${item.issueDate.getFullYear()}-${String(
        item.issueDate.getMonth() + 1
      ).padStart(2, "0")}`;

      if (!monthMap.has(key)) {
        monthMap.set(key, {
          netAmount: new Decimal(0),
          vatAmount: new Decimal(0),
          grossAmount: new Decimal(0),
          itemCount: 0,
          verifiedCount: 0,
        });
      }

      const month = monthMap.get(key);
      month.netAmount = month.netAmount.add(item.netAmount);
      month.vatAmount = month.vatAmount.add(item.vatAmount);
      month.grossAmount = month.grossAmount.add(item.grossAmount);
      month.itemCount++;
      if (item.status === "VERIFIED" || item.status === "MANUAL_OVERRIDE") {
        month.verifiedCount++;
      }
    });

    const result: MonthlyReportSummary[] = [];
    monthMap.forEach((month, key) => {
      const [yearStr, monthStr] = key.split("-");
      const year = parseInt(yearStr);
      const monthNum = parseInt(monthStr);

      result.push({
        month: monthNum,
        year,
        netAmount: month.netAmount,
        vatAmount: month.vatAmount,
        grossAmount: month.grossAmount,
        citAmount: month.netAmount.mul(citRate),
        itemCount: month.itemCount,
        verifiedCount: month.verifiedCount,
      });
    });

    return result.sort((a, b) => (a.month === b.month ? 0 : a.month - b.month));
  }

  /**
   * Get annual summary across all audit sessions
   */
  static async generateAnnualSummary(tenantId: string, year: number) {
    const reports = await prisma.auditReport.findMany({
      where: {
        tenantId,
        fiscalYear: year,
        isFinalized: true,
      },
    });

    if (reports.length === 0) {
      throw new Error(`No finalized reports found for year ${year}`);
    }

    let totalNet = new Decimal(0);
    let totalVat = new Decimal(0);
    let totalGross = new Decimal(0);
    let totalCit = new Decimal(0);
    let totalDuplicates = 0;
    let totalUnrecognized = 0;
    let totalFailed = 0;

    const allDiscrepancies: DiscrepancyRecord[] = [];
    const allMonthly: MonthlyReportSummary[] = [];

    reports.forEach((report) => {
      totalNet = totalNet.add(report.totalNetAmount);
      totalVat = totalVat.add(report.totalVatAmount);
      totalGross = totalGross.add(report.totalGrossAmount);
      totalCit = totalCit.add(report.totalCitAmount);
      totalDuplicates += report.duplicateCount;
      totalUnrecognized += report.unrecognizedNipCount;
      totalFailed += report.failedVerificationCount;

      if (report.discrepancyLog) {
        allDiscrepancies.push(
          ...(report.discrepancyLog as unknown as DiscrepancyRecord[])
        );
      }

      if (report.monthlyBreakdown) {
        allMonthly.push(...(report.monthlyBreakdown as unknown as MonthlyReportSummary[]));
      }
    });

    return {
      year,
      period: `${year}`,
      totalNetAmount: totalNet,
      totalVatAmount: totalVat,
      totalGrossAmount: totalGross,
      totalCitAmount: totalCit,
      vatSaldo: totalVat,
      citLiability: totalCit,
      netLiability: totalNet,
      totalReportsGenerated: reports.length,
      duplicateCount: totalDuplicates,
      unrecognizedNipCount: totalUnrecognized,
      failedVerificationCount: totalFailed,
      discrepancyLog: allDiscrepancies,
      monthlyBreakdown: allMonthly.sort((a, b) => a.month - b.month),
    };
  }

  /**
   * Export report as JSON
   */
  static async exportReportAsJson(reportId: string) {
    const report = await prisma.auditReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new Error("Report not found");
    }

    return report;
  }
}
