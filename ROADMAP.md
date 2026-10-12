# 🗺️ Roadmap & Rejestr Sprintów: FuegoLingua

Ten dokument stanowi oficjalny rejestr planu wydań (Sprint Backlog) projektu **FuegoLingua** w organizacji **TwojaStronaWWW**.  
Wszystkie zadania są synchronizowane ze standardem **Conventional Commits** i GitHub Milestones.

---

## 📊 Podsumowanie Sprintów (Milestones)

| Sprint / Kamień Milowy | Cel i Zakres | Liczba Zadań | Status |
|---|---|:---:|:---:|
| [**Sprint 1: Wzorzec & CI/CD**](#sprint-1-wzorzec--cicd) | Implementacja standardu _site-template, potok CI/CD, githooks | 4 | 🟢 Ukończony |
| [**Sprint 2: Jakość & WCAG / SEO**](#sprint-2-jakość--wcag--seo) | Weryfikacja a11y, dane strukturalne Schema.org, responsywność | 3 | 🟡 W toku |
| [**Sprint 3: Konwersja & CRM**](#sprint-3-konwersja--crm) | Bezpieczny Lead Recovery, testy e2e formularza i analityka | 2 | ⚪ Oczekuje |

---

## 📌 Szczegółowy Zakres Sprintów

### 🚀 Sprint 1: Wzorzec & CI/CD
- [x] **#1: [CI] Wdrożenie potoku GitHub Actions Quality Gate**
  - *Priorytet:* `HIGH` | *Etykiety:* `ci`, `automation`
  - *Opis:* 3-etapowy potok CI/CD: Quality Gate, audyt Lighthouse CI (90+) i wdrożenie produkcyjne SFTP na LH.
- [x] **#2: [TEST] Bezbiblioteczne testy jednostkowe (node:test)**
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
- [ ] **#5: [SEO] Weryfikacja danych strukturalnych Schema.org**
  - *Priorytet:* `MEDIUM` | *Etykiety:* `seo`
  - *Opis:* Implementacja Schema.org `EducationalOrganization` i `Course` na podstronach.
- [ ] **#6: [PERF] Optymalizacja kompresji obrazów WebP**
  - *Priorytet:* `MEDIUM` | *Etykiety:* `performance`
  - *Opis:* Konwersja pozostałych ciężkich grafik PNG do formatu WebP.
- [ ] **#7: [A11Y] Audyt kontrastu i dostępności WCAG 2.1 AA**
  - *Priorytet:* `MEDIUM` | *Etykiety:* `accessibility`
  - *Opis:* Eliminacja ostrzeżeń kontrastu na kartach poziomów językowych.
