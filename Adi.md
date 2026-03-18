# SIG ERP - Kompleksowa Baza Wiedzy (Adi.md)

## 1. O Projekcie
**SIG ERP** to nowoczesny, firmowy system finansowo-zarządczy zaprojektowany dla maksymalnej efektywności operacyjnej. System integruje zarządzanie kosztami, przychodami, projektami oraz automatyzację obiegu dokumentów przy użyciu AI.

## 2. Architektura Techniczna
- **Framework**: Next.js 15.2 (App Router)
- **Frontend**: React 19, Tailwind CSS 4, Radix UI (Shadcn)
- **Backend**: Next.js API Routes (Route Handlers)
- **Baza Danych**: PostgreSQL (via Prisma ORM)
  - Kluczowe modele: `Transaction` (rejestr operacji), `Project` (budżet i burn rate), `Tenant` (wsparcie multi-tenant).
  - Schema: Każda transakcja ma typ `INCOME`/`COST` i status `PENDING`/`COMPLETED`.
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
3. **Gemini 404 (Model not found)**: Użycie nieaktualnych identyfikatorów modelu. Aktualnie ustawiony na `gemini-2.0-flash`.

## 5. Jak pracować z projektem (Dla kolejnych AI)
- **Zasada ZERO Mutation**: Nie modyfikuj obiektów systemowych (np. File).
- **Zasada AI-First**: Wszystkie nowe faktury powinny przechodzić przez `InvoiceScanner`.
- **API Key**: Gemini API Key znajduje się w `.env` jako `GEMINI_API_KEY`.
- **Prisma**: Po zmianach w schemacie zawsze uruchamiaj `npx prisma generate`.

## 6. Cele na Przyszłość
- Pełna automatyzacja kategoryzacji kosztów na podstawie historii.
- Eksport danych do formatów księgowych (JPK_V7).
- Moduł CRM zintegrowany z historią płatności kontrahentów.

---
*Dokument stworzony przez Antigravity dla Adi. Stan na dzień: 14.03.2026.*
