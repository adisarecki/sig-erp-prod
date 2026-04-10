import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

/**
 * Vector 150: Help Feedback Endpoint
 * POST /api/feedback
 *
 * Payload: { message, route, helpId? }
 * Lightweight: stores to DB, no external calls.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { message, route, helpId } = body

        if (!message || typeof message !== "string" || message.trim().length === 0) {
            return NextResponse.json({ success: false, error: "Wiadomość nie może być pusta." }, { status: 400 })
        }

        if (message.length > 2000) {
            return NextResponse.json({ success: false, error: "Wiadomość za długa (max 2000 znaków)." }, { status: 400 })
        }

        // Best-effort tenant detection (may fail for unauthenticated requests — that's OK)
        let tenantId: string | null = null
        try {
            const { getCurrentTenantId } = await import("@/lib/tenant")
            tenantId = await getCurrentTenantId()
        } catch {
            // Non-blocking: feedback is valuable even without tenantId
        }

        await (prisma as any).helpFeedback.create({
            data: {
                tenantId: tenantId || null,
                route: route || "unknown",
                helpId: helpId || null,
                message: message.trim()
            }
        })

        console.log(`[HELP_FEEDBACK] route=${route} helpId=${helpId ?? "none"} tenant=${tenantId ?? "anon"}`)

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error("[HELP_FEEDBACK_ERROR]", error.message)
        return NextResponse.json({ success: false, error: "Błąd zapisu zgłoszenia." }, { status: 500 })
    }
}
