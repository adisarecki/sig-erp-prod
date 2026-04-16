/**
 * POST /api/audit/session/[sessionId]/upload
 * Add invoice items to an audit session (single or batch)
 */

import { NextRequest, NextResponse } from "next/server";
import { AuditSessionService } from "@/lib/audit";
import Decimal from "decimal.js";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { tenantId, items } = await request.json();
    const { sessionId } = await params;

    if (!tenantId || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "Missing required fields: tenantId, items (array)" },
        { status: 400 }
      );
    }

    // Convert items with proper Decimal types
    const normalizedItems = items.map((item) => ({
      ...item,
      netAmount: new Decimal(item.netAmount),
      vatAmount: item.vatAmount ? new Decimal(item.vatAmount) : undefined,
      grossAmount: item.grossAmount ? new Decimal(item.grossAmount) : undefined,
      vatRate: item.vatRate ? new Decimal(item.vatRate) : new Decimal("0.23"),
    }));

    const result = await AuditSessionService.addBatchInvoiceItems(
      sessionId,
      tenantId,
      normalizedItems
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Error uploading items:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload items" },
      { status: 500 }
    );
  }
}
