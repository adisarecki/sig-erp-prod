import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

/**
 * Sprawdza czy zdarzenie o podanym ID zostało już przetworzone.
 * Jeśli nie, rejestruje je w bazie.
 * Zwraca true jeśli można kontynuować (zdarzenie nowe), false jeśli duplikat.
 */
export async function checkAndRecordEvent(eventId: string, source: string): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (prisma as any).processedEvent.findUnique({
      where: { eventId }
    })

    if (existing) {
      console.warn(`[Idempotency] Event ${eventId} from ${source} already processed. Skipping.`)
      return false
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).processedEvent.create({
      data: {
        eventId,
        source
      }
    })

    return true
  } catch (error) {
    console.error("[Idempotency] Error checking event status:", error)
    // W razie błędu bazy, dla bezpieczeństwa blokujemy proces (fail-safe)
    return false
  }
}
