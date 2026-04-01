# SIG ERP â€“ Strategia i Wizja (Adi.md)

Witaj Adi. Ten dokument to Twoje Centrum Dowodzenia. Zapomnij o wersjach Node.js czy Prisma. To jest miejsce, gdzie odpowiadamy na najwaĹĽniejsze pytania: â€žGdzie jest moja kasa?â€ť oraz â€žJak chronimy TwojÄ… pĹ‚ynnoĹ›Ä‡ finansowÄ…?â€ť.

---

## đź’° 1. Gdzie jest moja kasa? (Filozofia Profit First)

System **SIG ERP** nie jest zwykĹ‚Ä… bazÄ… danych. To TwĂłj firewall finansowy. NajwaĹĽniejszÄ… liczbÄ…, jakÄ… tu zobaczysz, jest **Potwierdzone Saldo Bankowe**. To Twoja **Absolutna Kotwica (Vector 106)**.

System juĹĽ nie tylko "zgaduje" TwojÄ… sytuacjÄ™ na podstawie wpisanych faktur. Teraz **fizyczny stan konta z banku** jest jedynÄ… prawdÄ…. JeĹ›li wgrasz wyciÄ…g, a system wyliczy innÄ… kwotÄ™ niĹĽ masz w PKO BP, natychmiast poinformujemy CiÄ™ o rozbieĹĽnoĹ›ci. DziÄ™ki temu masz 100% pewnoĹ›ci, ĹĽe to, co widzisz na ekranie, ma pokrycie w realnej gotĂłwce.

OprĂłcz tego pilnujemy Twojej pĹ‚ynnoĹ›ci poprzez:
- **Safe to Spend**: PieniÄ…dze, ktĂłre realnie moĹĽesz wydaÄ‡ po odliczeniu rezerw podatkowych i nadchodzÄ…cych kosztĂłw.
- **Architektura PĹ‚ynnoĹ›ci (Vector 101.1)**: System eliminuje dysonans miÄ™dzy fakturowaniem a realnÄ… gotĂłwkÄ…. TwĂłj Dashboard i Projekty priorytetyzujÄ… **Paliwo (Realny Limit Operacyjny)** â€“ TwojÄ… faktycznÄ… bazÄ™ operacyjnÄ… (90%). PozostaĹ‚e 10% to **Skarbiec (Kaucja đź”’)**, ktĂłry wizualnie blokujemy na pasku postÄ™pu.
- **Retention Fork (Vector 102.2)**: JeĹ›li podpiszesz aneks zmieniajÄ…cy stawki kaucji, system zapyta CiÄ™ o zasiÄ™g zmian. MoĹĽesz chroniÄ‡ historiÄ™ (Opcja A) lub zaktualizowaÄ‡ caĹ‚y projekt wstecz (Opcja B), aby bilans Skarbca zawsze zgadzaĹ‚ siÄ™ z aktualnÄ… umowÄ….

---

## đźš€ 2. Twoja Wizja WolnoĹ›ci (Po co to zrobiĹ‚eĹ›?)

ZbudowaliĹ›my ten system, abyĹ› Ty nie musiaĹ‚ traciÄ‡ ĹĽycia na:
- **RÄ™czne sprawdzanie przelewĂłw**: WyciÄ…g z banku sam "skanuje" Twoich kontrahentĂłw i faktury.
- **Szukanie kaucji**: Skarbiec Kaucji pilnuje pieniÄ™dzy zamroĹĽonych u inwestorĂłw. Przypomnimy Ci o nich, zanim termin zwrotu minie.
- **NiepewnoĹ›Ä‡ przy budowie**: Dashboard pokaĹĽe Ci na ĹĽywo, czy dana inwestycja zarabia, czy koszty wymknÄ™Ĺ‚y siÄ™ spod kontroli.

---

## đź“ 3. Mapa do Imperium (TwĂłj Roadmap)

Sig ERP roĹ›nie razem z TwojÄ… firmÄ…. Oto nasze strategiczne kroki:

1. **PeĹ‚na Automatyzacja KSeF**: Zapomnij o mailach z fakturami. Wszystko spĹ‚ywa prosto od dostawcĂłw. (WdroĹĽone!)
2. **Inteligentny Asystent (AI)**: System sam zasugeruje: "Ten projekt ma niskÄ… marĹĽÄ™, sprawdĹş koszty materiaĹ‚Ăłw".
3. **ModuĹ‚ CRM & Oferty**: Tworzenie ofert dla klientĂłw jednym klikniÄ™ciem na podstawie Twoich historycznych kosztĂłw.
4. **Automatyka JPK**: Gotowe zestawienia do biura rachunkowego za jednym klikniÄ™ciem.

---

## đź›ˇď¸Ź 4. BezpieczeĹ„stwo i SpokĂłj

JeĹ›li w banku coĹ› siÄ™ nie zgadza, system zapali **CzerwonÄ… LampkÄ™ (Red Light)**. KaĹĽda zĹ‚otĂłwka ma swoje miejsce, a Ty masz peĹ‚nÄ… przejrzystoĹ›Ä‡ â€“ nawet jeĹ›li nie znasz siÄ™ na programowaniu.

---

## đź”Ť 5. PrzejrzystoĹ›Ä‡ w Liczbach (Vector 110)

CzÄ™sto patrzysz na ekran i widzisz: "Przychody: 100 000 zĹ‚" lub "Koszty: -11 685,00 zĹ‚" â€“ ale nie masz pojÄ™cia, z czego siÄ™ skĹ‚adajÄ….

**Nowe rozwiÄ…zanie**: KaĹĽda liczba na karcie projektu jest teraz **klikalna**. Kliknij na kwotÄ™ przychodu, kosztu lub marĹĽy â€“ otworzy siÄ™ tabela ze wszystkimi fakturami:

```
Data       | Nr Faktury | Netto      | Brutto     | Dostawca         | Typ
---------- | ---------- | ---------- | ---------- | --------------- | --------
2026-03-15 | FV/2026/1  | 10 000,00  | 12 300,00  | ABC Construction | SPRZEDAĹ»
2026-03-10 | FA/2026/5  | -5 000,00  | -6 150,00  | Steel Supplier   | KOSZT
                                     ...
=========================================================================
Razem:     | â€”          | 5 000,00   | 6 150,00   | â€”                | â€”
```

DziÄ™ki temu wiesz **dokĹ‚adnie**, dlaczego projekt zarabia lub traci pieniÄ…dze.

---

## đź” 6. DokĹ‚adne Liczby, Bez Zgadywania (Vector 111)

Problem ktĂłry naprawili\u015bmy: System czasem ignorowa\u0142 warto\u015bci r\u00f3wne 0 (bo 0 jest \"falsy\" w JavaScript). Je\u015bli ustawi\u0142e\u015b **0% kaucji**, to czasem pokazywa\u0142 10%! đź›

**Nowe zabezpieczenie (Vector 111 - Retention Rate Integrity)**:
- âś… Firestore zapisuje teraz z `update()` zamiast `.set()` - gwarantuje precyzj\u0119
- âś… Failsafe: ka\u017cda null/undefined warto\u015b\u0107 konwertowana na dok\u0142adnie 0
- âś… Dashboard i lista projekt\u00f3w u\u017cywaj\u0105 tej samej logiki - ZAWSZE si\u0119 zgadzaj\u0105
- âś… **Brak defaultowania do 10%** - respect dla Twoich decyzji

**Rezultat praktyczny**:
```
Nowowiejskiego 2: 0% kaucji â†’ 330 000 zĹ‚ paliwa (100% bud\u017cetu)
Kopaina MARCEL:  10% kaucji â†’ 90 000 zĹ‚ paliwa (90% bud\u017cetu)
```

**\u015bwi\u0119te to co ustawi\u0142e\u015b - system SI\u0118 nie wymyĹ›la domyĹ›ln\u0105ch wartoĹ›ci!**


---

## 🗂️ 7. Przejrzysta Hierarchia Umów (Vector 112)

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

*Dla techników: Szczegółowe zasady budowy znajdują się w [AI_look.md](./docs/AI_look.md).*

**Sig ERP – Twoja firma pod pełną kontrolą.**
