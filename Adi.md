# SIG ERP - Kompleksowa Baza Wiedzy (Adi.md)

## 1. O Projekcie
**SIG ERP** to nowoczesny, firmowy system finansowo-zarządczy zaprojektowany dla maksymalnej efektywności operacyjnej. System integruje zarządzanie kosztami, przychodami, projektami oraz automatyzację obiegu dokumentów przy użyciu AI.

## 2. Architektura Techniczna
- **Framework**: Next.js 15.2.6 (App Router, **patched — CVE-2025-66478**)
- **Frontend**: React 19, Tailwind CSS 4, Radix UI (Shadcn)
- **Backend**: Next.js API Routes (Route Handlers)
- **Baza Danych**: PostgreSQL (via Prisma ORM)
  - Kluczowe modele: `Transaction` (rejestr operacji), `Project` (budżet i burn rate), `Tenant` (wsparcie multi-tenant).
  - Schema: Każda transakcja ma typ `INCOME`/`COST` i status `PENDING`/`COMPLETED`. Transakcje i Faktury posiadają pole `bankTransactionId` dla uniknięcia duplikatów przy imporcie.
- **AI**: Google Gemini 2.0 Flash (OCR & Analiza)
- **Standardy Finansowe**:
  - Kwoty przechowywane jako liczby całkowite (grosze) w bazie (INT/BigInt).
  - Wykorzystanie `decimal.js` do precyzyjnych obliczeń na frontendzie/backendzie (np. `new Decimal(amount).div(100)` dla wyświetlania).
  - Model "Profit First": Automatyczne wyliczanie rezerwy na podatek (Income Tax), VAT oraz "Safe Withdrawal" na Dashboardzie.

## 3. Kluczowe Moduły
### Dashboard
Centrum dowodzenia z widokiem na płynność finansową. Implementuje regułę Profit First:
1. `Income - VAT = Real Revenue`
2. `Real Revenue - Operating Expenses = Gross Profit`
3. `Gross Profit - Tax Reserve = Net Profit (Safe Withdrawal)`

### OCR Scanner (Gemini 2.0)
Najbardziej zaawansowany moduł systemu.
- **Plik**: `src/components/finance/InvoiceScanner.tsx` & `src/app/api/ocr/scan/route.ts`
- **Walidacja**: System sprawdza poprawność NIP (10 cyfr) oraz sumę kontrolną kwot (Net + VAT = Gross).
- **Endpoint docelowy**: `POST /api/intake/ocr-draft` - tworzy tymczasowy obiekt w pamięci/bazie, który użytkownik musi zatwierdzić, zanim stanie się prawdziwą transakcją.
- **Silnik**: Przejście z Tesseract.js -> Gemini 1.5 -> Gemini 2.0 Flash.
- **Workflow**: 
  1. Uploader przyjmuje PDF/Obraz (max 10MB).
  2. Plik jest przesyłany jako Base64 (inlineData) do `api/ocr/scan`.
  3. Gemini zwraca czysty JSON z danymi: NIP, kwoty, daty, numer faktury.
  4. Dane trafiają do `api/intake/ocr-draft` jako szkic kosztu.

### Finanse (Ledger)
- System oparty na rejestrze przychodów i kosztów.
- Integracja z projektami – każdy koszt/przychód może być przypisany do konkretnego zlecenia.

## 4. Ostatnie Problemy i Rozwiązania
1. **Błąd Hydracji i 404 Chunks**: Spowodowany konfliktami procesów `node.exe` i uszkodzonym cache `.next`. Rozwiązany przez `taskkill` i czyszczenie `.next`.
2. **Crash `Object.defineProperty`**: Próba mutacji obiektu `File` w uploaderze. Naprawione przez użycie `useState<File | null>` i brak modyfikacji obiektu systemowego.
5. **Błąd 500 (Server Components render) w Importach**: Rzucanie surowych wyjątków (`throw Error`) w akcjach Next.js na Vercelu powodowało błędy 500 bez opisu. Naprawione przez wdrożenie standardu zwracania serylizowalnych obiektów `{ success, results, error }`.
6. **Brak ID Konta Bankowego w transakcjach**: Importy bez jawnie wybranego konta bankowego blokowały się lub tworzyły osierocone rekordy. Wdrożono mandatoryjny selektor konta bankowego w UI (`finance/import`) z obsługą flagi `isDefault`.
7. **Błąd Firestore (Value for argument "data" is not a valid Firestore document)**: Próba zapisu wartości `undefined` w polach takich jak `nip` lub `address`. Naprawione przez wymuszenie jawnego rzutowania na `null` w całym potoku (types -> normalizer -> route).

## 5. Jak pracować z projektem (Dla kolejnych AI)
- **Zasada ZERO Mutation**: Nie modyfikuj obiektów systemowych (np. File).
- **Zasada AI-First**: Wszystkie nowe faktury powinny przechodzić przez `InvoiceScanner`.
- **Zasada Serializable Actions**: Server Actions MUSZĄ zwracać obiekty `{ success, results?, error? }` zamiast rzucać błędy, aby uniknąć błędów 500 na Vercelu.
- **Zasada Firestore Strict Nulls**: Nigdy nie wysyłaj `undefined` do Firestore. Każde opcjonalne pole musi być jawnie ustawione na `null`, jeśli jest puste.
- **API Key**: Gemini API Key znajduje się w `.env` jako `GEMINI_API_KEY`.
- **Prisma**: Po zmianach w schemacie zawsze uruchamiaj `npx prisma generate` oraz `npx prisma db push` dla synchronizacji z bazą danych.
- **Firebase Admin**: Inicjalizacja przez `@/lib/firebaseAdmin.ts` (singleton z `getApps()`). Używaj getterów `getAdminDb()`, `getAdminAuth()`, `getAdminStorage()`. Nie importuj `firebase-admin/firestore` itd. na poziomie top-level — spowoduje to crash buildu na Vercelu.
- **Zmienne Firebase na Vercelu**: `FIREBASE_SERVICE_ACCOUNT_JSON` (cały JSON w jednej linii) LUB trio: `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`.

## 6. Cele na Przyszłość
- Pełna automatyzacja kategoryzacji kosztów na podstawie historii.
- Eksport danych do formatów księgowych (JPK_V7).
- Moduł CRM zintegrowany z historią płatności kontrahentów.

---
*Dokument stworzony przez Antigravity dla Adi. Stan na dzień: 19.03.2026 (Aktualizacja: Next.js 15.2.6 CVE fix + Firebase Admin build-safe singleton).*
