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

## 🧾 4. Integracja KSeF (v2.0, Produkcyjna, 2026)

**Pełny, 4-etapowy standard Handshake KSeF v2.0 (Zgodność OpenAPI):**
1.  **Challenge (Wyzwanie)**: Pobranie unikalnego `challenge` oraz `timestampMs` z serwerów MF (`POST /v2/auth/challenge`).
2.  **Encryption (Szyfrowanie)**: Dynamiczne pobranie certyfikatu publicznego oraz zaszyfrowanie ciągu `{KSEF_TOKEN}|{timestampMs}` algorytmem **RSA-OAEP (SHA-256)**.
3.  **KSeF-Token (Inicjalizacja)**: Przesłanie zaszyfrowanego tokena wraz z identyfikatorem NIP (`POST /v2/auth/ksef-token`). System otrzymuje status **202 Accepted** oraz token operacyjny.
4.  **Redeem (Finalizacja)**: Wymiana tokena operacyjnego na ostateczny `accessToken` (`POST /v2/auth/token/redeem`).

**Główne Atuty Rozwiązania:**
- **Dynamiczne Zarządzanie Kluczami**: Certyfikaty są pobierane w runtime i trzymane w bezpiecznym cache'u w pamięci (brak plików PEM w repozytorium).
- **Stabilny Cache**: Access Token jest buforowany przez 55 minut, co minimalizuje obciążenie serwerów MF i zapewnia stabilność sesji.
- **Pełna Diagnostyka**: Endpoint `/api/ksef/verify-all` raportuje status każdego z 4 kroków autoryzacji oraz Kroku 5 (Wyszukiwanie Synchroniczne).
- **Dual-Sync**: Każdą pobraną fakturę zapisujemy jednocześnie w Prisma (SQL) i Firestore.

**Narzędzia:**
- **Synchronizacja**: `/api/ksef/sync` – pełne pobranie faktur z MF do bazy Sig i Firestore.
- **Paginacja**: Pobieranie do 50 faktur na stronę przez endpoint `/v2/online/query/invoice/sync` (Metadane) przy użyciu nagłówka `SessionToken`.



---

## 💡 Instrukcja "Na Start"
- **Pasek Szybkich Akcji**: To serce systemu. Stąd dodasz fakturę, sprawdzisz projekt lub zaimportujesz wyciąg z banku.
- **Panel Projektu**: Kliknij w nazwę budowy, aby zobaczyć szczegółowe wykresy wydatków i przychodów.
- **Konto Bankowe**: Przed pierwszym importem wyciągu upewnij się, że w ustawieniach dodałeś swój numer konta firmowego.

---
*Dla techników: Dokumentacja techniczna znajduje się w [docs/AI_look.md](./docs/AI_look.md), a historia zmian w [docs/CHLOG_TECH.md](./docs/CHLOG_TECH.md).*

**Sig ERP – Twoja firma pod pełną kontrolą.**
