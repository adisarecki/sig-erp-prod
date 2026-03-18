import prisma from "@/lib/prisma"
import Decimal from "decimal.js"

/**
 * Konfiguracja precyzji finansowej Sig ERP.
 */
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

export type LedgerEntity = {
  amount?: Decimal | unknown
  amountNet?: Decimal | unknown
  amountGross?: Decimal | unknown
  status: string
}

/**
 * Waliduje próbę edycji pola kwoty. 
 * Zgodnie ze standardem Fintech, recordy inne niż DRAFT są niezmienne (Immutable).
 */
export function validateImmutableChange(
  current: LedgerEntity,
  requested: Partial<LedgerEntity>
): { allowed: boolean, error?: string } {
  if (current.status === "DRAFT") return { allowed: true }

  const amountFields = ["amount", "amountNet", "amountGross"]
  for (const field of amountFields) {
    if (field in requested) {
      const curVal = new Decimal(String(current[field as keyof LedgerEntity] || 0))
      const reqVal = new Decimal(String(requested[field as keyof LedgerEntity] || 0))
      
      if (!curVal.equals(reqVal)) {
        return { 
          allowed: false, 
          error: `Pole ${field} jest niezmienne dla statusu ${current.status}. Użyj mechanizmu Reversal.` 
        }
      }
    }
  }

  return { allowed: true }
}

/**
 * Mechanizm Reversal: Tworzy transakcję korygującą (znak przeciwny).
 * Oryginalna transakcja zostaje oznaczona jako REVERSED.
 */
export async function createTransactionReversal(transactionId: string) {
  return await prisma.$transaction(async (tx) => {
    const original = await tx.transaction.findUnique({
      where: { id: transactionId }
    })

    if (!original) throw new Error("Nie znaleziono transakcji.")
    if (original.status === "REVERSED") throw new Error("Transakcja została już skorygowana.")

    const reversalAmount = new Decimal(String(original.amount)).negated()

    // 1. Oznaczamy oryginał jako REVERSED
    await tx.transaction.update({
      where: { id: transactionId },
      data: { status: "REVERSED" }
    })

    // 2. Tworzymy nowy rekord korygujący
    const reversalRecord = await tx.transaction.create({
      data: {
        tenantId: original.tenantId,
        projectId: original.projectId,
        amount: reversalAmount,
        type: original.type,
        transactionDate: new Date(),
        category: "KOREKTA",
        description: `Korekta (Reversal) transakcji: ${original.id}. Powód: wycofanie.`,
        status: "REVERSED",
        source: original.source,
        reversalOf: original.id
      }
    })

    return reversalRecord
  })
}

/**
 * Walidacja "Zero" - Sig ERP nie przyjmuje pustych operacji.
 */
export function validateNonZero(amount: string | Decimal): boolean {
  const dec = new Decimal(String(amount))
  return !dec.isZero()
}
