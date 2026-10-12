# ENTERPRISE WEB PLATFORM BLUEPRINT & RUNBOOK
## Nowoczesny standard inżynieryjny, testów jednostkowych, bezpieczeństwa i CI/CD dla platformy TwojaStronaWWW

Niniejszy dokument stanowi kompletny, ustandaryzowany przewodnik po architekturze serwisów internetowych realizowanych w ekosystemie **TwojaStronaWWW**. Definiuje standardy produkcyjne: natywne testy jednostkowe (`node:test`), audyt Lighthouse CI, ochronę pre-commit hookami, rygor bezpieczeństwa danych ISO 27001 (PHP Flat-File CRM), integrację z Cloudflare oraz 3-etapowy potok wdrożeniowy CI/CD na serwery LH.

---

## SPIS TREŚCI
1. [Filozofia architektury: Platform-First, Zero-Bloat i automatyzacja](#1-filozofia-architektury-platform-first-zero-bloat-i-automatyzacja)
2. [ETAP 1: Standard struktury projektu i komponentów bazowych](#2-etap-1-standard-struktury-projektu-i-komponentów-bazowych)
   - [2.1 Uniwersalna struktura katalogów](#21-uniwersalna-struktura-katalogów)
   - [2.2 Uniwersalny `package.json`](#22-uniwersalny-packagejson)
   - [2.3 Wbudowany silnik testów jednostkowych (`node:test`)](#23-wbudowany-silnik-testów-jednostkowych-nodetest)
   - [2.4 Ochrona pre-commit hook (`.githooks/pre-commit`)](#24-ochrona-pre-commit-hook-githookspre-commit)
   - [2.5 Konfiguracja audytu Lighthouse CI (`.lighthouserc.json`)](#25-konfiguracja-audytu-lighthouse-ci-lighthousercjson)
   - [2.6 Automatyzacja aktualizacji akcji (`.github/dependabot.yml`)](#26-automatyzacja-aktualizacji-akcji-githubdependabotyml)
   - [2.7 Potok wdrożeniowy CI/CD (`.github/workflows/deploy.yml`)](#27-potok-wdrożeniowy-cicd-githubworkflowsdeployyml)
   - [2.8 Standardy SEO i PWA (`robots.txt`, `sitemap.xml`, `site.webmanifest`)](#28-standardy-seo-i-pwa-robotstxt-sitemapxml-sitewebmanifest)
3. [ETAP 2: Procedura wdrożeniowa krok po kroku (Runbook)](#3-etap-2-procedura-wdrożeniowa-krok-po-kroku-runbook)
   - [Krok 1: Utworzenie i inicjalizacja repozytorium](#krok-1-utworzenie-i-inicjalizacja-repozytorium)
   - [Krok 2: Konfiguracja zmiennych środowiskowych i sekretów](#krok-2-konfiguracja-zmiennych-środowiskowych-i-sekretów)
   - [Krok 3: Dostosowanie testu spójności HTML (`html-integrity.test.js`)](#krok-3-dostosowanie-testu-spójności-html-html-integritytestjs)
   - [Krok 4: Pokrycie logiki JavaScript testami UI (`main.test.js`, `contact-flow.test.js`)](#krok-4-pokrycie-logiki-javascript-testami-ui-maintestjs-contact-flowtestjs)
   - [Krok 5: Aktualizacja i publikacja SEO (`robots.txt`, `sitemap.xml`)](#krok-5-aktualizacja-i-publikacja-seo-robotstxt-sitemapxml)
   - [Krok 6: (Opcjonalnie) Generator PDF dla ofert, cenników lub portfolio](#krok-6-opcjonalnie-generator-pdf-dla-ofert-cenników-lub-portfolio)
   - [Krok 7: Lokalna weryfikacja i pre-commit](#krok-7-lokalna-weryfikacja-i-pre-commit)
   - [Krok 8: Wypchnięcie kodu na Staging i Production](#krok-8-wypchnięcie-kodu-na-staging-i-production)
   - [Krok 9: Bezpieczny moduł pozyskiwania leadów i formularza kontaktowego (PHP Flat-File CRM)](#krok-9-bezpieczny-moduł-pozyskiwania-leadów-i-formularza-kontaktowego-php-flat-file-crm)
   - [Krok 10: Standard konfiguracji Cloudflare & automatyczny Purge Cache (CDN / DNS)](#krok-10-standard-konfiguracji-cloudflare--automatyczny-purge-cache-cdn--dns)

---

## 1. Filozofia architektury: Platform-First, Zero-Bloat i automatyzacja

Tradycyjne projekty frontendowe często cierpią na tzw. *dependency bloat* – instalację setek megabajtów paczek w `node_modules` (Jest, Babel, Webpack, ESLint, Puppeteer), co spowalnia pipeline i stwarza podatności bezpieczeństwa.

W architekturze TwojaStronaWWW przyjęto model Platform-First:
- **0 ciężkich bibliotek testowych:** Natywny silnik `node:test` i asercje `node:assert/strict` wbudowane w Node.js (od wersji 18+).
- **Lekki Mock DOM:** Zamiast pamięciożernego `jsdom` (wymagającego dziesiątek podzależności), stosujemy minimalistyczny, 80-linijkowy `mock-dom.js`.
- **Wydajność CI/CD:** Cały proces (testy jednostkowe, audyt a11y/SEO i wdrożenie SFTP) zamyka się w **poniżej 60 sekund**.
- **Wczesne wykrywanie błędów:** Lokalny pre-commit hook uniemożliwia zatwierdzenie commita z uszkodzonym HTML-em lub wyciekiem pliku `.env`.

---

## 2. ETAP 1: Standard struktury projektu i komponentów bazowych

W każdym repozytorium platformy wdrożony jest spójny ekosystem narzędziowy.

### 2.1 Uniwersalna struktura katalogów

```plaintext
projekt/
├── .github/
│   ├── dependabot.yml              # Automatyczne aktualizacje akcji
│   ├── pull_request_template.md    # Quality gate checklist dla PR
│   └── workflows/
│       ├── ci.yml                  # Testy jednostkowe + walidacja składni + PR check
│       └── deploy.yml              # 3-etapowy potok CI/CD (Test -> Audit -> SFTP + Purge Cache)
├── .githooks/
│   ├── pre-commit                  # Lokalny strażnik jakości (uruchamia npm run check)
│   └── commit-msg                  # Wymuszenie formatu Conventional Commits
├── api/
│   ├── rate_limits/                # Pamięć liczników IP rate-limitera (.htaccess: Deny from all)
│   └── sessions/                   # Bezpieczny magazyn sesji PHP (.htaccess: Deny from all)
├── assets/
│   ├── css/
│   │   ├── style.css               # Style bazowe (reset, zmienne CSS, typografia, layout)
│   │   └── media.css               # Responsywność RWD
│   ├── js/
│   │   ├── main.js                 # Logika interfejsu użytkownika (UI, a11y, nawigacja)
│   │   ├── contact.js              # Obsługa formularza, ochrona antyspamowa, lead recovery
│   │   └── script.js               # Punkt wejścia / kompatybilność
│   └── images/                     # Zoptymalizowane zasoby graficzne
├── docs/
│   └── CLOUDFLARE_STANDARDS.md     # Standard konfiguracji Cloudflare CDN / DNS
├── scripts/
│   └── serve.js                    # Lokalny serwer developerski w czystym Node.js
├── tests/
│   ├── helpers/
│   │   └── mock-dom.js             # Lekkie środowisko przeglądarki w czystym Node.js
│   └── unit/
│       ├── html-integrity.test.js  # Weryfikacja struktury HTML5, linków i standardów WCAG
│       ├── main.test.js            # Testy interakcji UI i nawigacji
│       ├── contact-flow.test.js    # Testy walidacji formularza i ratowania leadów
│       └── repo-hygiene.test.js    # Testy rygoru repozytorium, ISO 27001 i CI/CD
├── .gitignore                      # Ignorowanie sesji, logów, CSV i sekretów (ISO 27001)
├── .gitattributes                  # Normalizacja końców linii LF
├── .lighthouserc.json              # Konfiguracja audytu Lighthouse CI (min. 90% a11y, SEO, BP)
├── index.html                      # Semantyczny szkielet HTML5
├── robots.txt                      # Konfiguracja indeksowania botów wyszukiwarek
├── sitemap.xml                     # Mapa witryny
├── site.webmanifest                # Manifest PWA
├── package.json                    # Konfiguracja skryptów npm (bez zbędnych zależności)
└── README.md                       # Dokumentacja projektu i status odznak
```

---

## 3. ETAP 2: Procedura wdrożeniowa krok po kroku (Runbook)

Procedura krok po kroku dla tworzenia nowego projektu lub standaryzacji istniejącej witryny.

### Krok 1: Utworzenie i inicjalizacja repozytorium
1. Zainicjalizuj repozytorium na GitHubie w organizacji `TwojaStronaWWW`.
2. Sklonuj repozytorium na dysk lokalny:
   ```bash
   git clone https://github.com/TwojaStronaWWW/twoj-nowy-projekt.git
   cd twoj-nowy-projekt
   ```
3. Aktywuj lokalne hooki git:
   ```bash
   git config core.hooksPath .githooks
   ```

---

### Krok 2: Konfiguracja zmiennych środowiskowych i sekretów
W ustawieniach repozytorium na GitHubie (`Settings` -> `Secrets and variables` -> `Actions`):

1. **Repository Secrets:**
   - `FTP_SERVER`: adres serwera hostingowego (np. `serwer417204.lh.pl`)
   - `FTP_USERNAME`: login konta SFTP/FTP
   - `FTP_PASSWORD`: bezpieczne hasło do konta
   - `FTP_PORT`: `22` (dla SFTP) lub `21` (dla FTP)
   - `CLOUDFLARE_ZONE`: identyfikator strefy domeny w Cloudflare
   - `CLOUDFLARE_TOKEN`: API Token z uprawnieniem `Zone.Cache Purge`
2. **Repository Variables:**
   - `PRODUCTION_PATH`: podkatalog serwera produkcyjnego (np. `/home/platne/serwer417204/public_html/twojadomena.pl`)
   - `STAGING_PATH`: podkatalog serwera testowego (np. `/home/platne/serwer417204/public_html/dev.twojadomena.pl`)

---

### Krok 3: Dostosowanie testu spójności HTML (`html-integrity.test.js`)
Gdy strona posiada docelową zawartość w plikach HTML (`index.html`, podstrony):
1. Otwórz `tests/unit/html-integrity.test.js`.
2. Dostosuj asercje do specyfiki witryny (poprawne nagłówki H1, atrybuty `alt`, unikalne `id`, dostępność a11y, spójność linków wewnętrznych).

---

### Krok 4: Pokrycie logiki JavaScript testami UI (`main.test.js`, `contact-flow.test.js`)
Dla każdego modułu JavaScript w `assets/js/`:
1. Zdefiniuj testy jednostkowe w `tests/unit/`.
2. Zainicjalizuj środowisko symulujące DOM za pomocą pomocnika `tests/helpers/mock-dom.js`.
3. Przetestuj zdarzenia kliknięć, nawigację mobilną, dostępność (klawisz Escape, atrybuty `aria-expanded`) oraz walidację formularzy.

---

### Krok 5: Aktualizacja i publikacja SEO (`robots.txt`, `sitemap.xml`)
1. **W `robots.txt`:** Ustaw właściwy adres domeny produkcyjnej dla mapy witryny oraz upewnij się, że katalogi prywatne (`/api/`) są zablokowane dla botów.
2. **W `sitemap.xml`:** Podmień adresy URL `<loc>` na domenę docelową i zaktualizuj datę `<lastmod>`.
3. **W `site.webmanifest`:** Ustaw nazwę serwisu, kolory motywu i ikony PWA.

---

### Krok 6: (Opcjonalnie) Generator PDF dla ofert, cenników lub portfolio
Jeśli projekt wymaga generowania dokumentów PDF (np. oferta, specyfikacja, cennik):
- Zaimplementuj lekki moduł oparty na bezgłowej przeglądarce Chromium (Chromium Headless / Puppeteer Core).
- Generuj wektorowy plik PDF A4 bezpośrednio z dedykowanego widoku HTML/CSS zoptymalizowanego pod `@media print`.

---

### Krok 7: Lokalna weryfikacja i pre-commit
Przed wysłaniem zmian na serwer uruchom pełną weryfikację jakościową:
```bash
npm run check
```
Hook `.githooks/pre-commit` automatycznie zweryfikuje składnię JS, zgodność PHP, testy jednostkowe oraz brak plików wrażliwych. Zatwierdź commit w formacie Conventional Commits:
```bash
git add .
git commit -m "feat(seo): skonfigurowanie metadanych i sitemap dla domeny produkcyjnej"
```

---

### Krok 8: Wypchnięcie kodu na Staging i Production
1. **Staging / PR:** Wypchnij branch roboczy lub gałąź `staging`. Potok `.github/workflows/ci.yml` zweryfikuje jakość kodu.
2. **Produkcja:** Po scaleniu do gałęzi `main`, potok `.github/workflows/deploy.yml` automatycznie:
   - Zrealizuje testy jednostkowe i audyt Lighthouse CI,
   - Prześle zmienione pliki przez SFTP na serwer LH,
   - Wykona natychmiastowe czyszczenie pamięci podręcznej Cloudflare (Purge Cache API).

---

### Krok 9: Bezpieczny moduł pozyskiwania leadów i formularza kontaktowego (PHP Flat-File CRM)
Dla serwisów firmowych wymagających obsługi formularza kontaktowego bez konieczności wdrażania bazy danych:
1. **Architektura Flat-File CSV:**
   - Eliminacja ryzyka SQL Injection dzięki zapisowi do plików CSV.
   - Atomowy zapis z blokadą wyłączną `LOCK_EX` (`flock($fp, LOCK_EX)`), gwarantujący integralność danych przy równoległych żądaniach.
2. **Ochrona transakcyjna CSRF i nagłówków:**
   - Generowanie jednorazowego tokenu CSRF (`api/get-csrf-token.php`) powiązanego z sesją PHP.
   - Restrykcyjna weryfikacja nagłówka `Origin` lub `Referer` w endpointach API.
3. **Mitygacja spamu i botów:**
   - Ukryte pole-pułapka Honeypot (niewidoczne dla użytkowników, natychmiastowe odrzucenie wypełnień automatów).
   - Rate-limiter IP oparty na plikach liczników w `api/rate_limits/`.
4. **Zgodność z ISO 27001 (Zero Data Leakage):**
   - W plikach `.htaccess` w katalogach `api/sessions/` oraz `api/rate_limits/` bezwzględna reguła `Deny from all`.
   - W pliku `.gitignore` reguły wykluczające: `api/sessions/*`, `api/rate_limits/*.json`, `api/leads_*.csv` oraz `*.log`.

---

### Krok 10: Standard konfiguracji Cloudflare & automatyczny Purge Cache (CDN / DNS)
Dla witryn korzystających z ochrony i przyspieszania Cloudflare CDN/Proxy:
1. **Wzorzec parametrów DNS i SSL/TLS:**
   - Pełna specyfikacja parametrów znajduje się w dedykowanym dokumencie: [`docs/CLOUDFLARE_STANDARDS.md`](docs/CLOUDFLARE_STANDARDS.md).
   - SSL/TLS Encryption Mode: **Full** (lub Full Strict) — zakaz Flexible.
   - Always Use HTTPS: **ON**, Min TLS Version: **1.2**, TLS 1.3: **ON**, HTTP/3 (QUIC): **ON**.
   - Speed Brain: **ON**, Rocket Loader: **OFF** (dla maksymalnej stabilności czystego Vanilla JS).
2. **Automatyczny Purge Cache w CI/CD:**
   - Dodaj w GitHub Secrets: `CLOUDFLARE_ZONE` oraz `CLOUDFLARE_TOKEN`.
   - Potok `deploy.yml` automatycznie odświeży pamięć podręczną krawędzi Cloudflare zaraz po pomyślnym transferze SFTP na hosting.
3. **Prawidłowy odczyt IP w PHP:**
   - Odczytuj prawdziwe IP użytkownika za pośrednictwem nagłówka Cloudflare:
     ```php
     $clientIp = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'];
     ```

---
*Dokumentacja inżynieryjna platformy TwojaStronaWWW.*
