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

## 🧾 4. Integracja KSeF (Nowość - Sprint 1)

Rozpoczęliśmy wdrażanie modułu **KSeF Core (Tryb Read-Only)**. System potrafi teraz:
- **Bezpieczna Autoryzacja**: Automatyczne pobieranie tokenów sesyjnych z Ministerstwa Finansów.
- **Synchronizacja Metadanych**: Pobieranie listy najnowszych faktur kosztowych wystawionych na Twoją firmę.
- **Parser XML (Fa/2)**: Inteligentne wyciąganie danych (NIP, kwoty, daty) bezpośrednio z surowych plików XML z KSeF.

**Weryfikacja:**
Możesz sprawdzić poprawność połączenia pod adresem: `/api/ksef/test-sync`. Wynik parsowania zostanie zalogowany w konsoli Vercela.

---

## 💡 Instrukcja "Na Start"
- **Pasek Szybkich Akcji**: To serce systemu. Stąd dodasz fakturę, sprawdzisz projekt lub zaimportujesz wyciąg z banku.
- **Panel Projektu**: Kliknij w nazwę budowy, aby zobaczyć szczegółowe wykresy wydatków i przychodów.
- **Konto Bankowe**: Przed pierwszym importem wyciągu upewnij się, że w ustawieniach dodałeś swój numer konta firmowego.

---
*Dla techników: Dokumentacja techniczna znajduje się w [docs/AI_look.md](./docs/AI_look.md), a historia zmian w [docs/CHLOG_TECH.md](./docs/CHLOG_TECH.md).*

**Sig ERP – Twoja firma pod pełną kontrolą.**
