# Sig ERP – Modern Financial Management (Firestore Edition)

Nowoczesny system operacyjny dla firm, zoptymalizowany pod Next.js 15, Vercel oraz Google Cloud Firestore.

## 🚀 Architektura (Stack Technologiczny)

- **Hosting**: Vercel (Serverless Next.js 15)
- **Baza Danych**: Cloud Firestore (NoSQL)
- **Autoryzacja**: Firebase Auth (Google + Email/Hasło z wymuszoną zmianą PESEL)
- **Magazyn**: Firebase Storage

## 🛠 Konfiguracja Lokalna

1. **Instalacja**: `npm install`
2. **Środowisko (.env)**: Wypełnij klucze Firebase z prefixem `NEXT_PUBLIC_`.
3. **Uruchomienie**: `npm run dev`

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
