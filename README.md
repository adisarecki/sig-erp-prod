# Sig ERP – Modern Financial Management (Firestore Edition)

Nowoczesny system operacyjny dla firm, zoptymalizowany pod Next.js 15, Vercel oraz Google Cloud Firestore.

## 🚀 Architektura (Stack Technologiczny)

- **Hosting**: Vercel (Serverless Next.js 15)
- **Baza Danych**: Cloud Firestore (NoSQL)
- **Autoryzacja**: Firebase Auth (Google + Email/Hasło z wymuszoną zmianą PESEL)
- **Magazyn**: Firebase Storage

## 📈 Status Wdrożenia

> ✅ **Aplikacja jest zdeployowana na Vercelu** (produkcja z brancha `main`)

- **Next.js**: 15.2.8 (patched: CVE-2025-66478, CVE-2025-55183, CVE-2025-67779)
- **Prisma**: 6.x (downgrade z 7.x ze względu na kompatybilność schemat P1012)
- **Firebase Admin**: Singleton z lazy init (`@/lib/firebaseAdmin.ts`), dynamic `require()` dla service modules
- **Import Bankowy**: Pełna migracja z Prisma do Firestore (NoSQL)

---

## 🛠 Konfiguracja Lokalna

1. **Instalacja**: `npm install`
2. **Środowisko (.env)**:
   - `DATABASE_URL`: URL do bazy danych PostgreSQL.
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`: Nazwa bucketa storage.
   - `FIREBASE_SERVICE_ACCOUNT_JSON`: Cały obiekt JSON klucza service account (jedno-liniowy, z `\n` w `private_key`).
3. **Baza Danych**: `npx prisma db push` (Synchronizacja schematu z DB).
4. **Uruchomienie**: `npm run dev`

> [!IMPORTANT]
> **Vercel Deployment**: Upewnij się, że zmienna `FIREBASE_SERVICE_ACCOUNT_JSON` jest dodana w panelu Vercel. Bez niej faza runtime (ale nie build) zakończy się błędem.

---

## 🏗️ Firebase Admin SDK (Lazy Init)

Aby uniknąć błędów podczas fazy `Collecting page data` na Vercelu (brak zmiennych w czasie buildu), system używa mechanizmu **Lazy Initialization**.
- **Nie importuj `adminDb` bezpośrednio** na poziomie top-level pliku.
- Zamiast tego używaj getterów: `const db = getAdminDb()`, `const auth = getAdminAuth()`.
- Wszystkie wywołania Firebase muszą odbywać się wewnątrz funkcji serwerowych (Server Actions) lub handlerów API.

---

## 🔐 System Bezpieczeństwa (Gatekeeper)

Dostęp do systemu jest całkowicie zablokowany dla osób spoza Whitelist.
- **Logowanie Google**: Dla CEO i Wspólnika.
- **Logowanie Email**: Dostęp z wymuszoną zmianą hasła przy pierwszym zalogowaniu (protokół PESEL -> Private Password).

## 🧠 Zasady SYSTEM_DNA

Katalog `docs/` zawiera fundamenty logiki biznesowej:
👉 **[docs/SYSTEM_DNA.md](./docs/SYSTEM_DNA.md)**

**Logika Finansowa (Ekstraklasa):**
- **Tax Guard**: Rezerwacja 19% CIT + VAT Netto na Dashboardzie.
- **Cash Reality**: Symulacja "Realista" uwzględniająca 14-dniowe opóźnienia w płatnościach.
- **Append-Only Ledger**: Historia transakcji jest niezmienna (korekty przez rewers).

---

## 📈 Deployment (Vercel)

System jest skonfigurowany pod automatyczny deployment z GitHuba.
- **Build Bypass**: ESLint oraz TypeScript są ignorowane podczas buildu produkcyjnego (flaga `ignoreDuringBuilds`), aby umożliwić szybkie iteracje UI przy zachowaniu stabilności logicznej.

---
*Vercel & Firestore Ready 🚀*
