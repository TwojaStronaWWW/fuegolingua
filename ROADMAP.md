# 🗺️ Roadmap & Rejestr Sprintów: FuegoLingua

Ten dokument stanowi oficjalny rejestr planu wydań (Sprint Backlog) projektu **FuegoLingua** w organizacji **TwojaStronaWWW**.  
Wszystkie zadania są synchronizowane ze standardem **Conventional Commits** i GitHub Milestones.

---

## 📊 Podsumowanie Sprintów (Milestones)

| Sprint / Kamień Milowy | Cel i Zakres | Liczba Zadań | Status |
|---|---|:---:|:---:|
| [**Sprint 1: Wzorzec & CI/CD**](#sprint-1-wzorzec--cicd) | Implementacja standardu `_site-template`, potok CI/CD, githooks | 4 | 🟢 Ukończony |
| [**Sprint 2: Jakość & WCAG / SEO**](#sprint-2-jakość--wcag--seo) | Weryfikacja a11y, dane strukturalne Schema.org, responsywność, SoC | 3 | 🟢 Ukończony |
| [**Sprint 3: Konwersja, RODO & Krzyżowa Unifikacja**](#sprint-3-konwersja-rodo--krzyżowa-unifikacja) | Bezpieczny Lead Recovery RODO, osTicket API, AI Widget v3.0, Gitleaks | 4 | 🟢 Ukończony |

---

## 📌 Szczegółowy Zakres Sprintów

### 🚀 Sprint 1: Wzorzec & CI/CD
- [x] **#1: [CI] Wdrożenie potoku GitHub Actions Quality Gate**
  - *Priorytet:* `HIGH` | *Etykiety:* `ci`, `automation`
  - *Opis:* 3-etapowy potok CI/CD: Quality Gate, audyt Lighthouse CI (90+) i wdrożenie produkcyjne SFTP na LH.
- [x] **#2: [TEST] Bezbiblioteczne testy jednostkowe (`node:test`)**
  - *Priorytet:* `HIGH` | *Etykiety:* `testing`
  - *Opis:* Testy higieny repozytorium (ISO 27001), integralności HTML5, interakcji UI i formularza kontaktowego.
- [x] **#3: [HOOKS] Pre-commit hook oraz commit-msg**
  - *Priorytet:* `HIGH` | *Etykiety:* `dx`, `security`
  - *Opis:* Blokada wycieku sekretów, automatyczne wywołanie `npm run check` i weryfikacja Conventional Commits.
- [x] **#4: [MOD] Modularyzacja architektury frontendu (Vanilla JS ES6+)**
  - *Priorytet:* `MEDIUM` | *Etykiety:* `refactor`, `frontend`
  - *Opis:* Rozdzielenie logiki na `assets/js/main.js` (UI/nawigacja) i `assets/js/contact.js` (formularz/lead recovery).

---

### 🎨 Sprint 2: Jakość & WCAG / SEO
- [x] **#5: [SEO] Weryfikacja danych strukturalnych Schema.org i spójności e-mail**
  - *Priorytet:* `MEDIUM` | *Etykiety:* `seo`
  - *Opis:* Implementacja Schema.org `EducationalOrganization` i `Course` na podstronach oraz unifikacja adresu `kontakt@fuegolingua.pl`.
- [x] **#6: [PERF] Wdrożenie Cloudflare R2 Media & Optymalizacja WebP**
  - *Priorytet:* `HIGH` | *Etykiety:* `performance`, `cloudflare`, `r2`
  - *Opis:* Konwersja grafik do WebP, przygotowanie paczki mediów R2 i podpięcie subdomeny `media.fuegolingua.pl`.
- [x] **#7: [A11Y / SoC] Pełna separacja warstw (Zero Inline Styles) i dostępność WCAG 2.1 AA**
  - *Priorytet:* `HIGH` | *Etykiety:* `accessibility`, `refactor`
  - *Opis:* Eliminacja wszystkich stylów inline z `index.html`, dodanie `.skip-link`, `<main id="main-content">`, semantycznego `<button id="menu-toggle">` oraz walidacji zmiennych CSS (`css-integrity.test.js`).

---

### 🔒 Sprint 3: Konwersja, RODO & Krzyżowa Unifikacja (`_site-template` <-> `fuegolingua`)
- [x] **#8: [SEC/RODO] Refaktoryzacja backendu `api/contact.php`, `api/leads-store.php` i `api/rate-limit.php`**
  - *Priorytet:* `HIGH` | *Etykiety:* `security`, `rodo`, `backend`
  - *Opis:* Anonimizacja IP (`mask_ip`), atomowy zapis CSV (`LOCK_EX`), wielopolowy Honeypot, pomiar czasu interakcji, integracja z osTicket API, autoresponder oraz zapis szkicu formularza w `localStorage`.
- [x] **#9: [AI] Aktualizacja Asystenta AI do wersji v3.0 (Response Cache & Dynamic KB)**
  - *Priorytet:* `HIGH` | *Etykiety:* `ai`, `performance`
  - *Opis:* Wdrożenie dwupoziomowego cache zapytań, naprawa wycieku timera `AbortController` w `finally` (przyspieszenie testów z 9.1s do 0.17s) oraz unifikacja bazy wiedzy z `_site-template`.
- [x] **#10: [DEVOPS] Wdrożenie PWA Service Worker (`sw.js`), Gitleaks, Smoke Tests i generatora PDF**
  - *Priorytet:* `MEDIUM` | *Etykiety:* `devops`, `pwa`, `testing`
  - *Opis:* Dodanie `sw.js`, `.gitleaks.toml`, `scripts/generate-pdf.js`, `scripts/preview-tunnel.ps1` oraz `tests/smoke/ui-smoke.js`.
- [x] **#11: [CROSS] Przeniesienie najlepszych praktyk FuegoLingua do `_site-template`**
  - *Priorytet:* `HIGH` | *Etykiety:* `template`, `architecture`
  - *Opis:* Przeniesienie `initSmoothScroll`, `initScrollAnimations`, reguł cache/DEFLATE w `.htaccess`, `prefers-reduced-motion: reduce`, Schema.org JSON-LD i Open Graph do `_site-template`.
