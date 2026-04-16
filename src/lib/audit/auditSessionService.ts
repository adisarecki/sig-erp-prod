/**
 * Audit Session Service - Vector 180.15
 * Manages persistent audit investigation sessions
 */

import prisma from "@/lib/prisma";
import Decimal from "decimal.js";
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
        sourceYear: config.sourceYear,
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
        items: true,
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
    const netAmount = new Decimal(item.netAmount);
    const vatRate = new Decimal(item.vatRate || "0.23");
    const vatAmount = item.vatAmount
      ? new Decimal(item.vatAmount)
      : netAmount.mul(vatRate);
    const grossAmount = item.grossAmount
      ? new Decimal(item.grossAmount)
      : netAmount.add(vatAmount);

    const auditItem = await prisma.auditInvoiceItem.create({
      data: {
        auditSessionId: sessionId,
        tenantId,
        invoiceNumber: item.invoiceNumber,
        issueDate: item.issueDate,
        nip: item.nip,
        contractorName: item.contractorName,
        netAmount,
        vatRate,
        vatAmount,
        grossAmount,
        ocrConfidence: item.ocrConfidence || 0,
        rawOcrData: item.rawOcrData,
        licensePlate: item.licensePlate,
        category: item.category || "PROJECT_COST",
        projectId: item.projectId,
      },
    });

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
        verifiedCount: items.filter((i) => i.isAutoVerified).length,
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

    let netAmount = new Decimal(0);
    let vatAmount = new Decimal(0);
    let grossAmount = new Decimal(0);

    items.forEach((item) => {
      netAmount = netAmount.add(item.netAmount);
      vatAmount = vatAmount.add(item.vatAmount);
      grossAmount = grossAmount.add(item.grossAmount);
    });

    const citAmount = netAmount.mul(session!.citRate);

    return {
      netAmount,
      vatAmount,
      grossAmount,
      citAmount,
    };
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
      data: { status },
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
    const session = await this.getSession(sessionId, tenantId);

    // Update status to COMPLETED
    const updated = await prisma.auditSession.update({
      where: { id: sessionId },
      data: {
        status: "COMPLETED",
      },
      include: {
        items: true,
      },
    });

    // Generate report (handled by ReportGeneratorService)
    return updated;
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
