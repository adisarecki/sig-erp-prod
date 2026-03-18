# CRM – Zarządzanie Kontrahentami

## Cel Modułu

Moduł CRM jest centralną bazą firm współpracujących z SIG ERP. Każdy kontrahent powiązany jest z projektami, fakturami i transakcjami finansowymi. System rozróżnia dwa statusy: `ACTIVE` (standardowy klient) oraz `IN_REVIEW` (wstrzymana współpraca).

## Budowanie Bazy Kontaktów

### Ścieżka 1 – Ręczne Dodawanie

Przycisk **"Dodaj Kontrahenta"** (niebieski) otwiera formularz z polami:
- Nazwa, NIP, Adres, Status, Rating kredytowy
- Opcjonalne osoby kontaktowe

### Ścieżka 2 – Import z Historii Bankowej (Zalecana)

> [!TIP]
> Najszybszy sposób budowania bazy CRM to import z pliku bankowego. System automatycznie wykrywa nazwy firm, NIP-y i adresy z wyciągu PKO BP.

Przycisk **"Importuj z Banku (XML/CSV)"** (outline) otwiera moduł **Poczekalnia Importu**, obsługujący:

| Format | Standard | Kodowanie | Zalety |
|---|---|---|---|
| **XML** | ISO 20022 camt.053 | UTF-8 | Sterylny, strukturyzowany, bez regexów |
| **CSV** | PKO BP Historia | Windows-1250 | Kompatybilny ze starym eksportem |

#### Przepływ importu z CRM:
1. Kliknij **"Importuj z Banku (XML/CSV)"** w widoku Kontrahenci
2. Wgraj plik XML lub CSV z PKO BP
3. System wyświetla "Poczekalnię" – listę wykrytych firm z NIP-em i adresem
4. Zaznacz firmy do importu → kliknij **"Importuj Wybrane"**
5. System automatycznie **wraca do listy Kontrahentów** – efekty widoczne natychmiast

> [!NOTE]
> Import z CRM używa identycznego parsera co import z zakładki Finanse (`/finance/import`). Różnica to tylko ścieżka powrotu – po zakończeniu importu z CRM system przekierowuje z powrotem do `/crm` zamiast `/finance`.

### Filtracja Śmieci

Parser automatycznie pomija transakcje nieistotne dla CRM:
- Wypłaty z bankomatu
- Przelewy wewnętrzne / własne
- Płatności BLIK
- Zakupy kartą
- Prowizje bankowe

### Deduplikacja

Import nie tworzy duplikatów – jeśli kontrahent o tym samym NIP lub dokładnej nazwie już istnieje w bazie, rekord jest pomijany (`skipped`).

## Indeksowanie i Wydajność

- `@@index([tenantId])` – izolacja danych per firma
- Wyszukiwanie po nazwie, NIP, statusie
- Merge duplikatów dostępny z `FloatingActionBar` (zaznacz kontrahentów → Scal)
