/**
 * POST /api/audit/session/create
 * Create a new audit investigation session
 */

import { NextRequest, NextResponse } from "next/server";
import { AuditSessionService } from "@/lib/audit";
import prisma from "@/lib/prisma";
import Decimal from "decimal.js";

export async function POST(request: NextRequest) {
  try {
    const { tenantId, sourceYear, sourceMonth, citRate } = await request.json();

    if (!tenantId || !sourceYear) {
      return NextResponse.json(
        { error: "Missing required fields: tenantId, sourceYear" },
        { status: 400 }
      );
    }

    const session = await AuditSessionService.createSession(tenantId, {
      sourceYear,
      sourceMonth,
      citRate: citRate ? new Decimal(citRate) : new Decimal("0.09"),
      nipAnchor: "9542751368",
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error: any) {
    console.error("Error creating audit session:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create session" },
      { status: 500 }
    );
  }
}
