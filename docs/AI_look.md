# Sig ERP – AI Master Context (AI_look.md)

Ten plik jest „DNA” technologicznego systemu SIG ERP. Jest przeznaczony wyłącznie dla modeli LLM (AI), aby zapewnić 100% zrozumienia architektury, logiki finansowej i rygorystycznych standardów bez konieczności ponownego researchu.

---

## 🏗️ 1. Architektura i Stack Techniczny

- **Framework**: Next.js 15.2.8 (App Router), React 19, Tailwind 4.
- **Bazy Danych (Dual-Sync)**: 
    - **Firestore**: Szybki NoSQL jako Primary SSoT.
    - **PostgreSQL (Prisma)**: Secondary SSoT dla analityki i SQL Integrity.
- **AI**: Gemini 3.0 Flash (OCR & Analiza) via `@google/generative-ai`.
- **Finanse**: `decimal.js` wykorzystywany w `financeMapper.ts` (SSoT dla obliczeń).

### 🔴 Lazy Initialization (Build Safety)
Inicjalizacja `firebaseAdmin.ts` MUSI być leniwa (gettery), aby uniknąć błędów podczas buildu na Vercelu (brak envs).

---

## 🧾 2. Logika KSeF i Parsowanie XML (FA/3)

### KSeF Handshake (JWT Protocol):
1. **Challenge** (`/v2/auth/challenge`).
2. **Encryption** (token|timestampMs via RSA-OAEP SHA-256).
3. **Init & Redeem** (Otrzymanie `SessionToken`).

### Parsowanie XML (Strict Mapping):
- **Pole <P_15>**: System traktuje je jako kwotę brutto dokumentu (np. `676.01` zł).
- **Stawki VAT**: Obsługa mapowania 23%, 8%, 5% oraz stawek zwolnionych (P_13_7).
- **Zasada Context Binding (Vector 098.2)**: Dekodowanie XML odbywa się zawsze przez `update` rekordu metadanych za pomocą `ksefId`.

---

## 💰 3. Silnik Finansowy (DNA Vector 099)

### Reguła Mapowania:
- **Koszty (Purchases)**: Netto (-), VAT (+) jako tarcza, Brutto (-).
- **Przychody (Sales)**: Netto (+), VAT (-) jako dług, Brutto (+).

### Safe to Spend:
Obliczany dynamicznie: `Wpływy - Rezerwa CIT (9%) - VAT Należny + VAT Naliczony - Faktury do zapłaty`.

---

## 🚩 4. Standardy Kodowania i Integrity Vectors

- **Vector 098.1 (Duplicate Shield)**: Rygorystyczny `findUnique` przed zapisem faktury.
- **Vector 058 (Serializable Actions)**: Server Actions zwracają `{ success, results, error }`.
- **Vector 061 (Bank CSV)**: Obsługa `win1250` i separatora `;` dla PKO BP.
- **Regex Entity Engine**: Wyciąganie NIP/IBAN z opisów bankowych z lookaheadami.

---

## 📜 5. Change Log & Bug Recovery (History)

| Vector | Feature / Fix | Note |
| :--- | :--- | :--- |
| **092** | Gemini 500 Crash | Switching to Serializable Responses. |
| **094** | Type Mismatch | Enforcing NIP as String in Prisma. |
| **099** | Central Mapper | Unification of financial signs (+/-). |
| **098.2** | XML Context | Binding Phase 2 to metadata ID. |

---
*Plik utrzymywany przez Antigravity dla kolejnych sesji AI.*
