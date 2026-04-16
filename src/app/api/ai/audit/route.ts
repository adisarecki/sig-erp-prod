import { NextRequest, NextResponse } from "next/server";
import { performAudit } from "@/lib/ai/auditService";
import { AuditRequest } from "@/lib/ai/types";
import { getAdminAuth } from "@/lib/firebaseAdmin";
import { getCurrentTenantId } from "@/lib/tenant";

/**
 * [VECTOR 300] Secure AI Audit Endpoint
 * 
 * Access: Authenticated Admin/Founder only.
 * Method: POST
 */

// WHITELIST (CEO & WSPÓLNIK) - Mirroring Gatekeeper.tsx
const AUTHORIZED_EMAILS = [
  "adisarecki@go2.pl", // CEO
  "t.grabolus@gmail.com" // Wspólnik
];

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate Request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, error: "Unauthorized: Missing Bearer Token" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const adminAuth = getAdminAuth();
    
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (err) {
      console.error("[AUTH_TOKEN_FAIL]", err);
      return NextResponse.json({ success: false, error: "Unauthorized: Invalid or expired token" }, { status: 401 });
    }

    // 2. Authorize via Whitelist
    const userEmail = decodedToken.email || "";
    if (!AUTHORIZED_EMAILS.includes(userEmail)) {
      console.warn(`[AUTH_BLOCK]: Unauthorized audit attempt from ${userEmail}`);
      return NextResponse.json({ success: false, error: "Forbidden: Access restricted to Admin/Founders." }, { status: 403 });
    }

    // 3. Process Request
    const body: AuditRequest = await req.json();
    if (!body.mode || !body.question) {
      return NextResponse.json({ success: false, error: "Bad Request: Missing mode or question" }, { status: 400 });
    }

    // Get current context
    const tenantId = await getCurrentTenantId();
    const userId = decodedToken.uid;

    // 4. Execute Audit
    const report = await performAudit(body, { userId, tenantId });

    if (!report.success) {
      return NextResponse.json(report, { status: 500 });
    }

    return NextResponse.json(report);

  } catch (error: any) {
    console.error("[AUDIT_ROUTE_FAIL]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error during audit processing." },
      { status: 500 }
    );
  }
}
