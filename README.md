<div align="center">

# 🇪🇸 Fuego Lingua
### *Hiszpański z Pasją — Nauka Języka Hiszpańskiego Online*

[![CI & Quality Gate](https://github.com/TwojaStronaWWW/fuegolingua/actions/workflows/deploy.yml/badge.svg)](https://github.com/TwojaStronaWWW/fuegolingua/actions/workflows/deploy.yml)
[![Lighthouse 90+](https://img.shields.io/badge/Lighthouse-90%2B-success?style=flat-square&logo=googlechrome)](https://github.com/TwojaStronaWWW/fuegolingua)
[![Security ISO 27001](https://img.shields.io/badge/Security-ISO%2027001%20Compliant-blue?style=flat-square&logo=shield)](https://github.com/TwojaStronaWWW/fuegolingua)
[![Runtime](https://img.shields.io/badge/Node.js-22%20LTS-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Vanilla Architecture](https://img.shields.io/badge/Architecture-Vanilla%20ES6%2B%20%2F%20Zero--Bloat-orange?style=flat-square)](https://github.com/TwojaStronaWWW/fuegolingua)

<p align="center">
  Oficjalny serwis internetowy szkoły języka hiszpańskiego online <b>Fuego Lingua</b>.<br>
  Zbudowany w oparciu o wzorcowy standard inżynieryjny <b>TwojaStronaWWW</b>: zero ciężkich frameworków, natywne testy jednostkowe, potok CI/CD poniżej 60s i pełne bezpieczeństwo ISO 27001.
</p>

</div>

---

## 🌟 O Projekcie

**Fuego Lingua** to nowoczesna platforma wizytówkowa dedykowana nauce języka hiszpańskiego (lekcje indywidualne, kursy biznesowe, konwersacje oraz przygotowanie do wyjazdów i branżowych zastosowań).

W architekturze serwisu połączono bezkompromisową lekkość czystego frontendu z inżynierskim rygorem potoków CI/CD standardu **TwojaStronaWWW Enterprise Web Platform**:
- **0 ciężkich bibliotek testowych:** Natywny silnik `node:test` i asercje `node:assert/strict` wbudowane w Node.js 22 (brak Jesta, Mocha, Babela czy Webpacka).
- **Lekki Mock DOM (`tests/helpers/mock-dom.js`):** Umożliwia testowanie interakcji przeglądarkowych bez instalowania 150 MB paczki `jsdom`.
- **Wydajność CI/CD poniżej 60 sekund:** Cały potok (składnia JS, walidacja PHP, testy jednostkowe, audyt Lighthouse CI oraz transfer SFTP) zamyka się w kilkadziesiąt sekund.
- **Wczesne wykrywanie błędów (Pre-commit Hook & Commit-msg):** Fizyczna blokada wycieku plików sekretów (`.env`, `secrets.php`, `.htpasswd`) oraz wymuszenie formatu **Conventional Commits**.
- **Bezpieczny Lead Recovery & Honeypot:** Ochrona przed botami i ciche ratowanie utraconych leadów.

---

## 📐 Struktura Katalogów

```plaintext
fuegolingua/
├── .github/
│   ├── workflows/
│   │   ├── deploy.yml           # 3-etapowy potok CI/CD Quality Gate (Test -> Audit -> Deploy SFTP)
│   │   └── ci.yml               # Potok walidacji PR i gałęzi staging
│   ├── ISSUE_TEMPLATE/          # Ustandaryzowane szablony zgłoszeń błędów i zadań
│   ├── pull_request_template.md # Checklista jakościowa Quality Gate dla PR
│   └── dependabot.yml           # Automatyczny nadzór nad wersjami GitHub Actions i npm
├── .githooks/
│   ├── pre-commit               # Git hook uruchamiający npm run check przed commitem
│   └── commit-msg               # Git hook wymuszający format Conventional Commits
├── api/
│   ├── rate_limits/             # Pamięć liczników IP rate-limitera (.htaccess: Deny from all)
│   └── sessions/                # Bezpieczny magazyn sesji PHP (.htaccess: Deny from all)
├── assets/
│   ├── css/
│   │   ├── style.css            # Główny arkusz stylów, layout, typografia, komponenty
│   │   ├── media.css            # Responsywność (Media Queries RWD)
│   │   └── cennik.css           # Dedykowane style strony cennika
│   ├── js/
│   │   ├── main.js              # Vanilla ES6 UI: nawigacja mobilna, a11y, zakładki cennika, animacje
│   │   ├── contact.js           # Formularz kontaktowy, walidacja, ochrona honeypot, lead recovery
│   │   └── script.js            # Wejście główne (kompatybilność wsteczna)
│   ├── images/                  # Grafiki brandingowe i zdjęcia
│   └── cennik/                  # Grafiki prezentacji poziomów i oferty
├── scripts/
│   └── serve.js                 # Lekki lokalny serwer developerski HTTP w natywnym Node.js
├── tests/
│   ├── helpers/mock-dom.js      # Lekka, bezbiblioteczna symulacja DOM dla środowiska Node.js
│   └── unit/                    # Natywne testy jednostkowe (node:test)
│       ├── html-integrity.test.js # Testy semantyki HTML5, nagłówków SEO, a11y i linków
│       ├── main.test.js         # Testy interakcji UI i nawigacji
│       ├── contact-flow.test.js # Testy logiki formularza i odzyskiwania leadów
│       └── repo-hygiene.test.js # Testy higieny repozytorium, ISO 27001, hooków i CI/CD
├── index.html                   # Główna strona Fuego Lingua (nauka hiszpańskiego online)
├── cennik.html                  # Podstrona cennika i wariantów kursów
├── robots.txt                   # Konfiguracja indeksowania SEO (blokada /api/ i /assets/php/)
├── sitemap.xml                  # Mapa witryny dla wyszukiwarek
├── site.webmanifest             # Manifest PWA / przeglądarkowy
├── package.json                 # Skrypty jakościowe (check, test, test:coverage, check:syntax, serve)
├── .lighthouserc.json           # Konfiguracja audytu Lighthouse CI (min. 90% a11y, SEO, best-practices)
├── .gitattributes               # Wymuszenie normalizacji końców linii LF
├── .gitignore                   # Rygor ISO 27001: wykluczenie sesji, logów i danych klientów CSV
├── README.md                    # Dokumentacja projektu ze statusem odznak (Badges)
├── ROADMAP.md                   # Rejestr sprintów, wydań i historii optymalizacji
└── BLUEPRINT.md                 # Kompletny podręcznik architektury i procedur
```

---

## 🧪 Brama Jakości & Testy Jednostkowe (Quality Gate)

Projekt posiada zestaw testów jednostkowych wykonywanych w czasie **< 150 ms** w natywnym module `node:test`:

| Plik testowy | Zakres Weryfikacji |
| :--- | :--- |
| `tests/unit/html-integrity.test.js` | DOCTYPE, atrybut `lang="pl"`, UTF-8, meta viewport, title, description, single `<h1>`, Schema.org, canonical. |
| `tests/unit/main.test.js` | Moduł nawigacji, przełączanie menu mobilnego, zamykanie klawiszem `Escape`, focus trap, obsługa zakładek cennika. |
| `tests/unit/contact-flow.test.js` | Formularz kontaktowy, ochrona honeypot przed botami, blokada double-submit, timer Lead Recovery. |
| `tests/unit/repo-hygiene.test.js` | Standardy ISO 27001, brak konfliktów gita, hooki, `.gitattributes`, manifest PWA, potok CI/CD. |

### Dostępne Komendy npm (`package.json`):

```bash
# 1. Błyskawiczne wykonanie testów jednostkowych
npm test

# 2. Pełny Quality Gate (sprawdzenie składni JS + testy jednostkowe)
npm run check

# 3. Raport pokrycia kodu (Code Coverage)
npm run test:coverage

# 4. Sprawdzenie poprawności składniowej JavaScript
npm run check:syntax

# 5. Automatyczna konfiguracja hooków Gita (.githooks)
npm run prepare

# 6. Lokalny serwer developerski HTTP (zero-dependency)
npm run serve
```

---

## 🚀 Trójstopniowy Pipeline CI/CD (GitHub Actions)

Plik `.github/workflows/deploy.yml` definiuje pełną automatyzację:
1. **Etap 1: `Quality Gate & Testy Jednostkowe`**:
   - Walidacja obecności `index.html`.
   - Blokada wycieków sekretów i danych klientów CSV.
   - Walidacja składni plików PHP (`php -l`).
   - Sprawdzenie syntaktyczne JS (`npm run check:syntax`).
   - Wykonanie testów jednostkowych (`npm run test:coverage`).
2. **Etap 2: `Audyt Lighthouse CI`**:
   - Uruchomienie `treosh/lighthouse-ci-action@v12` z progami min. 90% w SEO, a11y i Best Practices.
3. **Etap 3: `Wdrożenie produkcyjne SFTP (LH)`**:
   - Automatyczny transfer na serwer LH do katalogu `/home/platne/serwer417204/public_html/fuegolingua.pl`.

---

## 📄 Licencja & Autor

* **Projekt:** [FuegoLingua.pl](https://fuegolingua.pl/)
* **Organizacja:** [TwojaStronaWWW](https://github.com/TwojaStronaWWW)
* **Standard Architektury:** TwojaStronaWWW Web Template Platform
