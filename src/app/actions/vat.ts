"use server"

/**
 * Vector 140: VAT Compliance Engine
 * Ministry of Finance White List (Wykaz Podatników VAT) integration.
 * Public API - no key required.
 * Rate limit: 100 search queries / day per IP.
 */

const VAT_API_BASE = "https://wl-api.mf.gov.pl"

export type VatStatus = "Czynny" | "Zwolniony" | "Niezarejestrowany" | "Nieznany"

export interface VatCheckResult {
    success: boolean
    nip: string
    statusVat: VatStatus
    accountNumbers: string[]    // List of registered IBANs (without PL prefix)
    name?: string               // Company name from MF registry
    checkedAt: string           // ISO date string (YYYY-MM-DD)
    error?: string
}

export interface BankAccountVerification {
    iban: string
    verified: boolean           // true = on the White List for this NIP
    normalizedIban: string      // Normalized form used for comparison
}

/**
 * Gets today's date in YYYY-MM-DD format (Warsaw time).
 */
function getTodayDate(): string {
    return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" }) // sv-SE gives YYYY-MM-DD
}

/**
 * Normalizes an IBAN for comparison:
 * - Strips spaces
 * - Removes "PL" prefix (MF API stores accounts without country code)
 */
function normalizeIban(iban: string): string {
    const stripped = iban.replace(/\s/g, "").toUpperCase()
    // MF API returns 26-digit accounts without "PL" prefix
    if (stripped.startsWith("PL")) return stripped.slice(2)
    return stripped
}

/**
 * Checks VAT payer status and retrieves registered bank accounts.
 * Vector 140: Phase A — Active Status Check.
 *
 * @param nip - 10-digit NIP (with or without dashes)
 */
export async function checkVatStatus(nip: string): Promise<VatCheckResult> {
    const normalizedNip = nip.replace(/[^0-9]/g, "")

    if (normalizedNip.length !== 10) {
        return {
            success: false,
            nip: normalizedNip,
            statusVat: "Nieznany",
            accountNumbers: [],
            checkedAt: getTodayDate(),
            error: "NIP musi składać się z 10 cyfr."
        }
    }

    const date = getTodayDate()
    const url = `${VAT_API_BASE}/api/search/nip/${normalizedNip}?date=${date}`

    try {
        const res = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            next: { revalidate: 3600 } // Cache for 1 hour (VAT status rarely changes intraday)
        })

        if (!res.ok) {
            // 404 means not found / not registered
            if (res.status === 404) {
                return {
                    success: true,
                    nip: normalizedNip,
                    statusVat: "Niezarejestrowany",
                    accountNumbers: [],
                    checkedAt: date
                }
            }
            throw new Error(`MF API returned HTTP ${res.status}`)
        }

        const json = await res.json()
        const subject = json?.result?.subject

        if (!subject) {
            return {
                success: false,
                nip: normalizedNip,
                statusVat: "Nieznany",
                accountNumbers: [],
                checkedAt: date,
                error: "Brak danych podmiotu w odpowiedzi API MF."
            }
        }

        const statusVat: VatStatus = subject.statusVat ?? "Nieznany"
        // accountNumbers come as plain 26-digit strings (no PL prefix)
        const accountNumbers: string[] = Array.isArray(subject.accountNumbers)
            ? subject.accountNumbers
            : []

        console.log(`[VAT_SHIELD] NIP ${normalizedNip}: ${statusVat}, ${accountNumbers.length} kont zarejestrowanych`)

        return {
            success: true,
            nip: normalizedNip,
            statusVat,
            accountNumbers,
            name: subject.name ?? undefined,
            checkedAt: date
        }
    } catch (error: any) {
        console.error("[VAT_SHIELD_ERROR]", error.message)
        return {
            success: false,
            nip: normalizedNip,
            statusVat: "Nieznany",
            accountNumbers: [],
            checkedAt: date,
            error: error.message || "Błąd komunikacji z API Ministerstwa Finansów."
        }
    }
}

/**
 * Verifies whether a bank account (IBAN) is registered on the White List for a given NIP.
 * Vector 140: Phase B — Bank Account Safeguard.
 *
 * @param nip  - 10-digit NIP
 * @param iban - Bank account IBAN (PL-prefix optional, spaces allowed)
 */
export async function verifyBankAccount(nip: string, iban: string): Promise<BankAccountVerification> {
    const normalizedIban = normalizeIban(iban)
    const vatResult = await checkVatStatus(nip)

    const registered = vatResult.accountNumbers.map(acc => normalizeIban(acc))
    const verified = registered.includes(normalizedIban)

    return {
        iban,
        verified,
        normalizedIban
    }
}
