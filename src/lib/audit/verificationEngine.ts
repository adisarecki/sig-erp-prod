/**
 * Verification Engine (PEWNIAK System) - Vector 180.15
 * Autonomous verification of invoices based on OCR confidence, NIP matching, and license plates
 */

import prisma from "@/lib/prisma";
import {
  AuditItemVerificationResult,
  KNOWN_CONTRACTORS,
  LICENSE_PLATE_ANCHOR,
  OCR_CONFIDENCE_THRESHOLD,
} from "./types";

export class VerificationEngine {
  /**
   * Verify an audit invoice item
   * Implements the PEWNIAK system logic
   */
  static async verifyItem(itemId: string): Promise<AuditItemVerificationResult> {
    const item = await prisma.auditInvoiceItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new Error("Item not found");
    }

    // Check OCR Confidence
    if (item.ocrConfidence > OCR_CONFIDENCE_THRESHOLD) {
      // Check NIP matching
      const nipMatch = this._checkNipMatch(item.nip, item.contractorName);
      if (nipMatch) {
        // Check License Plate matching
        if (item.licensePlate && this._checkLicensePlate(item.licensePlate)) {
          return {
            isVerified: true,
            reason: "LICENSE_PLATE_MATCHED",
            confidence: 100,
          };
        }

        return {
          isVerified: true,
          reason: "NIP_MATCHED",
          confidence: item.ocrConfidence,
        };
      }

      // High OCR confidence alone is sufficient
      return {
        isVerified: true,
        reason: "OCR_CONFIDENCE",
        confidence: item.ocrConfidence,
      };
    }

    return {
      isVerified: false,
      reason: "INSUFFICIENT_CONFIDENCE",
      confidence: item.ocrConfidence,
    };
  }

  /**
   * Auto-verify all items in a session that meet criteria
   */
  static async autoVerifySession(sessionId: string): Promise<number> {
    const items = await prisma.auditInvoiceItem.findMany({
      where: {
        auditSessionId: sessionId,
        status: "PENDING",
      },
    });

    let verifiedCount = 0;

    for (const item of items) {
      const result = await this.verifyItem(item.id);

      if (result.isVerified) {
        await prisma.auditInvoiceItem.update({
          where: { id: item.id },
          data: {
            status: "VERIFIED",
            isAutoVerified: true,
            autoVerifyReason: result.reason,
          },
        });
        verifiedCount++;
      }
    }

    // Update session counts
    const session = await prisma.auditSession.findUnique({
      where: { id: sessionId },
    });

    if (session) {
      await prisma.auditSession.update({
        where: { id: sessionId },
        data: {
          verifiedCount: verifiedCount,
          pendingCount: items.length - verifiedCount,
        },
      });
    }

    return verifiedCount;
  }

  /**
   * Check if NIP matches known contractors
   */
  private static _checkNipMatch(nip: string, contractorName: string): boolean {
    // Check against known contractors
    for (const [key, contractor] of Object.entries(KNOWN_CONTRACTORS)) {
      if (contractor.names.some((name) =>
        contractorName.toUpperCase().includes(name.toUpperCase())
      )) {
        return true;
      }
    }

    // Could also check against contractor database here
    return false;
  }

  /**
   * Check if license plate matches anchor
   */
  private static _checkLicensePlate(licensePlate: string): boolean {
    return licensePlate === LICENSE_PLATE_ANCHOR;
  }

  /**
   * Get all unverified items
   */
  static async getUnverifiedItems(sessionId: string) {
    return prisma.auditInvoiceItem.findMany({
      where: {
        auditSessionId: sessionId,
        status: "PENDING",
      },
    });
  }

  /**
   * Manually override verification status
   */
  static async overrideVerification(
    itemId: string,
    isVerified: boolean,
    reason?: string
  ) {
    return prisma.auditInvoiceItem.update({
      where: { id: itemId },
      data: {
        status: isVerified ? "MANUAL_OVERRIDE" : "REJECTED",
        isAutoVerified: false,
        autoVerifyReason: reason,
      },
    });
  }

  /**
   * Detect duplicate invoices in a session
   */
  static async detectDuplicates(sessionId: string) {
    const items = await prisma.auditInvoiceItem.findMany({
      where: { auditSessionId: sessionId },
    });

    const duplicates: Array<{ original: any; duplicate: any }> = [];

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (this._itemsAreDuplicate(items[i], items[j])) {
          duplicates.push({
            original: items[i],
            duplicate: items[j],
          });

          // Mark duplicate
          await prisma.auditInvoiceItem.update({
            where: { id: items[j].id },
            data: {
              status: "DUPLICATE",
              flaggedAsDiscrepancy: true,
              discrepancyReason: "DUPLICATE_INVOICE",
              duplicateOf: items[i].id,
            },
          });
        }
      }
    }

    return duplicates;
  }

  /**
   * Check if two items are duplicates
   */
  private static _itemsAreDuplicate(item1: any, item2: any): boolean {
    // Same invoice number, NIP, and amount
    return (
      item1.invoiceNumber === item2.invoiceNumber &&
      item1.nip === item2.nip &&
      item1.grossAmount === item2.grossAmount
    );
  }
}
