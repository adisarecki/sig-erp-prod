# Moduł OCR – Dokumentacja Techniczna

> Agent 2 (Worker) – Skaner Faktur AI

## Wymagane Zmienne Środowiskowe

| Zmienna | Opis | Wymagana |
|---|---|---|
| `OPENAI_API_KEY` | Klucz API OpenAI (model `gpt-4o` z Vision) | ✅ TAK |

Dodaj do `.env`:
```
OPENAI_API_KEY="sk-..."
```

## Architektura Modułu

```
┌──────────────────────────────────────────────┐
│  InvoiceScanner.tsx (Modal)                  │
│  - Dropzone (drag & drop / klik)             │
│  - capture="environment" dla mobile          │
│  - Wsparcie PDF (Render: pdfjs-dist → JPEG)  │
│  - LOCAL OCR: tesseract.js (Free)            │
│  - Regex Engine: Extract NIP, Dates, Sums    │
│  - Spinner Lokalny → wynik w polach          │
└───────────────┬──────────────────────────────┘
                │ Wywołuje Master Gatekeeper API po edycji
                ▼
┌──────────────────────────────────────────────┐
│  Leakage Detection Engine                    │
│  - Double Payment Detection                  │
│  - Missing Invoice Finder                    │
│  - VAT Consistency Validator                 │
└──────────────────────────────────────────────┘
                │ OcrInvoiceData JSON
                ▼
┌──────────────────────────────────────────────┐
│  InvoiceScanner → POST /api/intake/ocr-draft │
│  (Zero Trust Gatekeeper waliduje JSON i      │
│  zwraca bezpieczne zdecimalizowane amounts)  │
└───────────────┬──────────────────────────────┘
                │ SanitizedOcrDraft JSON
                ▼
┌──────────────────────────────────────────────┐
│  InvoiceScanner → callback onDataExtracted   │
│  → QuickActionsBar (state)                   │
│  → RegisterCostModal / RegisterIncomeModal   │
│    (auto-fill + auto-open z podziałem /100)  │
│  ⛔ ZERO zapisu do bazy!                     │
└──────────────────────────────────────────────┘
```

## Punkt Wpięcia w Frontend

| Plik | Rola |
|---|---|
| `src/components/finance/QuickActionsBar.tsx` | Przycisk "Skanuj Fakturę" + stan OCR |
| `src/components/finance/InvoiceScanner.tsx` | Modal: dropzone + AI scan + edycja |
| `src/components/finance/RegisterCostModal.tsx` | Prop `ocrData` → auto-fill pól |
| `src/components/finance/RegisterIncomeModal.tsx` | Prop `ocrData` → auto-fill pól |
| `src/app/api/ocr/scan/route.ts` | Proxy API (multipart → OpenAI) |
| `src/lib/ocr/extract-invoice.ts` | Klient OpenAI Vision |
| `src/lib/ocr/types.ts` | Typy TypeScript |

## Format Danych Wyjściowych

Zgodny z `API_CONTRACTS.md` → `POST /api/intake/ocr-draft`:

```json
{
  "nip": "1234567890",
  "parsedName": "Firma XYZ Sp. z o.o.",
  "issueDate": "2026-03-11",
  "dueDate": "2026-03-25",
  "netAmount": "10000.00",
  "grossAmount": "12300.00",
  "vatAmount": "2300.00",
  "invoiceNumber": "FV/2026/03/001",
  "type": "COST",
  "vatRate": "0.23",
  "ocrConfidence": 0.92
}
```

> **Kwoty to STRINGI** – wymóg Konstytucji Pieniądza (decimal.js na backendzie).

## Ograniczenia i Decyzje

- **Zero Prisma** – cały moduł nie importuje `@prisma/client`
- **Zero tenantId** – moduł nie zna ani nie przekazuje tenantId
- **Zero auto-save** – dane trafiają do formularza, zapis wymaga ludzkiego kliknięcia
- **Model**: `gpt-4o` (OpenAI) – wymaga aktywnego klucza API z dostępem do Vision
- **Wsparcie Mobile**: Posiada parametr `capture="environment"` w `input type="file"`, co na urządzeniach mobilnych wymusza bezpośrednie otwarcie kamery systemowej zamiast wyboru z galerii.
- **Wsparcie PDF**: System obsługuje pliki PDF poprzez renderowanie pierwszej strony na froncie za pomocą biblioteki `pdfjs-dist`. Render odbywa się w wysokiej rozdzielczości (scale: 2.0), a wynikowy obraz JPEG jest przesyłany do API. Pozwala to na zachowanie architektury opartej o Vision API bez potrzeby parsowania PDF na backendzie.
- **Limity pliku**: max 10 MB, formaty JPEG/PNG/WebP/PDF.
- **Flow danych**: `InvoiceScanner` (Front) → `pdfjs-dist` (opcjonalny render) → `/api/ocr/scan` (Proxy) → OpenAI Vision → Human Review → `/api/intake/ocr-draft` (Master Gatekeeper) → Auto-fill formularza.
