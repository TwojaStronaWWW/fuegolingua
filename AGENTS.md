# SYSTEM PROMPT & WYTYCZNE PROJEKTU: FUEGOLINGUA (`fuegolingua.pl`)

## 1. KONTEKST I PRZEZNACZENIE PROJEKTU
**FuegoLingua (`fuegolingua.pl`)** — platforma kursów języka hiszpańskiego online (zajęcia indywidualne 1:1, w parach, grupowe oraz hiszpański biznesowy/branżowy z bezpłatną lekcją próbną).
- Wdrożenie produkcyjne SFTP na serwer LH.pl: `/home/platne/serwer417204/public_html/fuegolingua.pl` (`.github/workflows/deploy.yml`).
- Zintegrowany z centralną bramką AI (`site_id: fuegolingua`, baza wiedzy `VPS/services/ai-router/data/fuegolingua-knowledge.txt`).

---

## 2. STRUKTURA KLUCZOWYCH PLIKÓW PROJEKTU
- **Widoki HTML5:** `index.html` (strona główna oferty językowej) oraz `cennik.html` (kalkulator i warianty pakietów lekcji).
- **Style i Skrypty:** `assets/css/style.css`, `assets/css/media.css`, `assets/css/cennik.css`, `assets/js/main.js`, `assets/js/contact.js`, `assets/js/script.js`.
- **Backend i Testy:** `api/` (`rate_limits/`, `sessions/`, `.htaccess: Deny from all`), `scripts/serve.js`, `tests/unit/` (`html-integrity.test.js`, `main.test.js`, `contact-flow.test.js`, `repo-hygiene.test.js`).

---

## 3. REGUŁY GLOBALNE I EVERGREEN WEB STANDARDS (`[REF-01]` do `[REF-08]`)
Obowiązują globalne reguły inżynieryjne pakietu `tsw-enterprise` (`rules/AGENTS.md`: SoC Zero-Inline, ISO 27001 KeePass-First, `LOCK_EX`, `node:test`, język polski, Tabela Analizy, Conventional Commits) oraz rejestr `docs/WEB_STANDARDS_RADAR.md`:
- **`[REF-01]` Server & `.htaccess` (`h5bp/server-configs-apache`):** kompresja `mod_brotli` + `mod_deflate`, nagłówki `COOP` (`same-origin-allow-popups`), `CORP` (`same-site`), `CSP`, `HSTS` oraz typy MIME (`avif`, `webp`, `md`, `webmanifest`).
- **`[REF-02]` Kolejność `<head>` i Nawigacja `0 ms` (`rviscomi/capo.js` & `web.dev/baseline`):** `charset` -> `viewport` -> `title` -> `preconnect` -> `stylesheet` przed meta SEO/JSON-LD oraz deklaratywne `<script type="speculationrules">` (prerender z wykluczeniem `/api/*`).
- **`[REF-03]` Vanilla CSS Baseline (`argyleink/open-props` & `web.dev/baseline`):** `color-scheme: dark light` w `:root`, `scrollbar-gutter: stable` na `html`, `@view-transition { navigation: auto; }`, `text-wrap: balance` i `text-wrap: pretty`.
- **`[REF-04]` Dostępność WCAG 2.2 (`w3c/aria-practices` & `alphagov/govuk-frontend`):** `.skip-link`, role ARIA (`alert`, `status`), pełna obsługa klawiatury.
- **`[REF-05]` Bezpieczeństwo Aplikacji (`OWASP/ASVS` & `OWASP/CheatSheetSeries`):** walidacja nagłówka `Sec-Fetch-Site`, tokeny CSRF `hash_equals`, `flock(LOCK_EX)`, `@session_write_close()`, `CURLOPT_FOLLOWLOCATION => false`, `CURLPROTO_HTTPS`.
- **`[REF-06]` Polityka Podatności RFC 9116 (`securitytxt.org`):** plik `/.well-known/security.txt` z aktywną datą `Expires:`.
- **`[REF-07]` Optymalizacja dla Wyszukiwarek AI – GEO (`llmstxt.org`):** plik `/llms.txt` podpięty w `<head>` (`rel="alternate" type="text/markdown"`) i dozwolony w `robots.txt` (`Allow: /llms.txt`).
- **`[REF-08]` SEO On-Page & Schema.org (`schema.org` & `indexnow.org`):** pełny graf `@graph` JSON-LD, przekierowanie `301` non-www oraz `data-nosnippet` na widgecie AI.
