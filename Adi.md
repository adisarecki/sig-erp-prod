# SIG ERP – Strategia i Wizja (Adi.md)

Witaj Adi. Ten dokument to Twoje Centrum Dowodzenia. Zapomnij o wersjach Node.js czy Prisma. To jest miejsce, gdzie odpowiadamy na najważniejsze pytania: „Gdzie jest moja kasa?” oraz „Jak chronimy Twoją płynność finansową?”.

---

## 💰 1. Gdzie jest moja kasa? (Filozofia Profit First)

System **SIG ERP** nie jest zwykłą bazą danych. To Twój firewall finansowy. Najważniejszą liczbą, jaką tu zobaczysz, jest **Potwierdzone Saldo Bankowe**. To Twoja **Absolutna Kotwica (Vector 106)**.

System już nie tylko "zgaduje" Twoją sytuację na podstawie wpisanych faktur. Teraz **fizyczny stan konta z banku** jest jedyną prawdą. Jeśli wgrasz wyciąg, a system wyliczy inną kwotę niż masz w PKO BP, natychmiast poinformujemy Cię o rozbieżności. Dzięki temu masz 100% pewności, że to, co widzisz na ekranie, ma pokrycie w realnej gotówce.

Oprócz tego pilnujemy Twojej płynności poprzez:
- **Safe to Spend**: Pieniądze, które realnie możesz wydać po odliczeniu rezerw podatkowych i nadchodzących kosztów.
- **Architektura Płynności (Vector 101.1)**: System eliminuje dysonans między fakturowaniem a realną gotówką. Twój Dashboard i Projekty priorytetyzują **Paliwo (Realny Limit Operacyjny)** – Twoją faktyczną bazę operacyjną (90%). Pozostałe 10% to **Skarbiec (Kaucja 🔐)**, który wizualnie blokujemy na pasku postępu.
- **Retention Fork (Vector 102.2)**: Jeśli podpiszesz aneks zmieniający stawki kaucji, system zapyta Cię o zasięg zmian. Możesz chronić historię (Opcja A) lub zaktualizować cały projekt wstecz (Opcja B), aby bilans Skarbca zawsze zgadzał się z aktualną umową.

---

## 🚀 2. Twoja Wizja Wolności (Po co to zrobiłeś?)

Zbudowaliśmy ten system, abyś Ty nie musiał tracić życia na:
- **Ręczne sprawdzanie przelewów**: Wyciąg z banku ładuje się do Hub-a, a system sam sugeruje: "To pasuje do tej faktury (z uwzględnieniem kaucji)". Jednym kliknięciem zatwierdzasz całą paczkę.
- **Szukanie kaucji**: Skarbiec Kaucji pilnuje pieniędzy zamrożonych u inwestorów. Przypomnimy Ci o nich, zanim termin zwrotu minie.
- **Niepewność przy budowie**: Dashboard pokaże Ci na żywo, czy dana inwestycja zarabia, czy koszty wymknęły się spod kontroli.

### 🕵️ Investigation Mode (Tryb Audytu Finansowego)
Wprowadziliśmy dedykowany tryb audytu z trwałymi sesjami, który pozwala na wgrywanie pakietów faktur historycznych, analizę ich zgodności oraz generowanie raportów miesięcznych i rocznych. Dokumenty w tym trybie są oznaczone flagą `isAudit: true`, dzięki czemu nie wpływają na bieżące wskaźniki operacyjne 2026.

---

## 📈 3. Mapa do Imperium (Twój Roadmap)

Sig ERP rośnie razem z Twoją firmą. Oto nasze strategiczne kroki:

1. **Pełna Automatyzacja KSeF**: Zapomnij o mailach z fakturami. Wszystko spływa prosto od dostawców. (Wdrożone!)
2. **Inteligentny Asystent (AI)**: System sam zasugeruje: "Ten projekt ma niską marżę, sprawdź koszty materiałów".
3. **Moduł CRM & Oferty**: Tworzenie ofert dla klientów jednym kliknięciem na podstawie Twoich historycznych kosztów.
4. **Automatyka JPK**: Gotowe zestawienia do biura rachunkowego za jednym kliknięciem.

---

## 🛠️ 4. Bezpieczeństwo i Spokój

Jeśli w banku coś się nie zgadza, system zapali **Czerwoną Lampkę (Red Light)**. Każda złotówka ma swoje miejsce, a Ty masz pełną przejrzystość – nawet jeśli nie znasz się na programowaniu.

---

## 🔍 5. Przejrzystość w Liczbach (Vector 110)

Często patrzysz na ekran i widzisz: "Przychody: 100 000 zł" lub "Koszty: -11 685,00 zł" – ale nie masz pojęcia, z czego się składają.

**Nowe rozwiązanie**: Każda liczba na karcie projektu jest teraz **klikalna**. Kliknij na kwotę przychodu, kosztu lub marży – otworzy się tabela ze wszystkimi fakturami:

```
Data       | Nr Faktury | Netto      | Brutto     | Dostawca         | Typ
---------- | ---------- | ---------- | ---------- | --------------- | --------
2026-03-15 | FV/2026/1  | 10 000,00  | 12 300,00  | ABC Construction | SPRZEDAŻ
2026-03-10 | FA/2026/5  | -5 000,00  | -6 150,00  | Steel Supplier   | KOSZT
                                     ...
=========================================================================
Razem:     | —          | 5 000,00   | 6 150,00   | —                | —
```

Dzięki temu wiesz **dokładnie**, dlaczego projekt zarabia lub traci pieniądze.

---

## 🔎 6. Dokładne Liczby, Bez Zgadywania (Vector 111)

Problem który naprawiliśmy: System czasem ignorował wartości równe 0 (bo 0 jest "falsy" w JavaScript). Jeśli ustawiłeś **0% kaucji**, to czasem pokazywał 10%! 🚀

**Nowe zabezpieczenie (Vector 111 - Retention Rate Integrity)**:
- ✅ Firestore zapisuje teraz z `update()` zamiast `.set()` - gwarantuje precyzję
- ✅ Failsafe: każda null/undefined wartość konwertowana na dokładnie 0
- ✅ Dashboard i lista projektów używają tej samej logiki - ZAWSZE się zgadzają
- ✅ **Brak defaultowania do 10%** - respect dla Twoich decyzji

**Rezultat praktyczny**:
```
Nowowiejskiego 2: 0% kaucji → 330 000 zł paliwa (100% budżetu)
Kopaina MARCEL:  10% kaucji → 90 000 zł paliwa (90% budżetu)
```

**Święte to co ustawiłeś - system SIĘ nie wymyśla domyślnych wartości!**


---

## 🗂️ 7. Przejrzysta Hierarchia Umów (Vector 112)

---

## 🛡️ 8. Centra Rekoncyliacji Bankowej (Vector 120)

Wprowadziliśmy nową, manualną metodę rozliczeń finansowych. Koniec z „Cichymi Importami”.

### Główne Zalety:
- **Triage Hub**: Ty decydujesz, czy transakcja to koszt, przychód czy Shadow Cost.
- **Auto-Match (High Confidence)**: System sam liczy kaucje i sugeruje dopasowanie do faktur.
- **On-the-fly Create**: Twórz transakcje jednym przyciskiem – system uczy się Twojej firmy.

---

## 📊 9. Klarowność Płynności: Hierarchia ERP

Ostatni problem, który rozwiązaliśmy: **mylące oznaczenia procent**.

Gdy instalujesz 0% kaucji, pojawił się dylemat:
- Czy "Paliwo 330k" znaczy 330k (100%)?
- Czy "Dostępne (90%)" to jest jakiś default?
- Co jeśli mam 30% kaucji - to ile mogę wydać?

**Nowe rozwiązanie - hierarchia ERP-owa**:

```
Projekt: Nowowiejskiego 2
┌──────────────────────────────────────┐
│ 📋 UMOWA (Całkowita)  = 330 000,00   │  ← Pełna wartość kontraktu
├──────────────────────────────────────┤
│    🔒 KAUCJA (Zabezpiecz.) = 0,00    │  ← To jest zamrożone u inwestora
├──────────────────────────────────────┤
│    💚 DOSTĘPNE = 330 000,00          │  ← To możesz wydać TERAZ
└──────────────────────────────────────┘

Projekt: Kopania MARCEL
┌──────────────────────────────────────┐
│ 📋 UMOWA (Całkowita)  = 100 000,00   │
├──────────────────────────────────────┤
│    🔒 KAUCJA (Zabezpiecz.) = 10 000  │  ← Zamrożone przez 36 miesięcy
├──────────────────────────────────────┤
│    💚 DOSTĘPNE = 90 000,00           │  ← Do wydania na materiały
└──────────────────────────────────────┘
```

System teraz pokazuje te trzy warstwy zawsze w takiej samej kolejności - co sprawia, �## 🔐 11. VECTOR 117: Scentralizowane Kaucje i Monitoring Płynności

Zmieniliśmy filozofię kaucji z budżetowej na **fakturową**. Koniec z "zamrażaniem" wirtualnych pieniędzy, których jeszcze nie zarobiłeś.

### Kluczowe ulepszenia:
- **Kaucja Wyzwalana Płatnością**: System nalicza kaucję dopiero w momencie wystawienia/opłacenia faktury. 
- **Należności vs Zobowiązania**: Dashboard rozróżnia teraz pieniądze, które mają wpłynąć (**Należności** - zielone, dodatnie) od tych, które musisz zapłacić (**Zobowiązania** - czerwone, ujemne).
- **Rezerwa CIT (9%)**: System automatycznie rezerwuje 9% Twojej marży netto na poczet podatku CIT/PPE i odejmuje to od Twojej "Czystej Gotówki".
- **Skarbiec (Wizualny)**: W Cockpicie projektu widzisz "Kaucję Prognozowaną" (Info) – czyli ile docelowo zostanie zamrożone po zakończeniu wszystkich etapów.

### Safe-to-Spend (Twoja Prawdziwa Płynność)
Obecna formuła:
`Czysta Gotówka = Potwierdzone Saldo Bankowe - Dług VAT - Rezerwa CIT (9%) - Kaucje (Skarbiec) - Zobowiązania (Faktury Kosztowe)`

---

## 🛡️ 12. Drift Resolution Center (Vector 120.2)

Ostatni, krytyczny mur obronny Twoich danych. Czasem w systemach rozproszonych (Firestore + PostgreSQL) zdarza się, że dane "rozjeżdżają się" (np. 9 faktur w Firebase vs 8 w SQL). Nazywamy to **Dual-Sync Drift**.

### Twoje Narzędzia Naprawcze:
Wprowadziliśmy **Centrum Rozwiązywania Driftu**, które aktywuje się, gdy tylko system wykryje najmniejszą niespójność. Dodatkowo w menu **Sync Status** znajdziesz przycisk **"Napraw Drift Finansowy"**, który usuwa stare, błędne wpisy kaucji i przywraca idealny porządek w Twoim bilansie.

---

*Dla techników: Szczegółowe zasady budowy znajdują się w [AI_look.md](./docs/AI_look.md).*

---

## 🧮 13. System-wide Financial Integrity (Vector 200.99)
Zlikwidowaliśmy problem gubienia ujemnych znaków (jak np. korekty VAT) spowodowany przez lokalne skrypty UI (`.reduce()`, `Math.abs()`). Cały system posługuje się teraz wyłącznie **jednym** matematycznym rdzeniem walidacyjnym: `src/lib/finance/coreMath.ts` (Financial Math Engine). Od tego momentu dashboardy, audyty oraz widgety projektowe wyciągają perfekcyjne stany finansowe opierające się natywnie o `decimal.js`, z zakazem modyfikacji matematyki na froncie.


**Sig ERP – Twoja firma pod pełną kontrolą.**
– to Twoje centrum akcji.

### Kluczowe ulepszenia UX:
- **Chronologia i Grupowanie**: Transakcje są teraz grupowane według dni (**Dzisiaj**, **Wczoraj**, konkretne daty). Widzisz historię tak, jak w nowoczesnej aplikacji bankowej.
- **Sito i Koszty Drobne**: Małe wydatki (< 200 PLN) bez dopasowania KSeF są automatycznie zwijane w sekcję **"Koszty drobne"** wewnątrz każdego dnia. Dzięki temu najważniejsze, duże faktury są zawsze na górze, a "szum" nie rozprasza Twojej uwagi.
- **Human-Readable Titles**: Nasz silnik normalizacji usuwa śmieciowe ciągi cyfr (np. `000483...`) i wyciąga czyste nazwy sprzedawców (np. **Orlen**, **Żabka**, **Allegro**).
- **Logika Decyzyjna**: Każda karta transakcji to jasna informacja. Jeśli system rozpoznał fakturę, widzisz zielony przycisk `[ ✓ ]`. Jeśli to nowy koszt, jednym kliknięciem `[ + ]` tworzysz go w systemie.

### Poprawka techniczna (Encoding FIX):
Wyeliminowaliśmy problem "krzaczków" przy imporcie plików CSV z PKO BP. System natywnie dekoduje standard `windows-1250`, więc polskie ogonki (ą, ć, ę, ł, ń, ó, ś, ź, ż) są zawsze poprawnie wyświetlane.

---

*Dla techników: Szczegółowe zasady budowy znajdują się w [AI_look.md](./docs/AI_look.md).*

**Sig ERP – Twoja firma pod pełną kontrolą.**

---

## 🚀 10. VECTOR 130: Koniec z Wpisywaniem Danych (GUS BIR 1.1)

Wprowadziliśmy pełną integrację z bazą **GUS BIR 1.1**. Teraz dodawanie kontrahenta to kwestia sekund, a nie minut.

### Co to dla Ciebie zmienia?
- **Magic Button**: W formularzu „Dodaj Firmę”, obok pola NIP, znajdziesz ikonę lupy 🔍.
- **Smart Autofill**:
    - Wpisz 10 cyfr NIP – system automatycznie zapyta bazę GUS o dane.
    - Jeśli zmienisz zdanie i zaczniesz wpisywać inny NIP – stare dane zostaną wyczyszczone, abyś nie zapisał błędnej firmy.
- **Precyzyjne Adresy**: System automatycznie formatuje adres według standardu: `ul. [Ulica] [Nr], [Kod] [Miasto]`.
- **Produkcyjna Moc**: System korzysta teraz z Twojego oficjalnego klucza produkcyjnego (GUS_BIR_KEY), co gwarantuje stabilność i dostęp do najświeższych danych z rejestru.

**Zero błędów, zero literówek, 100% profesjonalizmu.**

---

*Dla techników: Szczegółowe zasady budowy znajdują się w [AI_look.md](./docs/AI_look.md).*

**Sig ERP – Twoja firma pod pełną kontrolą.**
