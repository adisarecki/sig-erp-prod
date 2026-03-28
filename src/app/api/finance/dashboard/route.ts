import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";

export async function GET(request: NextRequest) {
    try {
        const tenantId = await getCurrentTenantId();

        // 1. Zliczenie wszystkich niezapłaconych kwot faktur
        const unpaidInvoicesAggregation = await prisma.invoice.aggregate({
            _sum: {
                amountGross: true
            },
            where: {
                tenantId: tenantId,
                paymentStatus: "UNPAID",
                status: "ACTIVE" // Ignorujemy zwrócone, anulowane itp.
            }
        });

        const unpaidTotalAmountGross = unpaidInvoicesAggregation._sum.amountGross || 0;

        return NextResponse.json({
            success: true,
            metrics: {
                unpaidTotalAmountGross: Number(unpaidTotalAmountGross) // Konwersja rzutowania z Decimal Prisma
            }
        });

    } catch (error: any) {
        console.error("[FINANCE_DASHBOARD_API]", error);
        return NextResponse.json(
            { error: error.message || "Błąd podczas generowania dashboardu finansów" },
            { status: 500 }
        );
    }
}
