import { XMLParser } from "fast-xml-parser"
import type { ParsedBankTransaction, ParsedContractor } from "./pko-parser"

// ─── Shared Utilities ────────────────────────────────────────────────────────

const TRASH_PHRASES = [
    "wypłata w bankomacie",
    "wpłata w bankomacie",
    "przelew własny",
    "przelew wewnętrzny",
    "przelew na rachunek własny",
    "płatność blik",
    "blik",
    "zakup przy użyciu karty",
    "zapłata kartą",
    "prowizja",
    "opłata",
    "rozliczenie transakcji",
    "kapitalizacja odsetek",
    "odsetki od środków",
]

function isTrash(text: string): boolean {
    const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return TRASH_PHRASES.some(t =>
        lower.includes(t.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
    )
}

function toTitleCase(str: string): string {
    return str.replace(
        /\w\S*/g,
        txt => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
    )
}

/**
 * Extracts a NIP (exactly 10 digits) from any string.
 */
function extractNip(text: string | undefined): string | null {
    if (!text) return null
    const cleaned = String(text).replace(/[-.\s]/g, "")
    const match = cleaned.match(/(?<!\d)\d{10}(?!\d)/)
    return match ? match[0] : null
}

function asArray<T>(val: T | T[] | undefined): T[] {
    if (!val) return []
    return Array.isArray(val) ? val : [val]
}

// ─── Bank Prefix Cleaner ────────────────────────────────────────────────────

/** Strips common PKO BP operation prefixes that get glued to contractor names */
const BANK_PREFIXES = [
    /^przelew\s+(z\s+rachunku|na\s+rachunek|przychodzący|wychodzący)\s*/i,
    /^przelew\s+krajowy\s*/i,
    /^przelew\s+elixir\s*/i,
    /^płatność\s+kartą\s*/i,
    /^zakup\s+kartą\s*/i,
    /^operacja\s+kartą\s*/i,
]

function stripBankPrefix(text: string): string {
    let result = text
    for (const prefix of BANK_PREFIXES) {
        result = result.replace(prefix, "")
    }
    return result.trim()
}

// ─── CORE 2: Native PKO BP (account_history) ────────────────────────────────

/**
 * extractPartyData – REGEX MASZYNKA
 */
export function extractPartyData(desc: string): {
    name: string | null
    address: string | null
    nip: string | null
} {
    const text = desc.replace(/\r\n?/g, "\n")
    let name: string | null = null
    let address: string | null = null

    const nameMatch = text.match(
        /(?:Nazwa\s+odbiorcy|Nazwa\s+nadawcy|Nazwa\s+zleceniodawcy):\s*(.*?)(?=\s*(?:Adres\s+odbiorcy|Adres\s+nadawcy|Tytuł|NIP):|$)/i
    )
    if (nameMatch) {
        name = stripBankPrefix(nameMatch[1].trim())
    }

    const addrMatch = text.match(
        /(?:Adres\s+odbiorcy|Adres\s+nadawcy|Adres\s+zleceniodawcy):\s*(.*?)(?=\s*(?:Tytuł|NIP|Rachunek):|$)/i
    )
    if (addrMatch) {
        address = addrMatch[1].trim()
    }

    if (!name) {
        const lokMatch = text.match(/Lokalizacja:\s*Adres:\s*(.*?)\s*Miasto:/i)
        if (lokMatch) {
            name = stripBankPrefix(lokMatch[1].trim())
            const cityMatch = text.match(/Miasto:\s*(.*?)(?:\s*Kraj:|$)/i)
            const countryMatch = text.match(/Kraj:\s*(.*?)(?:\s*$|\n)/i)
            const parts: string[] = []
            if (cityMatch) parts.push(cityMatch[1].trim())
            if (countryMatch && countryMatch[1].trim().toUpperCase() !== "POLSKA") {
                parts.push(countryMatch[1].trim())
            }
            if (parts.length > 0 && !address) {
                address = parts.join(", ")
            }
        }
    }

    if (!name) {
        const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 2)
        for (const line of lines) {
            const cleaned = stripBankPrefix(line)
            if (cleaned.length > 2 && !cleaned.match(/^(rachunek|tytuł|data|nr ref|numer)/i)) {
                name = cleaned
                break
            }
        }
    }

    const nip = extractNip(text)
    return { name, address, nip }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseNativePko(parsed: any): ParsedBankTransaction[] {
    const root = parsed?.account_history ?? parsed?.["account_history"]
    if (!root) throw new Error("Nie znaleziono węzła <account_history> w pliku XML.")

    const operations = asArray(root?.operations?.operation ?? root?.operations?.["operation"])
    if (operations.length === 0) throw new Error("Brak operacji (<operation>) in XML.")

    const results: ParsedBankTransaction[] = []

    for (let i = 0; i < operations.length; i++) {
        const op = operations[i]
        const description = String(op?.description ?? op?.["description"] ?? "")
        const title = String(op?.title ?? op?.["title"] ?? "")
        const amount = String(op?.amount ?? op?.["amount"] ?? "0")
        const date = String(op?.["exec-date"] ?? op?.["order-date"] ?? "")

        if (isTrash(description)) continue

        const { name, address, nip: nipFromDesc } = extractPartyData(description)
        const nip = nipFromDesc ?? extractNip(title)
        if (!name || name.length < 2) continue

        results.push({
            id: `pko_xml_native_${i}`,
            date: new Date(date),
            amount: amount,
            description: title || "Przelew",
            senderName: name,
            contractor: {
                name: toTitleCase(name),
                nip: nip,
                address: address
            }
        })
    }
    return results
}

// ─── CORE 1: ISO 20022 camt.053 ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCamt053(parsed: any): ParsedBankTransaction[] {
    const doc = parsed?.Document?.BkToCstmrStmt ?? parsed?.["Document"]?.["BkToCstmrStmt"]
    const stmt = (doc as any)?.Stmt ?? doc
    const entries: any[] = asArray((stmt as any)?.Ntry)

    const results: ParsedBankTransaction [] = []

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]
        const entryDetails = asArray(entry?.NtryDtls)
        const date = entry?.BookgDt?.Dt || entry?.BookgDt?.DtTm || ""
        const amount = entry?.Amt?.["#text"] ?? entry?.Amt ?? "0"
        const creditDebit = entry?.CdtDbtInd // CRDT or DBIT
        const finalAmount = creditDebit === "DBIT" ? `-${amount}` : `${amount}`

        for (const detail of entryDetails) {
            const txDetails = asArray(detail?.TxDtls)
            for (let j = 0; j < txDetails.length; j++) {
                const tx = txDetails[j]
                const relatedParties = tx?.RltdPties
                const counterparty = relatedParties?.Cdtr ?? relatedParties?.Dbtr
                const rawName: string = (counterparty?.Nm ?? counterparty?.Pty?.Nm ?? tx?.RmtInf?.Ustrd ?? "").toString().trim()

                if (!rawName || rawName.length < 2) continue
                if (isTrash(rawName)) continue

                const postalAdr = counterparty?.PstlAdr ?? counterparty?.Pty?.PstlAdr
                const adrLines: string[] = asArray(postalAdr?.AdrLine).map(String)
                const address = adrLines.length > 0 ? adrLines.join(", ") : null
                const nip = extractNip(tx?.RmtInf?.Ustrd ?? "")

                results.push({
                    id: `pko_xml_camt_${i}_${j}`,
                    date: new Date(date),
                    amount: finalAmount,
                    description: tx?.RmtInf?.Ustrd || "Przelew",
                    senderName: rawName,
                    contractor: {
                        name: toTitleCase(rawName),
                        nip: nip,
                        address: address
                    }
                })
            }
        }
    }
    return results
}

// ─── Main Entry Point (Auto-Detect) ─────────────────────────────────────────

export function parsePkoXml(xmlContent: string): ParsedBankTransaction[] {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        isArray: (tagName) => ["Ntry", "NtryDtls", "TxDtls", "AdrLine", "operation"].includes(tagName),
        parseTagValue: true,
        trimValues: true,
    })

    const parsed = parser.parse(xmlContent)
    const rootKeys = Object.keys(parsed ?? {}).filter(k => !k.startsWith("?") && !k.startsWith("@"))

    if (rootKeys.some(k => k.includes("account_history"))) return parseNativePko(parsed)
    if (rootKeys.some(k => k.toLowerCase().includes("document"))) return parseCamt053(parsed)

    try { return parseNativePko(parsed) } catch { /* ignore */ }
    try { return parseCamt053(parsed) } catch { /* ignore */ }

    throw new Error("Nierozpoznany format XML.")
}

export function parsePkoXmlToContractors(xmlContent: string): ParsedContractor[] {
    const transactions = parsePkoXml(xmlContent)
    const contractorMap = new Map<string, { nip: string | null; address: string | null; count: number }>()

    for (const tx of transactions) {
        const key = tx.contractor.name.toUpperCase().replace(/\s+/g, " ").trim()
        if (contractorMap.has(key)) {
            const existing = contractorMap.get(key)!
            existing.count += 1
            if (!existing.nip && tx.contractor.nip) existing.nip = tx.contractor.nip
            if (!existing.address && tx.contractor.address) existing.address = tx.contractor.address
        } else {
            contractorMap.set(key, { nip: tx.contractor.nip, address: tx.contractor.address, count: 1 })
        }
    }

    const results: ParsedContractor[] = []
    let idx = 0
    for (const [key, val] of contractorMap.entries()) {
        results.push({
            id: `xml_ctr_${idx++}`,
            originalName: key,
            suggestedName: toTitleCase(key),
            nip: val.nip,
            address: val.address ?? "",
            occurrences: val.count,
        })
    }
    return results.sort((a, b) => b.occurrences - a.occurrences)
}

