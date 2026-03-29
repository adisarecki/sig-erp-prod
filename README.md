# Sig ERP – Twoje Centrum Dowodzenia Firmą 🚀

Witaj w **Sig ERP** – nowoczesnym systemie finansowo-zarządczym, zaprojektowanym dla firm budowlanych i usługowych. Ten program to Twoje „cyfrowe biuro”, które pilnuje terminów, pieniędzy i relacji z kontrahentami.

---

## 🏗️ 1. Co już mamy? (Twoje Główne Narzędzia)

### 💰 Inteligentne Finanse i Bankowość
- **Smart Import Hub (Nowość!)**: Wrzucasz jeden plik CSV z banku, a system automatycznie:
  - Rozpoznaje firmy w Twojej bazie (po NIP, Nazwie lub Numerze Konta).
  - Dopasowuje przelewy do wystawionych faktur i **automatycznie oznacza je jako OPŁACONE**.
  - Uczy się nowych numerów kont Twoich dostawców (Auto-Learning IBAN).
- **"Safe to Spend" (Bezpieczna Wypłata)**: Najważniejsza liczba na Dashboardzie. System wylicza, ile pieniędzy możesz bezpiecznie wypłacić z firmy po odliczeniu podatków i rezerw.
- **Auto-Kategoryzacja**: System uczy się Twoich wydatków – np. fakturę za paliwo sam przypisze do kosztów transportu.

### 🤖 Szybkie Skanowanie Faktur (AI/OCR)
- **Skanuj & Zapomnij**: Wrzucasz PDF lub zdjęcie faktury, a nasza Sztuczna Inteligencja (Gemini 2.0) sama odczyta NIP, kwoty i daty.
- **Skanowanie Seryjne**: Możesz wrzucić paczkę faktur naraz, a system przetworzy je w tle, gdy Ty zajmujesz się firmą.

### 🏗️ Zarządzanie Budowami (Projekty)
- **Monitoring Rentowności**: Widzisz na żywo, czy budowa zarabia, czy koszty „zjadają” Twoją marżę.
- **Skarbiec Kaucji (Retention Vault)**: System pilnuje pieniędzy zamrożonych u inwestorów (kaucje gwarancyjne). Przypomnimy Ci o nich na 30 dni przed terminem zwrotu.
- **P&L Projektu**: Precyzyjny widok: Ile zarobiłem na danej inwestycji po odjęciu wszystkich kosztów?

### 🤝 Twoja Baza Firm (CRM)
- **Pobieranie z GUS**: Wpisujesz NIP, a system sam dociąga nazwę i adres firmy z bazy państwowej.
- **Historia Finansowa**: Każdy kontrahent ma swoją „kartotekę” – od razu widzisz, czy zalega z płatnościami.

---

## 🛠️ 2. Nad czym aktualnie pracujemy? (Stan na dziś)

Obecnie „szlifujemy” automatyzację bankową i spójność danych:
- **Smart Match V2**: Udoskonaliliśmy algorytm dopasowywania przelewów do faktur, abyś nie musiał ręcznie wpisywać „opłacono”.
- **Dual-Sync DNA**: Każda zmiana w bazie (np. nowy numer konta firmy) jest natychmiast zapisywana w dwóch bezpiecznych bazach danych (SQL + Google Firestore).
- **Zasada 100% CSV**: Cały system bankowy zoptymalizowaliśmy pod natywny format PKO BP (Zawsze CSV, Nigdy MT940).

---

## 📅 3. Co planujemy w kolejnych krokach?

1. **Magazyn & Zapasy**: Moduł do pilnowania ilości materiałów na budowach. 
2. **Generowanie Dokumentów**: Tworzenie ofert i protokołów odbioru bezpośrednio z systemu.
3. **Automatyka dla Księgowej**: Przygotowanie gotowych zestawień (JPK) do wysyłki do biura rachunkowego.
4. **Wersja Mobilna**: Ulepszony widok na smartfony, abyś mógł sprawdzić zysk firmy będąc prosto na budowie.

---

## 🧾 4. Integracja KSeF (JWT v2, Produkcyjna, 2026)

**Nowy, 5-etapowy standard Handshake KSeF JWT v2 (Zgodność z "Instrukcją Serwisową"):**
1.  **Challenge (Wyzwanie)**: Pobranie unikalnego `challenge` z serwerów MF (`POST /v2/auth/challenge`).
2.  **Encryption (Szyfrowanie)**: Zaszyfrowanie tokena MF algorytmem **RSA-OAEP (SHA-256)** przy użyciu dynamicznego klucza publicznego.
3.  **KSeF-Token (Inicjalizacja)**: Wstępna autoryzacja (`POST /v2/auth/ksef-token`) – otrzymujemy unikalny `referenceNumber`.
4.  **Status Polling (Weryfikacja)**: **[NOWOŚĆ]** Odpytywanie `GET /v2/auth/{referenceNumber}` aż do uzyskania statusu **"Success"**. 
5.  **Redeem (Finalizacja JWT)**: Wymiana na ostateczne tokeny `accessToken` i `refreshToken` (`POST /v2/auth/token/redeem`).

**Główne Atuty Nowego Standardu:**
- **Vercel Edge Runtime**: API zoptymalizowane pod `runtime: 'edge'`, co eliminuje timeouty (limit 30s) i przyspiesza start funkcji.
- **Summer Timezone (+02:00)**: Pełna obsługa polskiego czasu letniego w zapytaniach, zgodnie z aktualnym offsetem Ministerstwa.
- **Pancerny Kod (Robust Fetch)**: Defensywne pobieranie danych (raw text first) zapobiegające błędom parsowania przy HTML-owych stronach błędów MF.
- **Authorization: Bearer**: Przejście z nagłówka `SessionToken` na światowy standard `Bearer Token`.
- **Stabilny Cache**: Access Token jest buforowany przez 55 minut, co minimalizuje obciążenie serwerów MF i zapewnia stabilność sesji.
- **2-Fazowy Szybki Sync (V2 Ready)**: Architektura pobierania w pełni asynchroniczna. Opcja "Szybki Sync" pobiera ułamku sekundy setki nagłówków `XML_MISSING`.
- **Inteligencja Dat (Standard +01:00)**: System używa właściwej dla Ministerstwa daty zapisu, całkowicie omijając błąd 401/404.
- **Obsługa FA(3)**: Step 6: Dodano obsługę faktur zaliczkowych (ZAL) oraz ekstrakcję szczegółowych pozycji zamówienia ze schematu FA (3).
- **Auto-Kategoryzacja AI**: Inteligentne rozpoznawanie typu dokumentu na podstawie NIP-u właściciela. Jeśli jesteś Sprzedawcą (`Podmiot1`), system oznacza fakturę jako **REVENUE**. Jeśli Nabywcą (`Podmiot2`), jako **EXPENSE**.
- **Odporność na Błędy**: Bezpieczna obsługa pustych wyników zapytania (status 404 traktowany jako sukces z pustą listą) oraz precyzyjna diagnostyka błędów sesji (Step 7 Auth-Fix). Zoptymalizowano obsługę okresów bezfakturowych (fix błędu 404/500).
- **Integracja Bazy Danych (Upsert & Duplicate Guard)**: Pobieranie i zapis faktur z zabezpieczeniem przed duplikatami (`ksefId`). Automatyczne budowanie profilu kontrahenta (weryfikacja NIP) oraz wyciąganie przypisanych do faktur kont bankowych. Monitorowanie statusu (`paymentStatus`), typów KSeF (`ksefType` dla zaliczek) oraz terminów płatności (`dueDate`).
- **Dashboard i Powiadomienia (UI Integration)**: Tabela naglących płatności zasila się automatycznie z bazy Prisma. Wskaźnik Safe to Spend odlicza niezapłacone KSeF od czystej gotówki. Panel na `/finanse/ksef` umożliwiający synchronizację z konkretnego Date-Range, przeglądanie faktur KSeF (z kolorowymi odznakami typów) oraz zarządzanie i akceptację Oczekujących Dostawców.

**Narzędzia:**
- **Synchronizacja**: `/api/ksef/process` – pełne przetwarzanie i parowanie faktur.
- **Weryfikacja Handshake**: `/api/ksef/test-sync` – szybki test połączenia w standardzie JWT v2.
- **UI KSeF**: Dashboard główny ze zintegrowanymi wynikami w `src/app/(dashboard)/finanse/ksef/page.tsx`.



---

## 💡 Instrukcja "Na Start"
- **Pasek Szybkich Akcji**: To serce systemu. Stąd dodasz fakturę, sprawdzisz projekt lub zaimportujesz wyciąg z banku.
- **Panel Projektu**: Kliknij w nazwę budowy, aby zobaczyć szczegółowe wykresy wydatków i przychodów.
- **Konto Bankowe**: Przed pierwszym importem wyciągu upewnij się, że w ustawieniach dodałeś swój numer konta firmowego.

---
*Dla techników: Dokumentacja techniczna znajduje się w [docs/AI_look.md](./docs/AI_look.md), a historia zmian w [docs/CHLOG_TECH.md](./docs/CHLOG_TECH.md).*

**Sig ERP – Twoja firma pod pełną kontrolą.**
