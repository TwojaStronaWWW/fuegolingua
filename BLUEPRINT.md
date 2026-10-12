# ENTERPRISE WEB TEMPLATE BLUEPRINT & RUNBOOK
## Nowoczesny standard jakości, testów jednostkowych i CI/CD dla projektów TwojaStronaWWW

Niniejszy dokument stanowi kompletny przewodnik po architekturze szablonu **`_site-template`**. Łączy sprawdzone wzorce produkcyjne wdrożone w **`Moje-CV`** (testy jednostkowe bez zewnętrznych bibliotek, audyt Lighthouse CI, ochrona pre-commit, SEO) z dotychczasową infrastrukturą wdrożeniową TwojaStronaWWW (podział Staging/Production na serwerze LH, automatyczne wersjonowanie i tagowanie wydań).

---

## SPIS TREŚCI
1. [Usunięcie repozytorium dancePulse](#1-usunięcie-repozytorium-dancepulse)
2. [Filozofia szablonu: Lekkość, zero zbędnych zależności i automatyzacja](#2-filozofia-szablonu)
3. [ETAP 1: Co wdrożyć w `_site-template` JUŻ TERAZ (przed powstaniem strony)](#3-etap-1-co-wdrożyć-w-_site-template-już-teraz)
   - [3.1 Struktura katalogów szablonu](#31-struktura-katalogów-szablonu)
   - [3.2 Uniwersalny `package.json`](#32-uniwersalny-packagejson)
   - [3.3 Wbudowany silnik testów jednostkowych (`node:test`)](#33-wbudowany-silnik-testów-jednostkowych-nodetest)
   - [3.4 Ochrona pre-commit hook (`.githooks/pre-commit`)](#34-ochrona-pre-commit-hook-githookspre-commit)
   - [3.5 Konfiguracja audytu Lighthouse CI (`.lighthouserc.json`)](#35-konfiguracja-audytu-lighthouse-ci-lighthousercjson)
   - [3.6 Automatyzacja aktualizacji akcji (`.github/dependabot.yml`)](#36-automatyzacja-aktualizacji-akcji-githubdependabotyml)
   - [3.7 Nowoczesny potok `.github/workflows/ci.yml`](#37-nowoczesny-potok-githubworkflowsciyml)
   - [3.8 Szablony bazowe SEO (`robots.txt`, `sitemap.xml`)](#38-szablony-bazowe-seo-robotstxt-sitemapxml)
4. [ETAP 2: Procedura krok po kroku (Runbook) – gdy strona jest już gotowa](#4-etap-2-procedura-krok-po-kroku-runbook)
   - [Krok 1: Utworzenie projektu z szablonu](#krok-1-utworzenie-projektu-z-szablonu)
   - [Krok 2: Konfiguracja zmiennych środowiskowych i sekretów](#krok-2-konfiguracja-zmiennych-środowiskowych-i-sekretów)
   - [Krok 3: Dostosowanie testu spójności HTML (`html-integrity.test.js`)](#krok-3-dostosowanie-testu-spójności-html-html-integritytestjs)
   - [Krok 4: Pokrycie logiki JavaScript testami UI (`main.test.js`)](#krok-4-pokrycie-logiki-javascript-testami-ui-maintestjs)
   - [Krok 5: Aktualizacja i publikacja SEO (`robots.txt`, `sitemap.xml`)](#krok-5-aktualizacja-i-publikacja-seo-robotstxt-sitemapxml)
   - [Krok 6: (Opcjonalnie) Generator PDF dla ofert, cenników lub portfolio](#krok-6-opcjonalnie-generator-pdf-dla-ofert-cenników-lub-portfolio)
   - [Krok 7: Lokalna weryfikacja i pre-commit](#krok-7-lokalna-weryfikacja-i-pre-commit)
   - [Krok 8: Wypchnięcie kodu na Staging i Production](#krok-8-wypchnięcie-kodu-na-staging-i-production)

---

## 1. Usunięcie repozytorium dancePulse

Repozytorium `TwojaStronaWWW/dancePulse` zostało wcześniej pomyślnie przestawione na **Prywatne (Private)**, dzięki czemu nie jest widoczne publicznie. 

Aby skasować je **całkowicie i bezpowrotnie**, masz dwie możliwości:

### Sposób A: Bezpośrednio w przeglądarce (Zalecany – 10 sekund)
1. Otwórz stronę ustawień repozytorium:
   👉 **[https://github.com/TwojaStronaWWW/dancePulse/settings](https://github.com/TwojaStronaWWW/dancePulse/settings)**
2. Zjedź na sam dół do czerwonej sekcji **Danger Zone**.
3. Kliknij przycisk **Delete this repository**.
4. Wpisz wymaganą nazwę potwierdzającą (`TwojaStronaWWW/dancePulse`) i kliknij zatwierdzenie.

### Sposób B: Przez terminal GitHub CLI (`gh`)
Domyślny token CLI celowo nie posiada niebezpiecznego uprawnienia usuwania repozytoriów (`delete_repo`). Aby nadać uprawnienie i usunąć repozytorium z terminala:
```bash
# 1. Nadanie uprawnienia delete_repo (otworzy się logowanie w przeglądarce)
gh auth refresh -h github.com -s delete_repo

# 2. Usunięcie repozytorium
gh repo delete TwojaStronaWWW/dancePulse --yes
```

---

## 2. Filozofia szablonu

Tradycyjne projekty frontendowe często cierpią na tzw. *dependency bloat* – instalację dziesiątek gigabajtów paczek w `node_modules` (Jest, Babel, Webpack, ESLint, Puppeteer), co spowalnia pipeline i stwarza podatności bezpieczeństwa.

W architekturze wypracowanej w **Moje-CV**:
- **0 ciężkich bibliotek testowych:** Używamy natywnego silnika `node:test` i asercji `node:assert/strict` wbudowanych w Node.js (od wersji 18+).
- **Lekki Mock DOM:** Zamiast pamięciożernego `jsdom` (wymagającego dziesiątek podzależności), stosujemy minimalistyczny, 80-linijkowy `mock-dom.js`.
- **Wydajność CI/CD:** Cały proces (testy, budowa, audyt a11y/SEO i wdrożenie SFTP) zamyka się w **poniżej 60 sekund**.
- **Wczesne wykrywanie błędów:** Lokalny pre-commit hook uniemożliwia zatwierdzenie commita z uszkodzonym HTML-em lub wyciekiem pliku `.env`.

---

## 3. ETAP 1: Co wdrożyć w `_site-template` JUŻ TERAZ

Nawet jeśli projekt nie ma jeszcze ani jednej linijki docelowego HTML-a czy CSS-a, w repozytorium szablonu warto mieć gotowy cały ekosystem.

### 3.1 Struktura katalogów szablonu

```plaintext
_site-template/
├── .github/
│   ├── dependabot.yml              # Automatyczne aktualizacje akcji
│   └── workflows/
│       ├── ci.yml                  # Testy jednostkowe + walidacja PHP + Lighthouse
│       ├── deploy-staging.yml      # Wdrożenie na serwer testowy LH
│       └── deploy-production.yml   # Wdrożenie na serwer produkcyjny + git tag
├── .githooks/
│   └── pre-commit                  # Lokalny strażnik jakości (uruchamia npm test)
├── assets/
│   ├── css/
│   │   └── main.css                # Style bazowe (reset, zmienne CSS, typografia)
│   ├── js/
│   │   └── main.js                 # Skrypt główny (np. obsługa menu, motywu)
│   └── img/
├── tests/
│   ├── helpers/
│   │   └── mock-dom.js             # Lekkie środowisko przeglądarki w czystym Node.js
│   └── unit/
│       ├── html-integrity.test.js  # Weryfikacja struktury HTML5 i standardów WCAG
│       └── main.test.js            # Uniwersalne testy interakcji UI
├── .gitignore                      # Ignorowanie node_modules, .env, coverage
├── .lighthouserc.json              # Konfiguracja audytu Lighthouse CI
├── index.html                      # Pusty szkielet semantyczny HTML5
├── package.json                    # Konfiguracja skryptów npm (bez frameworków)
├── robots.txt                      # Szablon indeksowania dla botów
├── sitemap.xml                     # Szablon mapy witryny
└── README.md                       # Dokumentacja projektu i checklista wdrożeniowa
```

---

## 4. ETAP 2: Procedura krok po kroku (Runbook) – gdy strona jest już gotowa

Gdy tworzysz nowy serwis z szablonu `_site-template` lub gdy zakończono etap kodowania widoków, wykonaj poniższe kroki.

### Krok 1: Utworzenie projektu z szablonu
1. Na GitHubie wejdź w `TwojaStronaWWW/_site-template` i kliknij zielony przycisk **"Use this template"** -> **"Create a new repository"**.
2. Sklonuj nowe repozytorium na dysk:
   ```bash
   git clone https://github.com/TwojaStronaWWW/twoj-nowy-projekt.git
   cd twoj-nowy-projekt
   ```
3. Aktywuj lokalny pre-commit hook:
   ```bash
   git config core.hooksPath .githooks
   ```

---

### Krok 2: Konfiguracja zmiennych środowiskowych i sekretów
W ustawieniach nowego repozytorium na GitHubie (`Settings` -> `Secrets and variables` -> `Actions`):

1. **Repository Secrets:**
   - `FTP_SERVER`: np. `serwer417204.lh.pl`
   - `FTP_USERNAME`: login konta SFTP/FTP
   - `FTP_PASSWORD`: hasło do konta
   - `FTP_PORT`: `22` (dla SFTP) lub `21` (dla FTP)
2. **Repository Variables:**
   - `STAGING_PATH`: podkatalog serwera testowego (np. `dev.twojadomena.pl`)
   - `PRODUCTION_PATH`: podkatalog serwera produkcyjnego (np. `twojadomena.pl`)

---

### Krok 3: Dostosowanie testu spójności HTML (`html-integrity.test.js`)
Gdy strona ma gotową zawartość w `index.html`:
1. Otwórz `tests/unit/html-integrity.test.js`.
2. Dodaj specyficzne asercje dla Twojej witryny.

---

### Krok 4: Pokrycie logiki JavaScript testami UI (`main.test.js`)
Dla każdego modułu JavaScript w `assets/js/`:
1. Utwórz lub zaktualizuj plik `tests/unit/main.test.js`.
2. Zainicjalizuj środowisko za pomocą `setupMockDom()`.

---

### Krok 5: Aktualizacja i publikacja SEO (`robots.txt`, `sitemap.xml`)
1. **W `robots.txt`:** Podmień `twojadomena.pl` na właściwą domenę klienta.
2. **W `sitemap.xml`:** Podmień adresy URL `<loc>` i zaktualizuj datę w `<lastmod>`.

---

### Krok 6: (Opcjonalnie) Generator PDF dla ofert, cenników lub portfolio
Jeśli projekt wymaga eksportu widoku do PDF: skopiuj generator Chromium Headless z `Moje-CV`.

---

### Krok 7: Lokalna weryfikacja i pre-commit
```bash
npm run test:coverage
git add .
git commit -m "feat: Implementation of site views and SEO configuration"
```

---

### Krok 8: Wypchnięcie kodu na Staging i Production
1. **Staging:** `git push origin staging`
2. **Produkcja:** `git push origin main`


---

### Krok 9: (Opcjonalnie) Bezpieczny moduł pozyskiwania leadów i formularza kontaktowego (PHP Flat-File CRM)
Dla serwisów firmowych wymagających obsługi formularza kontaktowego bez relacyjnej bazy danych (jak w `twojastronawww`):
1. **Architektura bezbazy danych (Flat-File CSV):**
   - Eliminacja podatności na ataki SQL Injection dzięki zapisowi do plików CSV.
   - Atomowy zapis z blokadą wyłączną `LOCK_EX` (`flock($fp, LOCK_EX)`), zapobiegający uszkodzeniu pliku przy współbieżnych zgłoszeniach.
2. **Ochrona transakcyjna CSRF i nagłówków:**
   - Wydawanie jednorazowego tokenu CSRF (`api/get-csrf-token.php`) przypisanego do sesji.
   - Weryfikacja nagłówka `Origin` lub `Referer` w `api/contact.php`.
3. **Mitygacja spamu i botów:**
   - Pole-pułapka Honeypot (ukryte dla użytkowników CSS-em, natychmiastowe odrzucenie wypełnionych formularzy botów).
   - Rate-limiter IP oparty na plikach liczników w `api/rate_limits/`.
4. **Zgodność z ISO 27001 (Zero Data Leakage):**
   - W `.htaccess` w katalogach `api/sessions/` oraz `api/rate_limits/` bezwzględna reguła `Deny from all`.
   - W `.gitignore` reguły: `api/sessions/*`, `api/rate_limits/*.json`, `api/leads_*.csv` oraz `*.log`.

---

### Krok 10: Standard konfiguracji Cloudflare & automatyczny Purge Cache (CDN / DNS)
Dla wszystkich witryn publikowanych w ekosystemie TwojaStronaWWW korzystających z Cloudflare (jak `fuegolingua.pl`):
1. **Wzorzec parametrów DNS i SSL/TLS:**
   - Pełna specyfikacja parametrów znajduje się w dedykowanym dokumencie: [`docs/CLOUDFLARE_STANDARDS.md`](docs/CLOUDFLARE_STANDARDS.md).
   - SSL/TLS Encryption Mode: **Full** (lub Full Strict) — zakaz Flexible.
   - Always Use HTTPS: **ON**, Min TLS Version: **1.2**, TLS 1.3: **ON**, HTTP/3 (QUIC): **ON**.
   - Speed Brain: **ON**, Rocket Loader: **OFF** (dla stabilności czystego Vanilla JS).
2. **Automatyczny Purge Cache w CI/CD:**
   - Dodaj w GitHub Secrets: `CLOUDFLARE_ZONE` oraz `CLOUDFLARE_TOKEN`.
   - Potok `deploy.yml` / `deploy-production.yml` automatycznie odświeży pamięć podręczną krawędzi Cloudflare zaraz po przesłaniu plików na serwer LH.
3. **Prawidłowy odczyt IP w PHP:**
   - Używaj `$clientIp = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'];`

---
*Dokumentacja przygotowana dla ekosystemu TwojaStronaWWW.*

