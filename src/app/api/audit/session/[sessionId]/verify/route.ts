/**
 * POST /api/audit/session/[sessionId]/verify
 * Verify items in an audit session using PEWNIAK engine
 */

import { NextRequest, NextResponse } from "next/server";
import { VerificationEngine, AuditSessionService } from "@/lib/audit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { tenantId, itemIds, autoVerifyAll } = await request.json();
    const { sessionId } = await params;

    if (!tenantId) {
      return NextResponse.json(
        { error: "Missing required field: tenantId" },
        { status: 400 }
      );
    }

    // Verify that session belongs to tenant
    await AuditSessionService.getSession(sessionId, tenantId);

    if (autoVerifyAll) {
      // Auto-verify all items in session using PEWNIAK system
      const verifiedCount = await VerificationEngine.autoVerifySession(sessionId);
      return NextResponse.json({
        message: "Auto-verification completed",
        verifiedCount,
      });
    } else if (itemIds && Array.isArray(itemIds)) {
      // Verify specific items
      const results = [];
      for (const itemId of itemIds) {
        const result = await VerificationEngine.verifyItem(itemId);
        results.push({
          itemId,
          ...result,
        });
      }
      return NextResponse.json(results);
    }

    return NextResponse.json(
      { error: "Either autoVerifyAll or itemIds must be provided" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Error verifying items:", error);
    return NextResponse.json(
      { error: error.message || "Verification failed" },
      { status: 500 }
    );
  }
}
