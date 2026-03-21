# Sig ERP – Instrukcja Obsługi (User Manual)

Witaj w centrum dowodzenia Twoją firmą. System Sig ERP został zaprojektowany, aby dać Ci pełną kontrolę nad finansami, projektami i relacjami z kontrahentami w czasie rzeczywistym.

---

## 🛠️ Podręcznik Modułów

### 🤝 Kontrahenci (CRM)
- **Dodawanie Firm**: Wyszukiwanie po NIP automatycznie pobiera dane (jeśli zintegrowane) lub pozwala na ręczny wpis.
- **Automatyczne Obiekty**: Przy dodaniu Inwestora system sam stworzy lokalizację „Siedziba Główna”, abyś mógł od razu przypisać do niego Projekt.
- **Typy Firm**: Oznaczaj czy to *Inwestor*, *Dostawca* czy *Hurtownia* dla lepszej filtracji.

### 🏗️ Projekty
- **Katalog Inwestycji**: Każdy projekt jest przypisany do konkretnego obiektu Twojego klienta.
- **Etapy Budowy**: Dziel projekt na mniejsze części, aby śledzić budżet i postęp prac.
- **Zyskowność**: System na bieżąco sumuje faktury kosztowe i przychodowe przypisane do projektu.

### 💰 Finanse i Cash Flow
- **Rejestr Transakcji**: Wszystkie wydatki i wpływy w jednym miejscu.
- **Koszty Ogólne (Zarząd)**: Wydatki nieprzypisane do konkretnej budowy (biuro, paliwo, telefony). Znajdziesz je w zakładce „Ogólne / Administracyjne”.
- **Wzbogacanie Danych**: Jeśli transakcja z banku nie ma projektu, możesz ją później „Przypisać do projektu” jednym klikiem.

---

## 📈 Dashboard CEO (Widok Strategiczny)

- **Czysta Gotówka (Safe to Spend)**: Ile pieniędzy możesz realnie wypłacić z firmy po odliczeniu VAT i rezerwy na podatek dochodowy (19%).
- **Realny Zysk**: Obliczany jako `Suma Marż z Projektów - Koszty Ogólne Zarządu`.
- **Alarm Płynności**: Jeśli status zmieni się na „Realista”, oznacza to, że uwzględniamy możliwe 14-dniowe opóźnienia wpłat od klientów.

---

## 🔐 Procedury Awaryjne i Bezpieczeństwo

### 📦 Backup & Restore (Skarbiec)
1. **Kopia**: W zakładce `Ustawienia` pobierz plik JSON. Rób to przed każdą większą zmianą danych.
2. **Odtwarzanie**: Wymaga hasła autoryzacyjnego. Pamiętaj, że wgranie kopii **usuwa** obecne dane przed przywróceniem starych.

### 🧨 Master Reset (Atomic Purge)
Funkcja "Wyczyść wszystkie dane" usuwa absolutnie wszystko powiązane z Twoją firmą (Firestore + SQL). Używaj tylko w sytuacjach krytycznych.

---

## 📝 Changelog & Status Testów

- [x] **Import PKO BP**: Stabilny.
- [x] **OCR Faktur**: System rozpoznaje NIP, kwoty i daty.
- [x] **General Costs**: Pełna separacja kosztów zarządu od projektowych.
- [x] **Dual-Sync**: Dane są bezpieczne w dwóch niezależnych chmurach (Google + Neon).
- [x] **API Proxy Architecture**: Wewnętrzne Route Handlery (Next.js) odpytują zewnętrzne mikroserwisy (np. Net-Pocket) pomijając limitacje CORS i chroniąc płynność UI przed awariami obcych integracji.

---
*Dla programistów: Techniczna dokumentacja DNA znajduje się w [docs/AI_look.md](./docs/AI_look.md)*

---
*Vercel & Firestore Ready 🚀*
