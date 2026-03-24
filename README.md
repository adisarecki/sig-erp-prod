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

- **Czysta Gotówka (Safe to Spend)**: Ile pieniędzy możesz realnie wypłacić z firmy po odliczeniu VAT i rezerwy na podatek dochodowy (9%).
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

### 🛠️ Bug Fix #012: Stabilizacja Kontrahentów & NIP
- **Unikalność NIP per Tenant**: Zmieniono schemat bazy danych Prisma, aby umożliwić wielu osobom (tenantom) posiadanie faktur od tego samego dostawcy (np. ORLEN S.A.). NIP jest teraz unikalny w obrębie jednej firmy, a nie globalnie.
- **Wzorzec Find-or-Create**: Rejestracja kosztów i przychodów wykorzystuje teraz bezpieczny wzorzec wyszukiwania kontrahenta przed zapisem, co eliminuje błędy `Unique constraint failed`.
- **Koszty Ogólne**: Faktury bez przypisanego projektu są teraz poprawnie klasyfikowane jako `GENERAL_COST` w obu bazach danych (Dual-Sync).
- **Opcjonalność Projektu**: Zmiana w Prisma Schema: Ustawiono `projectId` jako opcjonalne w modelach `Invoice` i `Transaction`, aby umożliwić pełną obsługę Kosztów Ogólnych Firmy (GENERAL_COST).
- **Synchronizacja Produkcyjna**: Wymuszono synchronizację schematu Prisma podczas buildu Vercel (db push && generate).
- **Logika Formularza (UI/UX)**: Sekcja "Kaucja Gwarancyjna" jest teraz renderowana warunkowo – pojawia się tylko przy kategorii **INWESTYCJA**, co upraszcza księgowanie standardowych kosztów i paliwa.

---
### 📅 Status Wdrożenia (2026-03-23)
- **Sukces**: Pomyślnie wdrożono i przetestowano obsługę Kosztów Ogólnych (GENERAL_COST).
- **Fix**: Poprawiono synchronizację Prisma Schema na Vercel – `projectId` jest teraz opcjonalny.
- **UI**: Wprowadzono warunkowe ukrywanie sekcji kaucji dla dokumentów kosztowych.
- **Finanse**: Potwierdzono poprawność wzoru: **Safe to Spend = Bilans - VAT - CIT (9%)**.

---
- **Form Clarity**: Dodano wyraźne pola "Tytuł wydatku / przychodu" w formularzach, aby ułatwić nazywanie transakcji.

---
### 📅 Status Wdrożenia (2026-03-23 v3 - Data Integrity)
- **Data Healing**: Wprowadzono przycisk `Health Check (Orlen)` w CRM, który usuwa duplikaty bez NIP-u, rozwiązując problem "śmieciowych" danych.
- **Strict Validation**: Wprowadzono blokadę tworzenia partnerów o tej samej nazwie bez NIP-u (Deduplikacja prewencyjna).
- **UI Overflow Fix**: Ograniczono wysokość list rozwijanych do 240px w modalach, co przywróciło pełną obsługę pól "Projekt" i "Kategoria" na mniejszych ekranach.

---
### 📅 Status Wdrożenia (2026-03-23 v4 - CRM Consistency)
- **Prisma-First CRM**: Lista kontrahentów pobiera teraz dane bezpośrednio z Prismy (SQL), zapewniając 100% spójności z wyszukiwarkami i raportami.
- **Master Sync SQL**: Dodano funkcję pełnej synchronizacji `Firestore -> SQL` dla kontrahentów i statusów faktur.
- **Ujednolicone UI CRM**: Wprowadzono manualne zakładki [WSZYSTKIE], [INWESTORZY], [DOSTAWCY] w stylu Rejestru Transakcji oraz badge typów przy nazwach.
- **Formuła Real Debt**: Saldo kontrahenta bazuje na `SUM(amountGross) WHERE status NOT IN ('PAID', 'REVERSED')`. Badge "ZALEGA" znika z DOM przy bilansie 0.
- **Poprawa Modali**: Zaimplementowano `max-h-[70vh]` dla list rozwijanych (Select/Dropdown).
- **Skaner OCR Gemini 3 Flash Preview**: Wdrożono inteligentne skanowanie faktur z automatycznym mapowaniem kontrahentów (Smart Match) i blokadą duplikatów (Anti-Duplicate Shield).
- **Naprawa Typów OCR & Prisma Config**: Rozwiązano problem walidacji `vatRate` (number/string) i zmigrowano konfigurację Prisma do `prisma.config.ts`.
- **Selektor Lat w Analityce**: Wdrożono dynamiczny wybór roku na Dashboardzie, umożliwiający precyzyjne przeglądanie statystyk (Miesiąc/Kwartał/Rok) dla lat ubiegłych.
- **Aktywacja Ratownika Płynności**: Ożywiono przycisk "Zarządzaj Kosztami" w module Alarmu Płynności – teraz przekierowuje on do listy nieopłaconych faktur (UNPAID) z automatycznym sortowaniem po terminie płatności.

---
### 📅 Status Wdrożenia (2026-03-24 - OCR Inbox & Refinement)
- **Zero-Day Auto-Pay**: System automatycznie oznacza faktury jako opłacone, gdy data wystawienia pokrywa się z terminem płatności lub wykryto słowa kluczowe (Gotówka, Karta itp.).
- **OCR Inbox**: Wdrożono Inbox OCR z obsługą wielu dokumentów na jednym skanie oraz wstępną weryfikacją przed księgowaniem.
- **Safe Delete & Quick View**: Wdrożono funkcję Safe Delete (usuwanie z potwierdzeniem) oraz podgląd detali dokumentu finansowego z danymi OCR (NIP, Daty, Projekt).
- **Auto-Matching (Pewniak)**: Jeśli system rozpozna NIP dostawcy z bazy, automatycznie przypisuje mu ostatnio użytą kategorię i projekt. Takie pola są oznaczane jako "Pewniak" (Sparkles).
- **Bulk Action**: Dodano przycisk "Zaksięguj Wszystkie Prawidłowe", który jednym kliknięciem zapisuje wszystkie poprawnie zweryfikowane dokumenty do bazy.
- **Multi-Entity OCR**: Obsługa wielu faktur/paragonów na jednym zdjęciu oraz seryjne przesyłanie do 5 plików.

---
*Dla programistów: Techniczna dokumentacja DNA znajduje się v [docs/AI_look.md](./docs/AI_look.md)*

---
*Vercel & Firestore Ready 🚀*
