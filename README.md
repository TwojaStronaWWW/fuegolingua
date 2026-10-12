<div align="center">

# 🇪🇸 Fuego Lingua
### Nowoczesna Platforma Wizytówkowa do Nauki Języka Hiszpańskiego Online

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-22%20LTS-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js 22" />
  <img src="https://img.shields.io/badge/Vanilla_JS-ES6+-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="Vanilla JS" />
  <img src="https://img.shields.io/badge/CSS3-Custom_Tokens-1572B6?style=flat-square&logo=css3&logoColor=white" alt="CSS3" />
  <img src="https://img.shields.io/badge/Tests-node:test-success?style=flat-square&logo=node.js&logoColor=white" alt="Tests" />
  <img src="https://img.shields.io/badge/Lighthouse_CI-90+-FF4E42?style=flat-square&logo=lighthouse&logoColor=white" alt="Lighthouse CI" />
  <img src="https://img.shields.io/badge/Cloudflare-DNS%20%7C%20CDN%20%7C%20SSL-F38020?style=flat-square&logo=cloudflare&logoColor=white" alt="Cloudflare" />
  <img src="https://img.shields.io/badge/Security-ISO_27001-blue?style=flat-square" alt="ISO 27001" />
</p>

</div>

---

## 🌟 O Projekcie

**Fuego Lingua** to nowoczesna platforma wizytówkowa dedykowana nauce języka hiszpańskiego (lekcje indywidualne, kursy biznesowe, konwersacje oraz przygotowanie do wyjazdów i branżowych zastosowań).

W architekturze serwisu połączono bezkompromisową lekkość czystego frontendu z inżynierskim rygorem potoków CI/CD standardu **TwojaStronaWWW Enterprise Web Platform**:
- **0 ciężkich bibliotek testowych:** Natywny silnik `node:test` i asercje `node:assert/strict` wbudowane w Node.js 22 (brak Jesta, Mocha, Babela czy Webpacka).
- **Lekki Mock DOM (`tests/helpers/mock-dom.js`):** Umożliwia testowanie interakcji przeglądarkowych bez instalowania 150 MB paczki `jsdom`.
- **Integracja Cloudflare CDN & Purge Cache:** Serwowanie zasobów przez Anycast CDN z krawędzi (Edge HIT) i automatyczne czyszczenie pamięci podręcznej po każdym wdrożeniu SFTP.
- **Wydajność CI/CD poniżej 60 sekund:** Cały potok (składnia JS, walidacja PHP, testy jednostkowe, audyt Lighthouse CI oraz transfer SFTP) zamyka się w kilkadziesiąt sekund.
- **Wczesne wykrywanie błędów (Pre-commit Hook & Commit-msg):** Fizyczna blokada wycieku plików sekretów (`.env`, `secrets.php`, `.htpasswd`) oraz wymuszenie formatu **Conventional Commits**.
- **Bezpieczny Lead Recovery & Honeypot:** Ochrona przed botami, rate-limiting i ciche ratowanie utraconych leadów (PHP Flat-File CRM z `LOCK_EX`).

---

## 📐 Struktura Katalogów

```plaintext
fuegolingua/
├── .github/
│   ├── workflows/
│   │   ├── deploy.yml           # 3-etapowy potok CI/CD Quality Gate (Test -> Audit -> Deploy SFTP + Cloudflare Purge)
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
│   ├── cennik/                  # Grafiki prezentacji poziomów i oferty
│   └── php/
│       ├── contact.php          # Bezpieczny backend formularza (Cloudflare IP, honeypot)
│       └── lead_recovery.php    # Moduł ratowania utraconych leadów
├── docs/
│   └── CLOUDFLARE_STANDARDS.md  # Standard konfiguracji Cloudflare CDN / DNS / Purge Cache
├── scripts/
│   └── serve.js                 # Lekki lokalny serwer developerski HTTP w natywnym Node.js
├── tests/
│   ├── helpers/mock-dom.js      # Lekka, bezbiblioteczna symulacja DOM dla środowiska Node.js
│   └── unit/                    # Natywne testy jednostkowe (node:test)
│       ├── html-integrity.test.js # Testy semantyki HTML5, nagłówków SEO, a11y i linków
│       ├── main.test.js         # Testy interakcji UI i nawigacji
│       ├── contact-flow.test.js # Testy logiki formularza i odzyskiwania leadów
│       └── repo-hygiene.test.js # Testy higieny repozytorium, ISO 27001, hooków i CI/CD
├── .editorconfig                # Konfiguracja standardu formatowania IDE (UTF-8, LF, spacje)
├── .gitattributes               # Wymuszenie normalizacji końców linii LF
├── .gitignore                   # Rygor ISO 27001: wykluczenie sesji, logów i leadów CSV
├── .lighthouserc.json           # Konfiguracja audytu Lighthouse CI (min. 90% a11y, SEO, best-practices)
├── index.html                   # Główna strona Fuego Lingua (nauka hiszpańskiego online)
├── cennik.html                  # Podstrona cennika i wariantów kursów
├── robots.txt                   # Konfiguracja indeksowania SEO (blokada /api/ i /assets/php/)
├── sitemap.xml                  # Mapa witryny dla wyszukiwarek
├── site.webmanifest             # Manifest PWA / przeglądarkowy
├── favicon.ico                  # Ikona witryny
├── package.json                 # Skrypty jakościowe (check, test, test:coverage, check:syntax, serve)
├── LICENSE                      # Prawa autorskie TwojaStronaWWW
├── SECURITY.md                  # Polityka bezpieczeństwa i zgłaszania luk (ISO 27001)
├── README.md                    # Dokumentacja projektu ze statusem odznak
├── ROADMAP.md                   # Rejestr sprintów, wydań i historii optymalizacji
└── BLUEPRINT.md                 # Kompletny podręcznik architektury i procedur
```

---

## 🛠️ Komendy Deweloperskie (`package.json`)

```bash
# 1. Błyskawiczne wykonanie testów jednostkowych (node:test)
npm test

# 2. Pełny Quality Gate (sprawdzenie składni JS + testy jednostkowe)
npm run check

# 3. Raport pokrycia kodu (Code Coverage >= 90%)
npm run test:coverage

# 4. Sprawdzenie poprawności syntaktycznej JavaScript
npm run check:syntax

# 5. Konfiguracja hooków Gita (.githooks)
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
3. **Etap 3: `Wdrożenie produkcyjne SFTP (LH) & Cloudflare Purge Cache`**:
   - Automatyczny transfer na serwer LH do katalogu `/home/platne/serwer417204/public_html/fuegolingua.pl`.
   - Automatyczne wyczyszczenie pamięci podręcznej brzegowej Cloudflare za pośrednictwem API.

---

## 👥 Autor i Licencja

* **Projekt:** [FuegoLingua.pl](https://fuegolingua.pl/)
* **Wdrożenie i Standardy:** [TwojaStronaWWW](https://github.com/TwojaStronaWWW)
* **Architektura & Engineering:** Krzysztof Początek
* **Licencja:** [TwojaStronaWWW Proprietary](LICENSE) (Wszelkie prawa zastrzeżone)
