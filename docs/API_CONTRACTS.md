# Kontrakty API – Przewodnik dla Agentów (Workers)

> [!CAUTION]
> Ten dokument jest **jedynym źródłem prawdy** dla formatów danych akceptowanych przez endpointy intake.
> Agent 2 (i każdy przyszły Worker) MUSI czytać ten plik przed wysłaniem czegokolwiek do API.

---

## POST `/api/intake/ocr-draft`

**Cel:** Przyjęcie danych wyekstrahowanych z faktury przez moduł OCR (Agent 2).
**Zachowanie:** Walidacja → konwersja kwot → zwrot bezpiecznego obiektu. **Nie zapisuje do bazy**.

### Wymagany Payload (JSON)

```json
{
  "nip": "1234567890",
  "parsedName": "Firma Budowlana Kowalski Sp. z o.o.",
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

### Specyfikacja Pól

| Pole | Typ | Wymagane | Walidacja |
|---|---|---|---|
| `nip` | `string` | ✅ | Dokładnie 10 cyfr, bez separatorów |
| `parsedName` | `string` | ✅ | 2–200 znaków |
| `issueDate` | `string` | ✅ | Format `YYYY-MM-DD` |
| `dueDate` | `string` | ❌ | Format `YYYY-MM-DD`, domyślnie issueDate + 14 dni |
| `netAmount` | `string` | ✅ | Kwota jako string, max 2 miejsca po przecinku (np. `"1250.50"`) |
| `grossAmount` | `string` | ✅ | Kwota jako string, **musi = netAmount + vatAmount** |
| `vatAmount` | `string` | ✅ | Kwota jako string |
| `invoiceNumber` | `string` | ❌ | Max 100 znaków |
| `type` | `enum` | ✅ | `"COST"` lub `"INCOME"` |
| `vatRate` | `string` | ❌ | Format `"0.23"`, domyślnie `"0.23"` |
| `ocrConfidence` | `number` | ❌ | Float 0.0–1.0, informacyjnie |

> [!IMPORTANT]
> **KWOTY MUSZĄ BYĆ STRINGAMI**, nie liczbami. Endpointrzuca `422` jeśli otrzyma `netAmount: 1250.50` zamiast `netAmount: "1250.50"`.
> Zapobiega to błędom precyzji zmiennoprzecinkowej JavaScript.

> [!WARNING]
> **`tenantId` jest ZABRONIONY w payload.** Endpoint ignoruje go i wstrzykuje z sesji serwera. Agent 2 nie ma prawa identyfikować tenanta.

### Odpowiedź Sukces (200)

```json
{
  "status": "validated",
  "message": "Dane przeszły walidację Zero Trust. Gotowe do zatwierdzenia.",
  "draft": {
    "nip": "1234567890",
    "parsedName": "Firma Budowlana Kowalski Sp. z o.o.",
    "issueDate": "2026-03-11",
    "dueDate": "2026-03-25",
    "netAmountCents": 1000000,
    "grossAmountCents": 1230000,
    "vatAmountCents": 230000,
    "invoiceNumber": "FV/2026/03/001",
    "type": "COST",
    "vatRate": "0.23",
    "ocrConfidence": 0.92,
    "tenantId": "default-tenant"
  }
}
```

### Odpowiedź Błąd (422 – Walidacja)

```json
{
  "error": "Walidacja schematu nie powiodła się. Sprawdź format danych.",
  "details": [
    { "field": "nip", "message": "NIP musi zawierać dokładnie 10 cyfr bez separatorów" },
    { "field": "netAmount", "message": "Kwota musi być stringiem w formacie '1250.50'" }
  ]
}
```

### Odpowiedź Błąd (422 – Niespójność kwot)

```json
{
  "error": "Niespójność kwot: grossAmount ≠ netAmount + vatAmount.",
  "expected": "12300.00",
  "received": "12500.00"
}
```

### Odpowiedź Błąd (400 – Nieprawidłowy JSON)

```json
{
  "error": "Nieprawidłowy JSON w body żądania."
}
```

---

## Architektura Master-Worker

```
┌─────────────────────────────────────────┐
│  Agent 2 (Worker – OCR Scanner)         │
│  - Skanuje faktury                      │
│  - Ekstrahuje dane → JSON               │
│  - NIE MA dostępu do bazy danych        │
│  - NIE zna tenantId                     │
└──────────────┬──────────────────────────┘
               │ POST /api/intake/ocr-draft
               │ (JSON: kwoty jako string)
               ▼
┌─────────────────────────────────────────┐
│  Agent 1 (Master – Gatekeeper)          │
│  - Walidacja Zod (Zero Trust)           │
│  - Konwersja string → cents (decimal.js)│
│  - Weryfikacja gross = net + vat        │
│  - Wstrzyknięcie tenantId z sesji       │
│  - Strażnik Append-Only Ledger          │
└─────────────────────────────────────────┘
```
