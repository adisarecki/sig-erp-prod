import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const today = new Date("2026-04-02");
    const tomorrow = new Date("2026-04-03");

    // Order matters for foreign keys
    const ldeleted = await prisma.ledgerEntry.deleteMany({
      where: { date: { gte: today, lt: tomorrow } }
    });

    const pdeleted = await prisma.invoicePayment.deleteMany({
      where: { createdAt: { gte: today, lt: tomorrow } }
    });

    const tdeleted = await prisma.transaction.deleteMany({
      where: { createdAt: { gte: today, lt: tomorrow } }
    });

    const ideleted = await prisma.invoice.deleteMany({
      where: { createdAt: { gte: today, lt: tomorrow } }
    });

    return NextResponse.json({ 
      success: true, 
      ledger: ldeleted.count,
      payments: pdeleted.count,
      transactions: tdeleted.count,
      invoices: ideleted.count
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
