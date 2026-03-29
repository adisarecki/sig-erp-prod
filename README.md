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

## 🧾 4. Integracja KSeF (JWT v2, Produkcyjna, Protokół Hybryda 2026)

**Zaawansowany, 4-fazowy standard Handshake KSeF (Protokół Hybryda):**
1.  **Challenge (Wyzwanie)**: Pobranie unikalnego `challenge` oraz `timestampMs` z serwerów MF (`POST /v2/auth/challenge`).
2.  **Inicjalizacja (RSA Init)**: Wysłanie zaszyfrowanego tokena (`RSA-OAEP SHA-256`) wraz z kompletnym kontekstem `onip` (`POST /v2/auth/ksef-token`).
3.  **Pancerny Polling (Weryfikacja)**: Odpytywanie `GET /v2/auth/{referenceNumber}` (max 150 prób, co 2s) aż do uzyskania statusu **200 (OK)**.
4.  **Redeem (Finalizacja JWT)**: Wymiana na ostateczny `accessToken` (`POST /v2/auth/token/redeem`).

**Główne Atuty Architektury Hybrydowej:**
- **Heavy Inbound Auth**: Pełna zgodność z bramką produkcyjną Ministerstwa (wymagane szyfrowanie RSA i certyfikaty X509).
- **Lightweight Outbound Sync**: Po autoryzacji system używa wyłącznie `Bearer Token` do pobierania metadanych, całkowicie omijając zbędną i wolną sesję online (`sessions/online`).
- **Bezpieczny Zakres (7 Dni)**: Domyślny zasięg pobierania faktur ograniczony do **7 dni**, co eliminuje błędy 504 (Timeout) na Vercelu.
- **Twarda Logika Dat (+02:00)**: Ręcznie wymuszony offset czasowy zgodny z polskim czasem letnim.
- **JWT Manager (KsefSessionManager)**: Pełna automatyzacja sesji i odświeżania tokenów w bazie Prisma.
- **Node.js Runtime Standard**: Pełna zgodność z natywnym modułem `crypto`.
- **Obsługa FA(3)**: Ekstrakcja szczegółowych pozycji zamówienia (ZAL) oraz inteligentna kategoryzacja REVENUE/EXPENSE.

**Narzędzia:**
- **Synchronizacja**: `/api/ksef/process` – pełne przetwarzanie i parowanie faktur.
- **Weryfikacja Handshake**: `/api/ksef/test-sync` – szybki test połączenia w standardzie JWT v2.
- **UI KSeF**: Dashboard główny ze zintegrowanymi wynikami w `src/app/(dashboard)/finanse/ksef/page.tsx`.



---

## 💡 Instrukcja "Na Start"
- **Pasek Szybkich Akcji**: To serce systemu. Stąd dodasz fakturę, sprawdzisz projekt lub zaimportujesz wyciąg z banku.
- **Panel Projektu**: Kliknij w nazwę budowy, aby zobaczyć szczegółowe wykresy wydatków i przychodów.
- **Konto Bankowe**: Przed pierwszym importem wyciągu upewnij się, że w ustawieniach dodałeś swój numer konta firmowego.

---
*Dla techników: Dokumentacja techniczna znajduje się w [docs/AI_look.md](./docs/AI_look.md), a historia zmian w [docs/CHLOG_TECH.md](./docs/CHLOG_TECH.md).*

**Sig ERP – Twoja firma pod pełną kontrolą.**
