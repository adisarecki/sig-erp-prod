# SIG ERP – Strategia i Wizja (Adi.md)

Witaj Adi. Ten dokument to Twoje Centrum Dowodzenia. Zapomnij o wersjach Node.js czy Prisma. To jest miejsce, gdzie odpowiadamy na najważniejsze pytania: „Gdzie jest moja kasa?” oraz „Jak chronimy Twoją płynność finansową?”.

---

## 💰 1. Gdzie jest moja kasa? (Filozofia Profit First)

System **SIG ERP** nie jest zwykłą bazą danych. To Twój firewall finansowy. Najważniejszą liczbą, jaką tu zobaczysz, jest **Potwierdzone Saldo Bankowe**. To Twoja **Absolutna Kotwica (Vector 106)**.

System już nie tylko "zgaduje" Twoją sytuację na podstawie wpisanych faktur. Teraz **fizyczny stan konta z banku** jest jedyną prawdą. Jeśli wgrasz wyciąg, a system wyliczy inną kwotę niż masz w PKO BP, natychmiast poinformujemy Cię o rozbieżności. Dzięki temu masz 100% pewności, że to, co widzisz na ekranie, ma pokrycie w realnej gotówce.

Oprócz tego pilnujemy Twojej płynności poprzez:
- **Safe to Spend**: Pieniądze, które realnie możesz wydać po odliczeniu rezerw podatkowych i nadchodzących kosztów.
- **Architektura Płynności (Vector 101.1)**: System eliminuje dysonans między fakturowaniem a realną gotówką. Twój Dashboard i Projekty priorytetyzują **Paliwo (Realny Limit Operacyjny)** – Twoją faktyczną bazę operacyjną (90%). Pozostałe 10% to **Skarbiec (Kaucja 🔒)**, który wizualnie blokujemy na pasku postępu.
- **Retention Fork (Vector 102.2)**: Jeśli podpiszesz aneks zmieniający stawki kaucji, system zapyta Cię o zasięg zmian. Możesz chronić historię (Opcja A) lub zaktualizować cały projekt wstecz (Opcja B), aby bilans Skarbca zawsze zgadzał się z aktualną umową.

---

## 🚀 2. Twoja Wizja Wolności (Po co to zrobiłeś?)

Zbudowaliśmy ten system, abyś Ty nie musiał tracić życia na:
- **Ręczne sprawdzanie przelewów**: Wyciąg z banku sam "skanuje" Twoich kontrahentów i faktury.
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

## 🛡️ 4. Bezpieczeństwo i Spokój

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

## 🔐 6. Dokładne Liczby, Bez Zgadywania (Vector 111)

Problem który naprawili\u015bmy: System czasem ignorowa\u0142 warto\u015bci r\u00f3wne 0 (bo 0 jest \"falsy\" w JavaScript). Je\u015bli ustawi\u0142e\u015b **0% kaucji**, to czasem pokazywa\u0142 10%! 🐛

**Nowe zabezpieczenie (Vector 111 - Retention Rate Integrity)**:
- ✅ Firestore zapisuje teraz z `update()` zamiast `.set()` - gwarantuje precyzj\u0119
- ✅ Failsafe: ka\u017cda null/undefined warto\u015b\u0107 konwertowana na dok\u0142adnie 0
- ✅ Dashboard i lista projekt\u00f3w u\u017cywaj\u0105 tej samej logiki - ZAWSZE si\u0119 zgadzaj\u0105
- ✅ **Brak defaultowania do 10%** - respect dla Twoich decyzji

**Rezultat praktyczny**:
```
Nowowiejskiego 2: 0% kaucji → 330 000 zł paliwa (100% bud\u017cetu)
Kopaina MARCEL:  10% kaucji → 90 000 zł paliwa (90% bud\u017cetu)
```

**\u015bwi\u0119te to co ustawi\u0142e\u015b - system SI\u0118 nie wymyśla domyśln\u0105ch wartości!**

---
*Dla technik\u00f3w: Szczeg\u00f3\u0142owe zasady budowy znajduj\u0105 si\u0119 w [AI_look.md](./docs/AI_look.md).*\n\n**Sig ERP \u2013 Twoja firma pod pe\u0142n\u0105 kontrol\u0105.**
