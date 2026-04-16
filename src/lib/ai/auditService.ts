import OpenAI from "openai";
import { AuditRequest, AuditResponse } from "./types";
import prisma from "@/lib/prisma";

/**
 * AuditService (Vector 300 - Refined)
 * 
 * Secure, server-side engine for architectural and financial auditing.
 * Features:
 * - Configurable model (OPENAI_AUDIT_MODEL) with fallback.
 * - Technical logging to PostgreSQL.
 * - Enhanced Red-Flag sanitization.
 * - Payload size control.
 */

const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9]{32,}/g, // OpenAI Keys
  /postgresql:\/\/[^"'\s]+/g, // Postgres URLs
  /Bearer\s+[^"'\s]+/g, // Bearer Tokens
  /AIza[0-9A-Za-z-_]{35}/g, // GCP/Gemini Keys
  /db-password=[^&"'\s]+/g, // Inline DB Passwords
  /Cookie:\s*[^"'\n]+/g, // Browser Cookies
  /session-token=[^;]+(?=;|$)/g, // Session Tokens
  /PRIVATE_KEY=[^"'\n]+/g, // Private Env Values
];

/**
 * Sanitizes and truncates context to avoid secret leakage and payload bloat
 */
export function sanitizeAuditContext(text: string): string {
  let sanitized = text;
  
  // 1. Red-Flag Redaction
  SECRET_PATTERNS.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, "[REDACTED_SECRET]");
  });

  // 2. Size Control (Truncate to ~8000 chars total for the payload if very large)
  if (sanitized.length > 8192) {
    sanitized = sanitized.substring(0, 8192) + "... [TRUNCATED_FOR_SAFETY]";
  }

  return sanitized;
}

/**
 * Lazy Initialization (Build Safety)
 */
let openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured on the server.");
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

/**
 * SIG ERP Auditor Rules (Vectory)
 */
const SYSTEM_PROMPT = `
You are the Lead Financial Systems Auditor for SIG ERP. 
You provide strict, evidence-based technical reports.

AUDIT CONSTITUTION:
1. PG-First Strategy: PostgreSQL (LedgerEntry) is the ONLY Source of Truth. Firestore is just a mirror.
2. Sign Integrity: Net, VAT, and Gross must preserve their signed direction. 
   - No Math.abs() on financial totals.
   - Corrections must be handled as signed deltas.
3. No Page-Level Math: All financial calculations must happen in centralized coreMath logic.
4. Correction Modeling: Correction invoices are DELTAS (Before/After/Delta). Never standalone normal invoices.

REQUIRED OUTPUT FORMAT (JSON):
{
  "results": {
    "summary": "String",
    "rootCauseHypothesis": ["String"],
    "likelyFiles": ["String"],
    "violatedVectors": ["String"],
    "recommendedFixes": ["String"],
    "testCases": ["String"],
    "suggestedPromptForAnti": "String"
  }
}
`;

/**
 * Technical Logging to PostgreSQL (AuditLog)
 */
async function logAuditToPostgres(
  userId: string | null,
  tenantId: string | null,
  request: AuditRequest,
  response: AuditResponse
) {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: tenantId || "system",
        userId: userId || null,
        action: "AI_AUDIT_REQUEST",
        entity: "System",
        entityId: request.mode,
        details: {
          question: request.question,
          mode: request.mode,
          status: response.success ? "SUCCESS" : "ERROR",
          summary: response.results?.summary || "No summary",
          timestamp: new Date().toISOString()
        } as any
      }
    });
  } catch (err) {
    console.error("[AUDIT_LOG_FAILURE]:", err);
  }
}

/**
 * Execute the Audit (Responses API Implementation)
 */
export async function performAudit(
  request: AuditRequest, 
  userContext: { userId: string | null; tenantId: string | null }
): Promise<AuditResponse> {
  const mode = request.mode;
  const question = request.question;
  
  try {
    const client = getOpenAIClient();
    const targetModel = process.env.OPENAI_AUDIT_MODEL || "gpt-5.4";
    const fallbackModel = "gpt-4o";

    const payload = sanitizeAuditContext(JSON.stringify(request));

    // Simulation of "Responses API" shape as requested
    // Internally mapped to chat completions for stable SDK integration
    let response;
    try {
      response = await client.chat.completions.create({
        model: targetModel,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: payload },
        ],
        response_format: { type: "json_object" },
      });
    } catch (e: any) {
      if (e.status === 404 || e.message.includes("model_not_found")) {
        console.warn(`[AI_AUDIT] ${targetModel} not found, falling back to ${fallbackModel}`);
        response = await client.chat.completions.create({
          model: fallbackModel,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: payload },
          ],
          response_format: { type: "json_object" },
        });
      } else {
        throw e;
      }
    }

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned an empty response.");

    const parsed = JSON.parse(content);
    const result: AuditResponse = {
      success: true,
      results: parsed.results || parsed
    };

    // Log the successful audit
    await logAuditToPostgres(userContext.userId, userContext.tenantId, request, result);

    return result;

  } catch (error: any) {
    console.error(`[AI_AUDIT_ERROR] Mode: ${mode}`, error);
    const errorResponse: AuditResponse = {
      success: false,
      error: error.message || "Unknown error during AI audit execution."
    };
    
    // Log the failed audit
    await logAuditToPostgres(userContext.userId, userContext.tenantId, request, errorResponse);
    
    return errorResponse;
  }
}
