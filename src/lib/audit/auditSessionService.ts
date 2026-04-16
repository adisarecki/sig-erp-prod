/**
 * Audit Session Service - Vector 180.15
 * Manages persistent audit investigation sessions
 */

import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { autoCreateContractorWithGus } from "@/app/actions/crm";
import {
  AuditSessionConfig,
  AuditInvoiceItemInput,
  LiveSummary,
} from "./types";

export class AuditSessionService {
  /**
   * Create a new audit investigation session
   */
  static async createSession(
    tenantId: string,
    config: Partial<AuditSessionConfig>
  ) {
    const session = await prisma.auditSession.create({
      data: {
        tenantId,
        citRate: config.citRate || new Decimal("0.09"),
        nipAnchor: config.nipAnchor || "9542751368",
        sourceYear: config.sourceYear || new Date().getFullYear(),
        sourceMonth: config.sourceMonth,
      },
      include: {
        items: true,
      },
    });
    return session;
  }

  /**
   * Get existing audit session
   */
  static async getSession(sessionId: string, tenantId: string) {
    const session = await prisma.auditSession.findUnique({
      where: { id: sessionId },
      include: {
        items: {
          orderBy: { issueDate: "desc" },
          include: {
            correctionOfItem: true,
            linkedInvoice: true,
          },
        },
        generatedReport: true,
      },
    });

    if (!session || session.tenantId !== tenantId) {
      throw new Error("Session not found or unauthorized");
    }

    return session;
  }

  /**
   * Add invoice item to session
   */
  static async addInvoiceItem(
    sessionId: string,
    tenantId: string,
    item: AuditInvoiceItemInput
  ) {
    const session = await this.getSession(sessionId, tenantId);

    // Calculate VAT if not provided
    const safeNum = (v: any) => {
      const n = parseFloat(String(v ?? '0').replace(',', '.'));
      return isNaN(n) ? 0 : n;
    };
    const netAmount = new Decimal(safeNum(item.netAmount));
    const vatRate = new Decimal(safeNum(item.vatRate) || "0.23");
    const vatAmount = item.vatAmount != null
      ? new Decimal(safeNum(item.vatAmount))
      : netAmount.mul(vatRate);
    const grossAmount = item.grossAmount != null
      ? new Decimal(safeNum(item.grossAmount))
      : netAmount.add(vatAmount);

    // ─── VECTOR 200.30: HARDENED COLLISION ENGINE ──────────────────────────
    // Step 1: Keyword-based correction signals (legacy layer)
    const keywordCorrection = this._analyzeCorrection(item);

    // Step 2: Relational Collision — 3-tier logic (duplicate / same-day-correction / date-hierarchy)
    const relationalCollision = await this._detectRelationalCollision(
      sessionId, tenantId, item, netAmount
    );

    // TIER 0: Hard Deduplication (Internal Session or Main Database)
    if (relationalCollision.isDuplicate) {
      console.warn(`[AUDIT_DEDUP] Rejecting duplicate: ${item.invoiceNumber} / ${item.nip}`);
      
      const duplicateItem = await prisma.auditInvoiceItem.create({
        data: {
          auditSessionId: sessionId,
          tenantId,
          invoiceNumber: item.invoiceNumber,
          issueDate: item.issueDate,
          nip: item.nip,
          contractorName: item.contractorName,
          netAmount: netAmount,
          vatRate,
          vatAmount: vatAmount,
          grossAmount: grossAmount,
          ocrConfidence: item.ocrConfidence || 0,
          rawOcrData: item.rawOcrData as any,
          category: item.category || "PROJECT_COST",
          transactionType: this._determineTransactionType(item, session.nipAnchor),
          status: "REJECTED",
          flaggedAsDiscrepancy: true,
          discrepancyReason: "DUPLICATE",
          recordContext: "AUDIT_SESSION",
        },
      });

      await this._updateSessionAggregates(sessionId);
      return duplicateItem;
    }

    // Merge signals: relational takes precedence when it fires
    const isCorrection =
      item.isCorrection ||
      keywordCorrection.isCorrection ||
      relationalCollision.isCorrection;

    const correctionReference =
      relationalCollision.correctionReference ||
      keywordCorrection.correctionReference;

    const correctionGroup =
      relationalCollision.correctionGroup ||
      keywordCorrection.correctionGroup;

    const correctionOfItemId = relationalCollision.correctionOfItemId;
    // ───────────────────────────────────────────────────────────────────────

    const transactionType = this._determineTransactionType(item, session.nipAnchor);
    const {
      netAmount: correctedNet,
      vatAmount: correctedVat,
      grossAmount: correctedGross,
    } = this._normalizeCorrectionAmounts(netAmount, vatAmount, grossAmount, isCorrection);

    const auditItem = await prisma.auditInvoiceItem.create({
      data: {
        auditSessionId: sessionId,
        tenantId,
        invoiceNumber: item.invoiceNumber,
        issueDate: item.issueDate,
        nip: item.nip,
        contractorName: item.contractorName,
        netAmount: correctedNet,
        vatRate,
        vatAmount: correctedVat,
        grossAmount: correctedGross,
        ocrConfidence: item.ocrConfidence || 0,
        rawOcrData: item.rawOcrData,
        licensePlate: item.licensePlate,
        category: item.category || "PROJECT_COST",
        projectId: item.projectId,
        transactionType,
        isCorrection,
        correctionReference,
        correctionGroup,
        correctionOfItemId,
        recordContext: "AUDIT_SESSION",
      },
    });

    // Ensure parent item also gets correctionGroup stamped
    if (correctionOfItemId && correctionGroup) {
      await prisma.auditInvoiceItem.update({
        where: { id: correctionOfItemId },
        data: { correctionGroup },
      });
    }

    // Legacy keyword-based linking (still runs for documents without number collisions)
    if (!isCorrection) {
      await this._attachPendingCorrections(sessionId, {
        id: auditItem.id,
        invoiceNumber: auditItem.invoiceNumber,
        correctionGroup: auditItem.correctionGroup ?? undefined
      });
    }

    // Update session aggregates
    await this._updateSessionAggregates(sessionId);

    return auditItem;
  }

  /**
   * Add multiple items (batch upload)
   */
  static async addBatchInvoiceItems(
    sessionId: string,
    tenantId: string,
    items: AuditInvoiceItemInput[]
  ) {
    const results = [];

    for (const item of items) {
      const result = await this.addInvoiceItem(sessionId, tenantId, item);
      results.push(result);
    }

    await this._updateSessionAggregates(sessionId);
    return results;
  }

  /**
   * Get live summary of audit session
   */
  static async getLiveSummary(sessionId: string, tenantId: string): Promise<LiveSummary> {
    const session = await this.getSession(sessionId, tenantId);

    // Recalculate from items (in case of manual edits)
    const totals = await this._calculateTotals(sessionId);

    return {
      itemCount: session.itemCount,
      verifiedCount: session.verifiedCount,
      pendingCount: session.pendingCount,
      rejectedCount: session.rejectedCount,
      totals,
      vatSaldo: totals.vatAmount,
      citLiability: totals.citAmount,
      grossLiability: totals.grossAmount,
      citRate: session.citRate,
    };
  }

  /**
   * Update aggregates by recalculating from items
   */
  private static async _updateSessionAggregates(sessionId: string) {
    const items = await prisma.auditInvoiceItem.findMany({
      where: { auditSessionId: sessionId },
    });

    const totals = await this._calculateTotals(sessionId);

    await prisma.auditSession.update({
      where: { id: sessionId },
      data: {
        itemCount: items.length,
        verifiedCount: items.filter((i) => i.status === "VERIFIED" || i.ocrConfidence >= 95).length,
        pendingCount: items.filter((i) => i.status === "PENDING").length,
        rejectedCount: items.filter((i) => i.status === "REJECTED").length,
        totalNetAmount: totals.netAmount.toDP(2),
        totalVatAmount: totals.vatAmount.toDP(2),
        totalGrossAmount: totals.grossAmount.toDP(2),
        totalCitAmount: totals.citAmount.toDP(2),
      },
    });
  }

  /**
   * Calculate totals from session items
   */
  private static async _calculateTotals(
    sessionId: string
  ): Promise<{ netAmount: Decimal; vatAmount: Decimal; grossAmount: Decimal; citAmount: Decimal }> {
    const items = await prisma.auditInvoiceItem.findMany({
      where: {
        auditSessionId: sessionId,
        status: { in: ["PENDING", "VERIFIED", "MANUAL_OVERRIDE"] },
      },
    });

    const session = await prisma.auditSession.findUnique({
      where: { id: sessionId },
    });

    // ─── VECTOR 200.25: TRANSACTION STACK AGGREGATION ──────────────────────
    // Group items by correctionGroup (stack key). Items in the same stack are
    // summed with SIGNED math — corrections are already negative — so the
    // result is automatically the reconciled "Net Truth" for that stack.
    // Items with no correctionGroup are treated as standalone stacks.
    const stacks = new Map<string, { net: Decimal; vat: Decimal; gross: Decimal }>();

    items.forEach((item, idx) => {
      const stackKey = item.correctionGroup || `__standalone_${idx}`;
      const existing = stacks.get(stackKey) ?? { net: new Decimal(0), vat: new Decimal(0), gross: new Decimal(0) };
      stacks.set(stackKey, {
        net: existing.net.add(new Decimal(String(item.netAmount))),
        vat: existing.vat.add(new Decimal(String(item.vatAmount))),
        gross: existing.gross.add(new Decimal(String(item.grossAmount))),
      });
    });

    let netAmount = new Decimal(0);
    let vatAmount = new Decimal(0);
    let grossAmount = new Decimal(0);

    stacks.forEach((stack) => {
      netAmount = netAmount.add(stack.net);
      vatAmount = vatAmount.add(stack.vat);
      grossAmount = grossAmount.add(stack.gross);
    });
    // ───────────────────────────────────────────────────────────────────────

    // CIT is applied strictly to the reconciled net total (Vector 200.25)
    const citAmount = netAmount.gt(0) ? netAmount.mul(session!.citRate) : new Decimal(0);

    return {
      netAmount,
      vatAmount,
      grossAmount,
      citAmount,
    };
  }

  /**
   * Parse correction signals from invoice OCR / metadata (keyword-based layer)
   */
  private static _analyzeCorrection(item: AuditInvoiceItemInput) {
    const textFragments: string[] = [
      item.invoiceNumber || "",
      item.contractorName || "",
      item.rawOcrData ? JSON.stringify(item.rawOcrData) : "",
    ];

    const text = textFragments.join(" ").toUpperCase();
    const correctionPattern = /KORYGUJĄCA|KORYGUJACA|\bKOR\b|DOTYCZY FAKTURY NR|KOREKTA|RÓŻNICA|ROZNICA|PRZED KOREKT(?:Ą|A)|PO KOREKCIE/i;
    const isCorrection = correctionPattern.test(text);

    let correctionReference: string | undefined;
    const referenceMatch = text.match(/DOTYCZY FAKTURY NR[:\s]*([A-Z0-9\/\-\.]+)/i);
    if (referenceMatch) {
      correctionReference = this._normalizeInvoiceNumber(referenceMatch[1]);
    } else if (item.invoiceNumber?.toUpperCase().includes("/KOR")) {
      correctionReference = this._normalizeInvoiceNumber(
        item.invoiceNumber.replace(/\/KOR$/i, "")
      );
    }

    const correctionGroup = correctionReference ||
      (isCorrection && item.invoiceNumber
        ? this._normalizeInvoiceNumber(item.invoiceNumber)
        : undefined);

    return {
      isCorrection,
      correctionReference,
      correctionGroup,
    };
  }

  /**
   * VECTOR 200.30: HARDENED COLLISION ENGINE — 3-Tier Detection
   *
   * TIER 1 — Exact Duplicate: NIP + Number + Date + Net all match → isDuplicate = true
   * TIER 2 — Same-day Correction: NIP + Number + Date match, Net differs →
   *           check /KOR suffix or OCR keywords → isCorrection = true
   * TIER 3 — Temporal (date-based): Later date = correction (original Vector 200.25 rule)
   */
  private static async _detectRelationalCollision(
    sessionId: string,
    tenantId: string,
    item: AuditInvoiceItemInput,
    incomingNet: Decimal
  ): Promise<{
    isDuplicate?: boolean;
    isCorrection: boolean;
    correctionOfItemId?: string;
    correctionReference?: string;
    correctionGroup?: string;
  }> {
    const normalizedNumber = this._normalizeInvoiceNumber(item.invoiceNumber);
    const cleanNip = item.nip.replace(/\D/g, "");
    const incomingDateStr = new Date(item.issueDate).toISOString().slice(0, 10);

    // Search all collisions in the same session (same number + NIP)
    const sessionCollisions = await prisma.auditInvoiceItem.findMany({
      where: {
        auditSessionId: sessionId,
        nip: { contains: cleanNip },
        OR: [
          { invoiceNumber: { equals: normalizedNumber, mode: "insensitive" } },
          { invoiceNumber: { equals: item.invoiceNumber, mode: "insensitive" } },
        ],
      },
      orderBy: { issueDate: 'asc' },
    });

    if (sessionCollisions.length > 0) {
      const sharedGroup = normalizedNumber;

      for (const existing of sessionCollisions) {
        const existingDateStr = new Date(existing.issueDate).toISOString().slice(0, 10);
        const existingNet = new Decimal(String(existing.netAmount)).abs();
        const absIncoming = incomingNet.abs();

        // ── TIER 1: EXACT DUPLICATE ──────────────────────────────────────────
        // NIP + Number + Date + Net (absolute) all identical → discard
        if (
          existingDateStr === incomingDateStr &&
          existingNet.eq(absIncoming)
        ) {
          return { isDuplicate: true, isCorrection: false };
        }

        // ── TIER 2: SAME-DAY CORRECTION ──────────────────────────────────────
        // NIP + Number + Date match, but Net differs → determine which is correction
        if (existingDateStr === incomingDateStr && !existingNet.eq(absIncoming)) {
          // Check if INCOMING has correction signals (/KOR, keyword)
          const incomingHasKorSignal =
            /\/KOR(EKTA)?$/i.test(item.invoiceNumber) ||
            /KORYGUJ|KOREKTA|KOR\b/i.test(JSON.stringify(item.rawOcrData || ""));

          // Check if EXISTING has correction signals
          const existingHasKorSignal =
            /\/KOR(EKTA)?$/i.test(existing.invoiceNumber) ||
            /KORYGUJ|KOREKTA|KOR\b/i.test(JSON.stringify(existing.rawOcrData || ""));

          if (incomingHasKorSignal && !existingHasKorSignal) {
            // INCOMING is the correction (has /KOR or keyword)
            return {
              isCorrection: true,
              correctionOfItemId: existing.id,
              correctionReference: normalizedNumber,
              correctionGroup: sharedGroup,
            };
          } else if (existingHasKorSignal && !incomingHasKorSignal) {
            // EXISTING is the correction — retroactively stamp it, incoming is original
            await prisma.auditInvoiceItem.update({
              where: { id: existing.id },
              data: { isCorrection: true, correctionReference: normalizedNumber, correctionGroup: sharedGroup },
            });
            return { isCorrection: false, correctionGroup: sharedGroup };
          } else {
            // No KOR signal on either — use smaller absolute value as the delta/correction
            const incomingIsSmaller = absIncoming.lt(existingNet);
            if (incomingIsSmaller) {
              // Smaller value = correction delta
              return {
                isCorrection: true,
                correctionOfItemId: existing.id,
                correctionReference: normalizedNumber,
                correctionGroup: sharedGroup,
              };
            } else {
              // Existing is smaller (it came in first and is the correction)
              await prisma.auditInvoiceItem.update({
                where: { id: existing.id },
                data: { isCorrection: true, correctionReference: normalizedNumber, correctionGroup: sharedGroup },
              });
              return { isCorrection: false, correctionGroup: sharedGroup };
            }
          }
        }

        // ── TIER 3: DATE HIERARCHY ────────────────────────────────────────────
        const existingDate = new Date(existing.issueDate).getTime();
        const incomingDate = new Date(item.issueDate).getTime();

        if (incomingDate > existingDate) {
          return {
            isCorrection: true,
            correctionOfItemId: existing.id,
            correctionReference: normalizedNumber,
            correctionGroup: sharedGroup,
          };
        } else if (incomingDate < existingDate) {
          await prisma.auditInvoiceItem.update({
            where: { id: existing.id },
            data: { isCorrection: true, correctionReference: normalizedNumber, correctionGroup: sharedGroup },
          });
          return { isCorrection: false, correctionGroup: sharedGroup };
        }
      }

      // Collision found but no clear correction signal — just group them
      return { isCorrection: false, correctionGroup: sharedGroup };
    }

    // Also check the main operational Invoice table (cross-session/cross-audit deduplication)
    const dbCollision = await prisma.invoice.findFirst({
      where: {
        tenantId,
        invoiceNumber: { equals: normalizedNumber, mode: "insensitive" },
        contractor: { nip: cleanNip },
      },
    });

    if (dbCollision) {
      const dbDateStr = new Date(dbCollision.issueDate).toISOString().slice(0, 10);
      const dbNet = new Decimal(String(dbCollision.amountNet)).abs();
      const absIncoming = incomingNet.abs();

      // STRICT DEDUPLICATION: If NIP + Number + Net match exactly in main DB
      if (dbNet.eq(absIncoming)) {
        return { isDuplicate: true, isCorrection: false };
      }

      const existingDate = new Date(dbCollision.issueDate).getTime();
      const incomingDate = new Date(item.issueDate).getTime();
      if (incomingDate > existingDate) {
        return {
          isCorrection: true,
          correctionReference: normalizedNumber,
          correctionGroup: normalizedNumber,
        };
      }
    }

    return { isCorrection: false };
  }

  private static _normalizeCorrectionAmounts(
    netAmount: Decimal,
    vatAmount: Decimal,
    grossAmount: Decimal,
    isCorrection: boolean
  ) {
    const net = new Decimal(netAmount);
    const vat = new Decimal(vatAmount);
    const gross = new Decimal(grossAmount);

    if (!isCorrection) {
      return {
        netAmount: net,
        vatAmount: vat,
        grossAmount: gross,
      };
    }

    // VECTOR 200.35: Ensure corrections are always treated as deltas (negative from base)
    // If they are already negative, keep them. If positive, negate them.
    return {
      netAmount: net.isNegative() ? net : net.negated(),
      vatAmount: vat.isNegative() ? vat : vat.negated(),
      grossAmount: gross.isNegative() ? gross : gross.negated(),
    };
  }

  private static _normalizeInvoiceNumber(invoiceNumber: string) {
    return invoiceNumber
      .trim()
      .replace(/\s+/g, "")
      .replace(/[^A-Z0-9\/\-\.]/gi, "")
      .toUpperCase();
  }

  private static _determineTransactionType(item: AuditInvoiceItemInput, nipAnchor: string) {
    const cleanNip = item.nip.replace(/\D/g, "");
    const normalizedAnchor = nipAnchor.replace(/\D/g, "");
    const contractorText = `${item.contractorName || ""}`.toUpperCase();
    const anchorHit = cleanNip === normalizedAnchor || contractorText.includes(normalizedAnchor);

    return anchorHit ? "SPRZEDAŻ" : "KOSZT";
  }

  private static async _findCorrectionTarget(
    sessionId: string,
    tenantId: string,
    correctionReference: string
  ) {
    const normalizedReference = this._normalizeInvoiceNumber(correctionReference);

    const sessionItem = await prisma.auditInvoiceItem.findFirst({
      where: {
        auditSessionId: sessionId,
        OR: [
          { invoiceNumber: { equals: correctionReference, mode: "insensitive" } },
          { invoiceNumber: { equals: normalizedReference, mode: "insensitive" } },
          { correctionGroup: normalizedReference },
        ],
      },
    });

    if (sessionItem) {
      return sessionItem;
    }

    const invoice = await prisma.invoice.findFirst({
      where: {
        tenantId,
        invoiceNumber: { equals: normalizedReference, mode: "insensitive" },
      },
    });

    if (invoice) {
      return {
        id: undefined,
        correctionGroup: normalizedReference,
        linkedInvoiceId: invoice.id,
      } as any;
    }

    return null;
  }

  private static async _attachPendingCorrections(
    sessionId: string,
    auditItem: { id: string; invoiceNumber: string; correctionGroup?: string }
  ) {
    if (!auditItem.invoiceNumber) {
      return;
    }

    const normalizedInvoiceNumber = this._normalizeInvoiceNumber(auditItem.invoiceNumber);

    const pendingCorrections = await prisma.auditInvoiceItem.findMany({
      where: {
        auditSessionId: sessionId,
        correctionReference: normalizedInvoiceNumber,
      },
    });

    for (const correction of pendingCorrections) {
      await prisma.auditInvoiceItem.update({
        where: { id: correction.id },
        data: {
          correctionOfItemId: auditItem.id,
          correctionGroup: correction.correctionGroup || auditItem.correctionGroup,
        },
      });
    }
  }

  /**
   * Update item status
   */
  static async updateItemStatus(
    itemId: string,
    status: string,
    tenantId: string
  ) {
    const item = await prisma.auditInvoiceItem.update({
      where: { id: itemId },
      data: { status: status as any },
    });

    // Update session aggregates
    await this._updateSessionAggregates(item.auditSessionId);

    return item;
  }

  /**
   * Mark item as manually reviewed
   */
  static async markItemAsReviewed(
    itemId: string,
    reviewedBy: string,
    notes?: string
  ) {
    const item = await prisma.auditInvoiceItem.update({
      where: { id: itemId },
      data: {
        status: "MANUAL_OVERRIDE",
        manualReviewNotes: notes,
        reviewedBy,
        reviewedAt: new Date(),
      },
    });

    // Update session aggregates
    await this._updateSessionAggregates(item.auditSessionId);

    return item;
  }

  /**
   * Finalize the audit session and generate report
   */
  static async finalizeSession(sessionId: string, tenantId: string) {
    await this.getSession(sessionId, tenantId);

    const updated = await prisma.$transaction(async (tx) => {
      await this._commitSessionItems(tx, sessionId, tenantId);

      return tx.auditSession.update({
        where: { id: sessionId },
        data: {
          status: "COMPLETED",
        },
        include: {
          items: {
            orderBy: { issueDate: "desc" },
            include: {
              correctionOfItem: true,
              linkedInvoice: true,
            },
          },
          generatedReport: true,
        },
      });
    });

    return updated;
  }

  private static async _commitSessionItems(
    tx: Prisma.TransactionClient,
    sessionId: string,
    tenantId: string
  ) {
    const items = await tx.auditInvoiceItem.findMany({
      where: {
        auditSessionId: sessionId,
        status: { in: ["VERIFIED", "MANUAL_OVERRIDE"] },
        linkedInvoiceId: null,
      },
    });

    for (const item of items) {
      const contractorId = await this._resolveContractorId(
        tx,
        item.nip,
        item.contractorName,
        tenantId
      );
      if (!contractorId) {
        continue;
      }

      const invoiceType = item.transactionType || "KOSZT";
      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          contractorId,
          projectId: item.projectId,
          type: invoiceType,
          amountNet: item.netAmount,
          amountGross: item.grossAmount,
          taxRate: item.vatRate,
          issueDate: item.issueDate,
          dueDate: item.issueDate,
          status: "ACTIVE",
          paymentStatus: "UNPAID",
          invoiceNumber: item.invoiceNumber,
          externalId: item.invoiceNumber,
          rawOcrData: item.rawOcrData as any,
          auditDiscrepancy: item.flaggedAsDiscrepancy,
          recordContext: "AUDIT_SESSION",
        },
      });

      await tx.ledgerEntry.create({
        data: {
          tenantId,
          projectId: item.projectId,
          source: "INVOICE",
          sourceId: invoice.id,
          amount: item.netAmount,
          type: invoiceType === "SPRZEDAŻ" ? "INCOME" : "EXPENSE",
          date: item.issueDate,
          rawOcrData: item.rawOcrData as any,
          recordContext: "AUDIT_SESSION",
        },
      });

      await tx.auditInvoiceItem.update({
        where: { id: item.id },
        data: { linkedInvoiceId: invoice.id },
      });
    }
  }

  private static async _resolveContractorId(
    tx: Prisma.TransactionClient,
    nip: string,
    contractorName: string,
    tenantId: string
  ) {
    const cleanNip = nip.replace(/\D/g, "");
    if (cleanNip.length === 10) {
      const existing = await tx.contractor.findFirst({
        where: { tenantId, nip: cleanNip },
        select: { id: true },
      });
      if (existing) {
        return existing.id;
      }
      const gusCreated = await autoCreateContractorWithGus(cleanNip);
      if (gusCreated) {
        return gusCreated;
      }
    }

    const fuzzy = await tx.contractor.findFirst({
      where: {
        tenantId,
        name: {
          contains: contractorName,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    return fuzzy?.id || null;
  }

  /**
   * List all audit sessions for a tenant
   */
  static async listSessions(tenantId: string, limit = 10, offset = 0) {
    const sessions = await prisma.auditSession.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        items: true,
        generatedReport: true,
      },
    });

    return sessions;
  }
}
