/**
 * OpenAI Audit Layer Contracts (Vector 300)
 * These interfaces define the strict JSON interface between the SIG ERP backend and OpenAI.
 */

export type AuditMode =
  | "financial_bug"
  | "invoice_correction_review"
  | "ocr_failure"
  | "code_audit"
  | "architecture_review"
  | "prompt_generation";

export type AuditRequest = {
  mode: AuditMode;
  question: string;
  aiLook?: string;              // AI_look.md condensed or full
  vectors?: string[];           // e.g. ["107", "110", "170", "200.99"]
  logs?: string;                // stack traces, Vercel logs, console logs
  codeSnippets?: Array<{
    path: string;
    content: string;
  }>;
  documents?: Array<{
    filename: string;
    extractedText?: string;
    summary?: string;
  }>;
  expectedBehavior?: string;
  actualBehavior?: string;
}

export type AuditResponse = {
  success: boolean;
  results?: {
    summary: string;
    rootCauseHypothesis: string[];
    likelyFiles: string[];
    violatedVectors: string[];
    recommendedFixes: string[];
    testCases: string[];
    suggestedPromptForAnti?: string;
  };
  error?: string;
}
