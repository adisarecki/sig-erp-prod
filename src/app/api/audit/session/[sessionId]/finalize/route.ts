/**
 * POST /api/audit/session/[sessionId]/finalize
 * Zakończ Wczytywanie - Finalize the audit session and generate report
 */

import { NextRequest, NextResponse } from "next/server";
import { AuditSessionService, ReportGeneratorService, VerificationEngine } from "@/lib/audit";
import prisma from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { tenantId } = await request.json();
    const { sessionId } = await params;

    if (!tenantId) {
      return NextResponse.json(
        { error: "Missing required field: tenantId" },
        { status: 400 }
      );
    }

    // Verify that session belongs to tenant
    const session = await AuditSessionService.getSession(sessionId, tenantId);

    // Step 1: Auto-detect duplicates
    const duplicates = await VerificationEngine.detectDuplicates(sessionId);

    // Step 2: Generate comprehensive report
    const reportData = await ReportGeneratorService.generateReport(sessionId);

    // Step 3: Save report
    const report = await ReportGeneratorService.saveReport(sessionId, reportData);

    // Step 4: Finalize session
    const finalizedSession = await AuditSessionService.finalizeSession(sessionId, tenantId);

    return NextResponse.json({
      message: "Audit session completed successfully",
      session: finalizedSession,
      report: {
        id: report.id,
        period: report.period,
        fiscalYear: report.fiscalYear,
        totalNetAmount: report.totalNetAmount.toString(),
        totalVatAmount: report.totalVatAmount.toString(),
        totalGrossAmount: report.totalGrossAmount.toString(),
        totalCitAmount: report.totalCitAmount.toString(),
        vatSaldo: report.vatSaldomonetaryUnit.toString(),
        citLiability: report.citLiability.toString(),
        duplicateCount: report.duplicateCount,
        unrecognizedNipCount: report.unrecognizedNipCount,
        failedVerificationCount: report.failedVerificationCount,
        discrepancyCount: (report.discrepancyLog as any[])?.length || 0,
      },
      detectedDuplicates: duplicates.length,
    });
  } catch (error: any) {
    console.error("Error finalizing audit session:", error);
    return NextResponse.json(
      { error: error.message || "Session finalization failed" },
      { status: 500 }
    );
  }
}
