/**
 * POST /api/audit/session/[sessionId]/bulk-approve
 * ZATWIERDŹ WSZYSTKIE - Bulk approve all verified items
 */

import { NextRequest, NextResponse } from "next/server";
import { AuditSessionService } from "@/lib/audit";
import prisma from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { tenantId } = await request.json();
    const { sessionId } = params;

    if (!tenantId) {
      return NextResponse.json(
        { error: "Missing required field: tenantId" },
        { status: 400 }
      );
    }

    // Verify that session belongs to tenant
    await AuditSessionService.getSession(sessionId, tenantId);

    // Get all verified items
    const verifiedItems = await prisma.auditInvoiceItem.findMany({
      where: {
        auditSessionId: sessionId,
        status: { in: ["VERIFIED", "MANUAL_OVERRIDE"] },
      },
    });

    // Update all to approved status (ready for commit)
    await prisma.auditInvoiceItem.updateMany({
      where: {
        auditSessionId: sessionId,
        status: { in: ["VERIFIED", "MANUAL_OVERRIDE"] },
      },
      data: {
        status: "VERIFIED", // Already verified; can now be committed
      },
    });

    const session = await AuditSessionService.getSession(sessionId, tenantId);

    return NextResponse.json({
      message: `Bulk approved ${verifiedItems.length} items`,
      approvedCount: verifiedItems.length,
      session,
    });
  } catch (error: any) {
    console.error("Error in bulk approve:", error);
    return NextResponse.json(
      { error: error.message || "Bulk approval failed" },
      { status: 500 }
    );
  }
}
