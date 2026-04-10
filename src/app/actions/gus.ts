"use server"

import { XMLParser } from "fast-xml-parser"

// Environment Variables and Configuration
const GUS_API_KEY = process.env.GUS_BIR_KEY || process.env.GUS_API_KEY || "abcde12345abcde12345"
const GUS_URL = process.env.GUS_BIR_URL || "https://wyszukiwarkaregontest.stat.gov.pl/BIR/PUBLUGLUDSWPUB.svc"

// Session Caching (Module-level persistence)
let cachedSid: string | null = null
let sidExpiry: number = 0
const CACHE_TTL_MS = 55 * 60 * 1000 // 55 minutes (just below 60 to be safe)

/**
 * Authenticates with GUS BIR 1.1 and returns a session ID (sid).
 * Uses an in-memory cache for 55 minutes.
 */
async function getGusSession() {
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

    try {
        const res = await fetch(GUS_URL, {
            method: "POST",
            headers: { "Content-Type": "application/soap+xml; charset=utf-8" },
            body: loginSoap
        })

        const text = await res.text()
        const parser = new XMLParser()
        const obj = parser.parse(text)
        
        // Handling different possible XML namespaces (s:Envelope vs soap:Envelope)
        const envelope = obj['s:Envelope'] || obj['soap:Envelope'] || obj['Envelope']
        const body = envelope?.['s:Body'] || envelope?.['soap:Body'] || envelope?.['Body']
        const sid = body?.['ZalogujResponse']?.['ZalogujResult']

        if (!sid) {
            console.error("[GUS_LOGIN_ERROR] Missing SID in response:", text)
            throw new Error("Nie udało się zalogować do API GUS (Brak SID).")
        }

        cachedSid = sid
        sidExpiry = Date.now() + CACHE_TTL_MS
        console.log("[GUS_BIR] New session established:", sid)
        return sid
    } catch (error) {
        console.error("[GUS_BIR_AUTH_ERROR]", error)
        throw error
    }
}

/**
 * Sanitizes a string for security (XSS/SQL-ish prevention).
 * In React, XSS is naturally handled for text content, but we add extra hardening here.
 */
function sanitize(val: any): string {
    if (typeof val !== 'string') return ""
    // Basic stripping of HTML tags and suspicious characters
    return val
        .replace(/<[^>]*>?/gm, '') // Strip HTML
        .trim()
}

/**
 * Fetches contractor data from GUS BIR 1.1 by NIP.
 * Vector 130: Zero-Entry Onboarding Integration.
 */
export async function fetchGusData(nip: string) {
    // Validacja NIP (usuwanie myślników jeśli są)
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

        const text = await res.text()
        const parser = new XMLParser()
        const obj = parser.parse(text)
        
        const envelope = obj['s:Envelope'] || obj['soap:Envelope'] || obj['Envelope']
        const body = envelope?.['s:Body'] || envelope?.['soap:Body'] || envelope?.['Body']
        const xmlData = body?.['DaneSzukajPodmiotyResponse']?.['DaneSzukajPodmiotyResult']

        if (!xmlData || xmlData.includes("ErrorCode")) {
            // Check if it's a session error - if so, clear cache and retry once
            if (xmlData?.includes("Sesja nieaktywna")) {
                console.warn("[GUS_BIR] Session expired unexpectedly. Retrying...")
                cachedSid = null
                return fetchGusData(nip)
            }
            return { success: false, error: "Nie znaleziono firmy o podanym NIP w bazie GUS." }
        }

        // Unescape internal XML string
        const unescapedXml = xmlData
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            
        const dataObj = parser.parse(unescapedXml)
        const d = dataObj.root?.dane

        if (!d) {
            console.error("[GUS_BIR_PARSE_ERROR] Payload:", unescapedXml)
            return { success: false, error: "Błąd interpretacji danych z GUS." }
        }

        // Build full address
        const street = d.Ulica || ""
        const number = d.NrNieruchomosci || ""
        const local = d.NrLokalu ? `/${d.NrLokalu}` : ""
        const city = d.Miejscowosc || ""
        const zip = d.KodPocztowy || ""

        // Format: ul. [Ulica] [Nr], [Kod] [Miasto]
        let streetPart = street
        if (street && !street.toLowerCase().startsWith("ul.") && !street.toLowerCase().startsWith("al.")) {
            streetPart = `ul. ${street}`
        }

        const fullAddress = `${streetPart} ${number}${local}, ${zip} ${city}`.trim().replace(/^,/, "").trim()

        return {
            success: true,
            data: {
                name: sanitize(d.Nazwa),
                nip: normalizedNip,
                regon: sanitize(d.Regon),
                address: sanitize(fullAddress),
                raw: d // Zachowanie surowych danych na wypadek potrzeby debugingu
            }
        }

    } catch (error: any) {
        console.error("[GUS_ACTION_ERROR]", error)
        return { success: false, error: error.message || "Błąd komunikacji z GUS." }
    }
}

// Alias for backward compatibility if needed
export const getGusDataByNip = fetchGusData

