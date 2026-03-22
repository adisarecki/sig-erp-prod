"use server"

import { XMLParser } from "fast-xml-parser"

const GUS_API_KEY = process.env.GUS_API_KEY || "abcde12345abcde12345" // Klucz testowy BIR 1.1
const GUS_URL = "https://wyszukiwarkaregontest.stat.gov.pl/BIR/PUBLUGLUDSWPUB.svc"

/**
 * Pobiera dane firmy z GUS BIR 1.1 na podstawie NIP.
 */
export async function getGusDataByNip(nip: string) {
    if (!nip || nip.length < 10) {
        return { success: false, error: "Nieprawidłowy numer NIP." }
    }

    try {
        // 1. Logowanie do BIR (Pobranie SID)
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

        const loginRes = await fetch(GUS_URL, {
            method: "POST",
            headers: { "Content-Type": "application/soap+xml; charset=utf-8" },
            body: loginSoap
        })

        const loginText = await loginRes.text()
        const parser = new XMLParser()
        const loginObj = parser.parse(loginText)
        const sid = loginObj['s:Envelope']?.['s:Body']?.['ZalogujResponse']?.['ZalogujResult']

        if (!sid) {
            console.error("[GUS_LOGIN_ERROR]", loginText)
            throw new Error("Nie udało się zalogować do API GUS (Brak SID).")
        }

        // 2. Pobieranie danych podmiotu
        const searchSoap = `
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ns="http://CIS/BIR/PUBL/2014/07" xmlns:dat="http://CIS/BIR/PUBL/2014/07/DataContract">
   <soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">
      <wsa:Action>http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/DaneSzukajPodmioty</wsa:Action>
      <wsa:To>${GUS_URL}</wsa:To>
   </soap:Header>
   <soap:Body>
      <ns:DaneSzukajPodmioty>
         <ns:pParametryWyszukiwania>
            <dat:Nip>${nip}</dat:Nip>
         </ns:pParametryWyszukiwania>
      </ns:DaneSzukajPodmioty>
   </soap:Body>
</soap:Envelope>`

        const searchRes = await fetch(GUS_URL, {
            method: "POST",
            headers: { 
                "Content-Type": "application/soap+xml; charset=utf-8",
                "sid": sid
            },
            body: searchSoap
        })

        const searchText = await searchRes.text()
        const searchObj = parser.parse(searchText)
        const xmlData = searchObj['s:Envelope']?.['s:Body']?.['DaneSzukajPodmiotyResponse']?.['DaneSzukajPodmiotyResult']

        if (!xmlData || xmlData.includes("ErrorCode")) {
            return { success: false, error: "Nie znaleziono firmy o podanym NIP w bazie GUS." }
        }

        // Dane z BIR są zwracane jako zahartowany XML wewnątrz elementu (escaped XML)
        // Musimy to odkodować i przemapować. fast-xml-parser radzi sobie z tym jeśli przekażemy mu ten string.
        const unescapedXml = xmlData.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
        const dataObj = parser.parse(unescapedXml)
        const d = dataObj.root?.dane

        if (!d) {
            return { success: false, error: "Błąd parsowania danych z GUS." }
        }

        // Mapowanie na nasz format
        return {
            success: true,
            data: {
                name: d.Nazwa || "",
                address: `${d.Ulica || ""} ${d.NrNieruchomosci || ""}${d.NrLokalu ? "/" + d.NrLokalu : ""}`.trim(),
                city: d.Miejscowosc || "",
                zipCode: d.KodPocztowy || "",
                fullAddress: `${d.Ulica || ""} ${d.NrNieruchomosci || ""}${d.NrLokalu ? "/" + d.NrLokalu : ""}, ${d.KodPocztowy || ""} ${d.Miejscowosc || ""}`.trim()
            }
        }

    } catch (error: any) {
        console.error("[GUS_ACTION_ERROR]", error)
        return { success: false, error: error.message || "Błąd komunikacji z GUS." }
    }
}
