/**
 * GET /api/audit/session/[sessionId]
 * Get audit session with live summary
 */

import { NextRequest, NextResponse } from "next/server";
import { AuditSessionService } from "@/lib/audit";

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;
    const tenantId = request.nextUrl.searchParams.get("tenantId");

    if (!tenantId) {
      return NextResponse.json(
        { error: "Missing required parameter: tenantId" },
        { status: 400 }
      );
    }

    const session = await AuditSessionService.getSession(sessionId, tenantId);
    const liveSummary = await AuditSessionService.getLiveSummary(
      sessionId,
      tenantId
    );

    return NextResponse.json({
      session,
      liveSummary: {
        ...liveSummary,
        totals: {
          netAmount: liveSummary.totals.netAmount.toString(),
          vatAmount: liveSummary.totals.vatAmount.toString(),
          grossAmount: liveSummary.totals.grossAmount.toString(),
          citAmount: liveSummary.totals.citAmount.toString(),
        },
        vatSaldo: liveSummary.vatSaldo.toString(),
        citLiability: liveSummary.citLiability.toString(),
        grossLiability: liveSummary.grossLiability.toString(),
      },
    });
  } catch (error: any) {
    console.error("Error retrieving session:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve session" },
      { status: 500 }
    );
  }
}
