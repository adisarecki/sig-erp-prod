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

System teraz pokazuje te trzy warstwy zawsze w takiej samej kolejności - co sprawia, że żaden współwłaściciel nie ma wątpliwości co do realnej płynności. Klikniecie na dowolną kwotę (przychody/koszty/marża) otwiera tabelę ze wszystkimi fakturami - pełna transparentność.

**Nowoczesny ERP (SAP, Oracle) używa właśnie takiego modelu** - nasz system podąża najlepszymi praktykami branżowymi.

---

## 📱 10. Mobilna Ewolucja (Vector 117)

Sig ERP jest teraz w pełni operacyjny na Twoim telefonie. Wdrożyliśmy **Hardened Mobile Shell**:
- 🍔 **Szuflada Nawigacyjna**: Zamiast bocznego paska, na mobile masz szybki dostęp przez ikonę menu (Sheet UI).
- 📱 **Inteligentne Tabele**: Wszystkie dane finansowe w KSeF i Projektach mają teraz asystenta przewijania (`TableWrapper`). Nic nie ucieka poza ekran.
- 📐 **Płynne Modale**: Okna dodawania kosztów i przychodów na telefonie zachowują się jak natywne aplikacje (Bottom Drawer).
- 🛡️ **Zero Ryzyka**: Wszystkie zmiany są czysto wizualne (Tailwind 4 + Shadcn). Twoja "pancerna" logika biznesowa Vector 110/116 pozostała nietknięta.

---

## 🔐 11. VECTOR 117: Automatyczne Kaucje i Monitoring Płynności

Nowy moduł inteligentnie obsługuje kaucje gwarancyjne:

### Jak to działa
Każdy projekt ma **Podstawę naliczania kaucji**:
- **BRUTTO** (domyślnie): Formuła `Oczekiwana = Brutto × (1 - Stopa kaucji)`
- **NETTO**: Formuła `Oczekiwana = Brutto - (Netto × Stopa kaucji)`

### Praktyczny przykład
```
Projekt: Budowa Biurowca
Kaucja krótkoterminowa: 10%
Podstawa: BRUTTO

Faktura sprzedaży:
- Netto: 10,000 PLN
- VAT (23%): 2,300 PLN
- Brutto: 12,300 PLN

Oczekiwana wpłata: 12,300 × 0,9 = 11,070 PLN
Kaucja do Skarbca: 1,230 PLN
```

### Safe-to-Spend w praktyce
```
Saldo bankowe: 50,000 PLN
- Zadłużenie VAT: -5,000 PLN
- Kaucje zamrożone: -10,000 PLN
= Safe-to-Spend: 35,000 PLN
```

**Widzisz dokładnie, ile pieniędzy możesz bezpiecznie wydać.**

### Automatyczne ostrzeżenia
System ostrzega Cię gdy:
- ⚠️ Klient nie zapłacił pełnej kwoty
- ⚠️ Zadłużenie VAT jest zbyt wysokie
- ⚠️ Zbyt dużo pieniędzy zamrożonych w kaucjach
- 🚨 Brakuje Ci gotówki (negative safe-to-spend)

---

## 🛡️ 12. Drift Resolution Center (Vector 120.2)

Ostatni, krytyczny mur obronny Twoich danych. Czasem w systemach rozproszonych (Firestore + PostgreSQL) zdarza się, że dane "rozjeżdżają się" (np. 9 faktur w Firebase vs 8 w SQL). Nazywamy to **Dual-Sync Drift**.

### Twój Panel Przewagi:
Wprowadziliśmy **Centrum Rozwiązywania Driftu**, które aktywuje się, gdy tylko system wykryje najmniejszą niespójność:

- **Proaktywne Monitorowanie**: Każdy "Zombie" (rekord tylko w Firebase) lub "Ghost" (rekord tylko w SQL) jest natychmiast wyłapywany.
- **Atomowe Akcje Resolution**:
    - **[FORCE TO SQL]**: Jeśli znasz prawdę w Firebase, jednym kliknięciem "kotwiczysz" ją w bazie SQL. System sam przelicza daty i kwoty.
    - **[PURGE FS]**: Jeśli rekord jest wynikiem błędu lub testu, usuwasz go trwale z Firebase, przywracając idealny porządek 8/8.
- **Pełny Audyt**: Każda taka interwencja jest zapisywana w **AuditLog**. Wiemy kto, kiedy i dlaczego "pchnął" dane.

**Badge SYNC: OK** to teraz nie tylko napis – to gwarancja, że Twoja analityka (SQL) i operacje (Firebase) to jedno i to samo źródło prawdy.

---

## 🧹 13. Strefa Deweloperska: Konserwacja i Start Produkcyjny (Vector 120.3)

Przygotowaliśmy system na Twój **Start Produkcyjny**. Kiedy skończysz etap testów i będziesz gotowy wprowadzić realne dane swojej firmy, funkcja "Wyczyść Dane Operacyjne" pozwoli Ci na atomowy reset bez niszczenia Twojego nakładu pracy włożonego w konfigurację.

### Twoja Tarcza Operacyjna:
- **Głębokie Oczyszczanie**: System nie usuwa już tylko "głównych" tabel. Teraz czyści absolutnie wszystko, co mogłoby zostać po testach: od ledgerów i wyciągów bankowych, przez kaucje gwarancyjne, aż po składniki majątku (Assety) i logi synchronizacji.
- **Szacunek do Twoich Danych**: Zgodnie z Twoją wizją, **Kontrahenci oraz Twoje Konta Bankowe (IBANy) zostają nienaruszone**. Twoja baza dostawców i inwestorów, którą już zbudowałeś, jest bezpieczna. 
- **Ochrona Dostępu**: System chroni konta użytkowników. Master Reset nie wyloguje Cię ani nie zablokuje dostępu Twojemu zespołowi.
- **Transparentność przed Akcją**: Zaktualizowany interfejs w Ustawieniach precyzyjnie informuje, co zniknie (Projekty, Finanse, Kaucje), a co zostanie (Kontrahenci, Użytkownicy).

**To Twój "przycisk atomowy" z precyzyjnym celownikiem – czyścisz historię testów, zachowując fundamenty firmy.**

---

*Dla techników: Szczegółowe zasady budowy znajdują się w [AI_look.md](./docs/AI_look.md).*

**Sig ERP – Twoja firma pod pełną kontrolą.**
