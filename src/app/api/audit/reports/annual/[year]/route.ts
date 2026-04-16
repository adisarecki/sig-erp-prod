/**
 * GET /api/audit/reports/annual/{year}
 * Retrieve annual audit summary
 */

import { NextRequest, NextResponse } from "next/server";
import { ReportGeneratorService } from "@/lib/audit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ year: string }> }
) {
  try {
    const { year } = await params;
    const tenantId = request.nextUrl.searchParams.get("tenantId");

    if (!tenantId || !year) {
      return NextResponse.json(
        { error: "Missing required parameters: tenantId, year" },
        { status: 400 }
      );
    }

    const annualSummary = await ReportGeneratorService.generateAnnualSummary(
      tenantId,
      parseInt(year)
    );

    return NextResponse.json(annualSummary);
  } catch (error: any) {
    console.error("Error retrieving annual report:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve annual report" },
      { status: 500 }
    );
  }
}
