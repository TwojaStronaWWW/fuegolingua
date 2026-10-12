# ☁️ Standard Konfiguracji Cloudflare dla Witryn TwojaStronaWWW / FuegoLingua

Niniejszy dokument stanowi oficjalny, ustandaryzowany wzorzec (Golden Standard) parametrów i reguł **Cloudflare** wypracowany na bazie produkcyjnej infrastruktury **FuegoLingua** (`fuegolingua.pl`) i hostingu **LH.pl**.

Dokument służy jako gotowa checklista „krok po kroku” do wdrożenia na każdej nowo tworzonej witrynie opartej o szablon `_site-template`.

---

## 📋 1. Podsumowanie Parametrów Referencyjnych (FuegoLingua)

| Obszar / Moduł | Parametr w Cloudflare | Wartość Wzorcowa | Uzasadnienie Inżynieryjne |
|---|---|---|---|
| **DNS** | Serwery nazw (NS) | Przypisane przez Cloudflare (np. `mark.ns`, `perla.ns`) | Pełna kontrola nad strefą DNS i routingiem krawędziowym. |
| **DNS** | Rekord `@` (root domain) | `A` -> IP hostingu LH (`195.2.222.233`) | Proxy: **Proxied (Pomarańczowa chmurka)**. |
| **DNS** | Rekord `www` | `CNAME` -> `@` | Proxy: **Proxied (Pomarańczowa chmurka)**. |
| **DNS** | Poczta / FTP | `MX`, `mail`, `ftp` | Proxy: **DNS Only (Szara chmurka)** — protokoły pocztowe nie mogą być proxowane. |
| **SSL/TLS** | Tryb szyfrowania | **Full (lub Full Strict)** | Szyfrowanie end-to-end (Cloudflare <-> Certyfikat LH.pl). **Zakaz trybu Flexible!** |
| **SSL/TLS** | Always Use HTTPS | **ON** | Wymusza automatyczny redirect 301 z HTTP do HTTPS na krawędzi sieci. |
| **SSL/TLS** | Min. TLS Version | **TLS 1.2** | Eliminacja podatnych protokołów TLS 1.0 i TLS 1.1. |
| **SSL/TLS** | TLS 1.3 | **ON** | Najszybszy handshake kryptograficzny (0-RTT). |
| **SSL/TLS** | Automatic HTTPS Rewrites | **ON** | Zapobieganie błędom Mixed Content przy zasobach statycznych. |
| **Speed** | HTTP/3 (QUIC) | **ON** | Protokół transportowy nowej generacji przez UDP (`alt-svc: h3=":443"`). |
| **Speed** | Speed Brain / Speculation | **ON** | Wstępne prefetchowanie stron po najechaniu kursorem (`/cdn-cgi/speculation`). |
| **Speed** | Kompresja Brotli | **ON** | Lepsza kompresja HTML/CSS/JS niż standardowy Gzip. |
| **Speed** | Rocket Loader | **OFF** | **Wyłączony** — unika opóźnień w DOMContentLoaded dla czystego Vanilla JS. |
| **Speed** | Auto Minify | **CSS: ON, JS: ON, HTML: ON** | Opcjonalna minifikacja w locie na serwerach krawędziowych. |
| **Caching** | Caching Level | **Standard** | Automatyczne buforowanie plików statycznych wg rozszerzeń. |
| **Caching** | Browser Cache TTL | **Respect Existing Headers** | Respektowanie dyrektyw `Cache-Control` z pliku `.htaccess` na serwerze LH. |
| **Caching** | Always Online | **ON** | Wyświetlanie kopii strony, jeśli hosting LH miałby chwilową przerwę. |
| **Security** | Security Level | **Medium** | Optymalny balans ochrony przed złośliwym ruchem a dostępnością dla ludzi. |
| **Security** | Bot Fight Mode | **ON** | Automatyczna bezpłatna ochrona przed znanymi botami scrapingowymi. |
| **Network** | IPv6 Compatibility | **ON** | Dostępność strony po protokole IPv6 na całym świecie. |
| **Network** | WebSockets & gRPC | **ON** | Zgodność ze współczesnymi protokołami dwukierunkowymi. |
| **CI/CD** | Purge Cache API | **Włączone w deploy.yml** | Natychmiastowe zrzucenie cache po deployu SFTP. |

---

## 🛠️ 2. Konfiguracja Krok po Kroku (Runbook dla Nowej Strony)

### Krok 1: Dodanie domeny i konfiguracja DNS
1. W panelu Cloudflare kliknij **Add a Site** i wprowadź domenę klienta.
2. Zmień delegację DNS u rejestratora domeny na przypisane Nameservery Cloudflare.
3. W zakładce **DNS -> Records**:
   - `Type: A`, `Name: @`, `IPv4: <IP_SERWERA_LH>`, `Proxy status: Proxied` (pomarańczowa chmurka)
   - `Type: CNAME`, `Name: www`, `Target: @`, `Proxy status: Proxied`
   - *Poczta LH:*
     - `Type: MX`, `Name: @`, `Mail server: mail.twojadomena.pl`, `Priority: 10`, `Proxy status: DNS only`
     - `Type: A`, `Name: mail`, `IPv4: <IP_SERWERA_LH>`, `Proxy status: DNS only` (szara chmurka)
     - `Type: TXT`, `Name: @`, `Content: v=spf1 include:_spf.lh.pl ~all`

---

### Krok 2: Zakładka SSL/TLS
1. **Overview:** Ustaw **Full** (lub **Full Strict**, jeśli na LH zainstalowano certyfikat Let's Encrypt).  
   > ⚠️ **OSTRZEŻENIE:** Wybór trybu *Flexible* spowoduje nieskończoną pętlę przekierowań (ERR_TOO_MANY_REDIRECTS), ponieważ serwer LH wymusza HTTPS w `.htaccess`.
2. **Edge Certificates:**
   - **Always Use HTTPS:** Włącz (ON)
   - **Minimum TLS Version:** Wybierz `TLS 1.2`
   - **Opportunistic Encryption:** Włącz (ON)
   - **TLS 1.3:** Włącz (ON)
   - **Automatic HTTPS Rewrites:** Włącz (ON)

---

### Krok 3: Zakładka Speed (Wydajność)
1. **Optimization:**
   - **Auto Minify:** Zaznacz `JavaScript`, `CSS`, `HTML`.
   - **Brotli:** Włącz (ON).
   - **Early Hints:** Włącz (ON).
   - **Speed Brain / Speculation Rules:** Włącz (ON).
   - **Rocket Loader:** Pozostaw **WYŁĄCZONY (OFF)** — czysty Vanilla JS z szablonu działa szybciej bez opóźniającego wrappera Cloudflare.

---

### Krok 4: Zakładka Caching (Pamięć Podręczna)
1. **Configuration:**
   - **Caching Level:** `Standard`
   - **Browser Cache TTL:** `Respect Existing Headers` (dzięki temu nagłówki z `.htaccess` zarządzają czasem ważności w przeglądarce).
   - **Always Online:** Włącz (ON).
   - **Crawler Hints:** Włącz (ON).

---

### Krok 5: Zakładka Security (Bezpieczeństwo & WAF)
1. **Settings:**
   - **Security Level:** `Medium`
   - **Challenge Passage:** `30 minutes`
2. **Bots:**
   - **Bot Fight Mode:** Włącz (ON).

---

## 🤖 3. Integracja z Potokiem CI/CD (Automatyczny Purge Cache)

Aby zmiany w plikach HTML/CSS/JS wdrożone przez SFTP były widoczne dla kursantów natychmiast bez konieczności ręcznego klikania w panelu Cloudflare:

### 1. Wygenerowanie tokenu API w Cloudflare:
1. Przejdź do: **My Profile -> API Tokens -> Create Token**.
2. Wybierz szablon: **Purge Cache**.
3. W sekcji **Zone Resources** wybierz: `Include -> Specific zone -> twojadomena.pl`.
4. Skopiuj wygenerowany token.
5. Z pulpitu strefy domeny (Overview) skopiuj **Zone ID**.

### 2. Dodanie sekretów w GitHubie:
W repozytorium GitHub: `Settings -> Secrets and variables -> Actions`:
- `CLOUDFLARE_ZONE`: Twój Zone ID (np. `a1b2c3d4...`)
- `CLOUDFLARE_TOKEN`: Twój API Token

### 3. Krok w potoku `.github/workflows/deploy.yml`:
Krok ten jest już wbudowany w potok:
```yaml
- name: 3.4 Czyszczenie pamięci podręcznej Cloudflare (opcjonalnie)
  if: env.CF_ZONE != '' && env.CF_TOKEN != ''
  env:
    CF_ZONE: ${{ secrets.CLOUDFLARE_ZONE }}
    CF_TOKEN: ${{ secrets.CLOUDFLARE_TOKEN }}
  run: |
    echo "Wysyłanie żądania Purge Cache do API Cloudflare..."
    curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/purge_cache" \
      -H "Authorization: Bearer $CF_TOKEN" \
      -H "Content-Type: application/json" \
      --data '{"purge_everything":true}'
```

---

## 💻 4. Integracja w Kodzie PHP (Rzeczywiste IP za Proxy)

Gdy witryna działa za Cloudflare, serwer LH widzi adresy IP krawędzi Cloudflare zamiast adresu użytkownika.  
W skryptach PHP (`contact.php`, `lead_recovery.php`) należy zawsze stosować odczyt nagłówka `HTTP_CF_CONNECTING_IP`:

```php
// Prawidłowy odczyt IP kursanta / klienta
$clientIp = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? 'Nieznane IP';

// Opcjonalnie: kraj pochodzenia użytkownika dostarczany przez Cloudflare
$clientCountry = $_SERVER['HTTP_CF_IPCOUNTRY'] ?? 'PL';
```
Standard ten jest w 100% zaimplementowany w FuegoLingua.
