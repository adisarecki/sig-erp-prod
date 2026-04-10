"use server"

// Environment Variables and Configuration
const GUS_API_KEY = process.env.GUS_BIR_KEY || process.env.GUS_API_KEY || "abcde12345abcde12345"
const GUS_URL = process.env.GUS_BIR_URL || "https://wyszukiwarkaregontest.stat.gov.pl/BIR/PUBLUGLUDSWPUB.svc"

// Session Caching (Module-level persistence)
let cachedSid: string | null = null
let sidExpiry: number = 0
const CACHE_TTL_MS = 55 * 60 * 1000 // 55 minutes (just below 60 to be safe)

/**
 * Decodes HTML entities and sanitizes a string for UI display.
 * Handles double-encoded values from GUS (e.g. &amp; → &, &quot; → ").
 */
function sanitize(val: any): string {
    if (typeof val !== "string") return String(val ?? "").trim()
    return val
        // Decode HTML entities (GUS encodes & " ' inside XML text content)
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        // Strip any leftover HTML tags (XSS hardening)
        .replace(/<[^>]*>?/gm, "")
        .trim()
}

/**
 * Extracts a value from raw XML/SOAP text using regex.
 * MTOM-safe: bypasses multipart boundaries and namespace prefixes.
 * Matches both <Tag>value</Tag> and <ns:Tag>value</ns:Tag> patterns.
 */
function extractXmlValue(raw: string, tagName: string): string | null {
    // Match with optional namespace prefix, 's' flag for multiline/dotall
    const match = raw.match(new RegExp(`<(?:[\\w]+:)?${tagName}[^>]*>([\\s\\S]*?)<\\/(?:[\\w]+:)?${tagName}>`, "i"))
    return match ? match[1].trim() : null
}

/**
 * Authenticates with GUS BIR 1.1 and returns a session ID (sid).
 * Uses an in-memory cache for 55 minutes.
 * MTOM-safe: uses regex bypass instead of XML parser.
 */
async function getGusSession(): Promise<string> {
    if (cachedSid && Date.now() < sidExpiry) {
        return cachedSid
    }

    const loginSoap = `
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ns="http://CIS/BIR/PUBL/2014/07">
   <soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">
      <wsa:Action>http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/Zaloguj</wsa:Action>
      <wsa:To>${GUS_URL}</wsa:To>
   </soap:Header>
   <soap:Body>
      <ns:Zaloguj>
         <ns:pKluczUzytkownika>${GUS_API_KEY}</ns:pKluczUzytkownika>
      </ns:Zaloguj>
   </soap:Body>
</soap:Envelope>`

    const res = await fetch(GUS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/soap+xml; charset=utf-8" },
        body: loginSoap
    })

    // MTOM-safe: fetch raw text instead of XML parsing
    const rawResponse = await res.text()

    // REGEX FAIL-SAFE: bypass all multipart boundaries and SOAP namespaces
    const sidMatch = rawResponse.match(/<ZalogujResult>(.*?)<\/ZalogujResult>/)
    const sid = sidMatch ? sidMatch[1].trim() : null

    // Validation: SID must be exactly 20 characters
    if (!sid || sid.length !== 20) {
        // Mask the raw response to avoid leaking API key in logs
        const maskedResponse = rawResponse
            .replace(GUS_API_KEY, "[API_KEY_MASKED]")
            .substring(0, 500)
        console.error("[GUS_PARSING_ERROR] SID not found or invalid. Response (masked):", maskedResponse)
        throw new Error(`GUS_PARSING_ERROR: SID invalid (got "${sid ?? "null"}", expected 20 chars).`)
    }

    // Success — store in cache
    cachedSid = sid
    sidExpiry = Date.now() + CACHE_TTL_MS
    console.log("[GUS_BIR] New session established. SID length:", sid.length)
    return sid
}

/**
 * Fetches contractor data from GUS BIR 1.1 by NIP.
 * Vector 130: Zero-Entry Onboarding Integration.
 * MTOM-safe: uses regex extraction for all SOAP response fields.
 */
export async function fetchGusData(nip: string) {
    const normalizedNip = nip.replace(/[^0-9]/g, "")

    if (normalizedNip.length !== 10) {
        return { success: false, error: "Numer NIP musi składać się z 10 cyfr." }
    }

    try {
        const sid = await getGusSession()

        const searchSoap = `
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ns="http://CIS/BIR/PUBL/2014/07" xmlns:dat="http://CIS/BIR/PUBL/2014/07/DataContract">
   <soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">
      <wsa:Action>http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/DaneSzukajPodmioty</wsa:Action>
      <wsa:To>${GUS_URL}</wsa:To>
   </soap:Header>
   <soap:Body>
      <ns:DaneSzukajPodmioty>
         <ns:pParametryWyszukiwania>
            <dat:Nip>${normalizedNip}</dat:Nip>
         </ns:pParametryWyszukiwania>
      </ns:DaneSzukajPodmioty>
   </soap:Body>
</soap:Envelope>`

        const res = await fetch(GUS_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/soap+xml; charset=utf-8",
                "sid": sid
            },
            body: searchSoap
        })

        const rawSearch = await res.text()

        // Session expired mid-request — clear cache and retry once
        if (rawSearch.includes("Sesja nieaktywna") || rawSearch.includes("Sesja wygasła")) {
            console.warn("[GUS_BIR] Session expired. Invalidating cache and retrying...")
            cachedSid = null
            return fetchGusData(nip)
        }

        // REGEX FAIL-SAFE: extract the inner encoded XML payload
        const xmlData = extractXmlValue(rawSearch, "DaneSzukajPodmiotyResult")

        if (!xmlData) {
            console.error("[GUS_BIR_SEARCH_ERROR] No result in response:", rawSearch.substring(0, 400))
            return { success: false, error: "Nie znaleziono firmy o podanym NIP w bazie GUS." }
        }

        // Unescape the inner XML (it's HTML-entity encoded inside the SOAP body)
        const unescapedXml = xmlData
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, "&")

        // Extract each field directly via regex — fully MTOM-safe, no XMLParser needed
        const nazwa    = extractXmlValue(unescapedXml, "Nazwa") ?? ""
        const ulica    = extractXmlValue(unescapedXml, "Ulica") ?? ""
        const nrNier   = extractXmlValue(unescapedXml, "NrNieruchomosci") ?? ""
        const nrLok    = extractXmlValue(unescapedXml, "NrLokalu") ?? ""
        const miasto   = extractXmlValue(unescapedXml, "Miejscowosc") ?? ""
        const kodPoczt = extractXmlValue(unescapedXml, "KodPocztowy") ?? ""
        const regon    = extractXmlValue(unescapedXml, "Regon") ?? ""

        if (!nazwa) {
            console.error("[GUS_BIR_PARSE_ERROR] Empty Nazwa. Payload:", unescapedXml.substring(0, 400))
            return { success: false, error: "Błąd interpretacji danych z GUS — brak nazwy podmiotu." }
        }

        // Build formatted address: ul. [Ulica] [Nr]/[Lok], [Kod] [Miasto]
        let streetPart = ulica
        if (ulica && !ulica.toLowerCase().startsWith("ul.") && !ulica.toLowerCase().startsWith("al.")) {
            streetPart = `ul. ${ulica}`
        }
        const localPart = nrLok ? `/${nrLok}` : ""
        const fullAddress = `${streetPart} ${nrNier}${localPart}, ${kodPoczt} ${miasto}`.trim().replace(/^,\s*/, "")

        return {
            success: true,
            data: {
                name:    sanitize(nazwa),
                nip:     normalizedNip,
                regon:   sanitize(regon),
                address: sanitize(fullAddress),
            }
        }

    } catch (error: any) {
        console.error("[GUS_ACTION_ERROR]", error.message)
        return { success: false, error: error.message || "Błąd komunikacji z GUS." }
    }
}

// Alias for backward compatibility
export const getGusDataByNip = fetchGusData
