<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

require_once __DIR__ . '/rate-limit.php';
require_once __DIR__ . '/leads-store.php';

/**
 * Pobiera zmienną środowiskową z getenv(), $_ENV lub pliku .env poza katalogiem publicznym (ISO 27001)
 */
if (!function_exists('get_env_secret')) {
    function get_env_secret(string $key, string $default = ''): string {
        $val = getenv($key);
        if ($val !== false && $val !== '') {
            return (string)$val;
        }
        if (!empty($_ENV[$key])) {
            return (string)$_ENV[$key];
        }
        $envPaths = [
            __DIR__ . '/../../.env',
            __DIR__ . '/../.env',
        ];
        foreach ($envPaths as $envPath) {
            if (@is_readable($envPath)) {
                $lines = @file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                if (is_array($lines)) {
                    foreach ($lines as $line) {
                        $line = trim($line);
                        if ($line === '' || strpos($line, '#') === 0 || strpos($line, '=') === false) {
                            continue;
                        }
                        list($k, $v) = explode('=', $line, 2);
                        if (trim($k) === $key) {
                            return trim($v, " \t\n\r\0\x0B\"'");
                        }
                    }
                }
            }
        }
        return $default;
    }
}

/**
 * Anonimizacja adresu IP zgodnie z zasadą minimalizacji danych RODO (Privacy-by-Design)
 * Zeruje ostatni oktet w IPv4 (np. 192.168.1.0) lub końcówkę w IPv6.
 */
if (!function_exists('mask_ip')) {
    function mask_ip($ip): string {
        if (empty($ip) || !is_string($ip)) {
            return '0.0.0.0';
        }
        $cleanIp = trim(explode(',', $ip)[0]);
        if (filter_var($cleanIp, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            $parts = explode('.', $cleanIp);
            $parts[3] = '0';
            return implode('.', $parts);
        }
        if (filter_var($cleanIp, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
            $parts = explode(':', $cleanIp);
            return implode(':', array_slice($parts, 0, 3)) . '::0';
        }
        return '0.0.0.0';
    }
}

/**
 * Koduje nagłówek Subject wiadomości e-mail zgodnie ze standardem RFC 2047 (UTF-8 Base64) i usuwa znaki CRLF/NUL.
 */
function encode_rfc2047_subject(string $subject): string {
    $clean = trim((string)preg_replace('/[\r\n\0]+/', ' ', $subject));
    return '=?UTF-8?B?' . base64_encode($clean) . '?=';
}

/**
 * Wykrywa sygnatury ataków warstwy 7 (XSS, SQLi, Path Traversal, Phar Deserialization).
 */
function contains_waf_attack_payload(array $payload): bool {
    $serialized = '';
    array_walk_recursive($payload, static function ($val) use (&$serialized): void {
        if (is_scalar($val)) {
            $str = (string)$val;
            $serialized .= ' ' . $str . ' ' . rawurldecode($str);
        }
    });
    if ($serialized === '') {
        return false;
    }
    if (strpos($serialized, "\0") !== false) {
        return true;
    }
    $wafPattern = '/(<\s*script\b|javascript\s*:|vbscript\s*:|on(?:error|load|mouseover|focus)\s*=|union\s+(?:all\s+)?select\b|\.\.\/|\.\.\\\\|(?:phar|expect|php|file|dict|gopher):\/\/|\/etc\/passwd)/i';
    return preg_match($wafPattern, $serialized) === 1;
}

// Wczesne zwolnienie sesji PHP (jeśli aktywna), aby nie blokować równoległych żądań podczas cURL i zapisu plikowego
if (session_status() === PHP_SESSION_ACTIVE) {
    @session_write_close();
}

// 0a. [REF-05] Zabezpieczenie OWASP Fetch Metadata (Sec-Fetch-Site) przed żądaniami Cross-Site
if (isset($_SERVER['HTTP_SEC_FETCH_SITE']) && strtolower(trim((string)$_SERVER['HTTP_SEC_FETCH_SITE'])) === 'cross-site') {
    http_response_code(403);
    echo json_encode(['status' => 'error', 'success' => false, 'message' => 'Niedozwolone żądanie międzywitrynowe (Cross-Site Request Blocked).']);
    exit;
}

// 0b. Ochrona przed atakami OOM / Payload Flood (maks. 64 KB)
$contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : 0;
if ($contentLength > 65536) {
    http_response_code(413);
    echo json_encode(['status' => 'error', 'success' => false, 'message' => 'Przekroczono dopuszczalny rozmiar żądania (maks. 64 KB).']);
    exit;
}

// Rzeczywiste IP klienta (z ochroną przed spoofingiem CF-Connecting-IP) i anonimizacja RODO
$clientIp = resolve_trusted_client_ip();
$maskedIp = mask_ip($clientIp);

// 0c. Sprawdzenie 15-minutowego IP Penalty Boxu
if (is_client_ip_banned($clientIp)) {
    http_response_code(403);
    echo json_encode(['status' => 'error', 'success' => false, 'message' => 'Twój adres IP został tymczasowo zablokowany ze względów bezpieczeństwa (15 min).']);
    exit;
}

// 0d. Zabezpieczenie Rate Limiting (ISO 27001): maks. 5 zgłoszeń na 60 sekund (3 naruszenia -> Penalty Box 15 min)
if (!rate_limit('contact_' . $maskedIp, 5, 60, $clientIp)) {
    http_response_code(429);
    echo json_encode(['status' => 'error', 'success' => false, 'message' => 'Zbyt wiele prób wysłania wiadomości. Odczekaj chwilę przed kolejną próbą.']);
    exit;
}

// Obsługa wejścia: JSON (Fetch API, limit 64 KB, głębokość maks. 16) lub tradycyjne FormData / POST
$rawBody = file_get_contents('php://input', false, null, 0, 65536);
$input = (is_string($rawBody) && $rawBody !== '') ? json_decode($rawBody, true, 16) : null;
if (!is_array($input)) {
    $input = is_array($_POST) ? $_POST : [];
}

if (empty($input)) {
    echo json_encode(['status' => 'error', 'success' => false, 'message' => 'Brak danych wejściowych']);
    exit;
}

// 0e. Filtr WAF Warstwy 7 (XSS, SQLi, Path Traversal, Phar) -> 15-minutowy IP Penalty Box
if (contains_waf_attack_payload($input)) {
    ban_client_ip($clientIp, 900, 'waf_l7_blocked');
    http_response_code(403);
    echo json_encode(['status' => 'error', 'success' => false, 'message' => 'Żądanie zostało odrzucone przez filtr bezpieczeństwa WAF.']);
    exit;
}

// 1. Zabezpieczenie Anty-Bot: Wielopolowy Honeypot (pola pułapki ukryte CSS-em dla ludzi)
$honeypots = ['website_url', 'hp_chk', 'website', 'company_name', 'phone_extra'];
foreach ($honeypots as $hp) {
    if (!empty($input[$hp])) {
        echo json_encode(['status' => 'success', 'success' => true, 'message' => 'Dziękujemy! Twoja wiadomość została wysłana pomyślnie.']);
        exit;
    }
}

// 2. Zabezpieczenie Anty-Bot: Wymóg wykonania kodu JavaScript w przeglądarce
if (empty($input['js_check'])) {
    echo json_encode(['status' => 'success', 'success' => true, 'message' => 'Dziękujemy! Twoja wiadomość została wysłana pomyślnie.']);
    exit;
}

// 3. Zabezpieczenie Anty-Bot: Pomiar czasu interakcji (minimalny czas wypełniania >= 2.5s, odrzucenie bool/NaN/Infinity)
$rawSubSec = $input['submission_seconds'] ?? null;
$subSecFloat = (is_numeric($rawSubSec) && !is_bool($rawSubSec)) ? (float)$rawSubSec : 0.0;
if (!is_finite($subSecFloat) || $subSecFloat < 2.5) {
    echo json_encode(['status' => 'success', 'success' => true, 'message' => 'Dziękujemy! Twoja wiadomość została wysłana pomyślnie.']);
    exit;
}

// 4. Oczyszczenie i normalizacja danych wejściowych (ochrona przed CRLF / Email & HTTP Header Injection)
$rawName = isset($input['name']) ? strip_tags(trim((string)$input['name'])) : '';
$name = mb_substr(trim((string)preg_replace('/[\r\n\0]+/', ' ', $rawName)), 0, 120);

$rawEmail = isset($input['email']) ? filter_var(trim((string)$input['email']), FILTER_SANITIZE_EMAIL) : '';
$email = mb_substr(trim((string)preg_replace('/[\r\n\0]+/', '', (string)$rawEmail)), 0, 180);

$phoneRaw = isset($input['phone']) ? trim(strip_tags((string)$input['phone'])) : '';
$phone = substr(trim((string)preg_replace('/[^0-9+\- ()]/', '', $phoneRaw)), 0, 32) ?: '-';

$fromScratch = isset($input['from_scratch']) ? mb_substr(trim(strip_tags((string)$input['from_scratch'])), 0, 40) : '';
$fromScratch = trim((string)preg_replace('/[\r\n\0]+/', ' ', $fromScratch));

$purposeRaw = $input['purpose'] ?? [];
if (is_array($purposeRaw)) {
    $purposeList = array_map(static fn($item) => mb_substr(trim(strip_tags((string)$item)), 0, 80), $purposeRaw);
    $purposeStr = implode(', ', array_filter($purposeList));
} else {
    $purposeStr = mb_substr(trim(strip_tags((string)$purposeRaw)), 0, 200);
}
$purposeStr = trim((string)preg_replace('/[\r\n\0]+/', ' ', $purposeStr));

$messageRaw = isset($input['message']) ? mb_substr(trim(strip_tags((string)$input['message'])), 0, 4000) : '';
$messageRaw = str_replace("\0", '', $messageRaw);
$courseMeta = [];
if ($fromScratch !== '') {
    $courseMeta[] = "Od podstaw: $fromScratch";
}
if ($purposeStr !== '') {
    $courseMeta[] = "Cel nauki: $purposeStr";
}
$metaPrefix = !empty($courseMeta) ? '[' . implode(' | ', $courseMeta) . '] ' : '';
$message = $messageRaw !== ''
    ? $metaPrefix . $messageRaw
    : ($metaPrefix !== '' ? $metaPrefix : '[Szybki kontakt — klient prosi o rozmowę bez opisu tekstowego]');

$newsletterConsent = !empty($input['newsletter_consent']) && $input['newsletter_consent'] !== 'false' && $input['newsletter_consent'] !== '0' ? 'TAK' : 'NIE';

$hasPhone = ($phone !== '-' && strlen(preg_replace('/\D/', '', $phone)) >= 7);
$hasEmail = ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) !== false);

// 5. Walidacja wymaganych pól (Zero-Friction: wystarczy Imię + Telefon LUB E-mail)
if (empty($name) || (!$hasPhone && !$hasEmail)) {
    echo json_encode(['status' => 'error', 'success' => false, 'message' => 'Podaj imię oraz numer telefonu lub poprawny adres e-mail.']);
    exit;
}

if ($email !== '' && !$hasEmail) {
    echo json_encode(['status' => 'error', 'success' => false, 'message' => 'Proszę podać poprawny adres e-mail.']);
    exit;
}

// 6. Zabezpieczenie Anty-Spam: Wykrywanie cyrylicy oraz nadmiernej ilości odnośników URL
if (preg_match('/\p{Cyrillic}/u', $message) || preg_match_all('/https?:\/\//i', $message) > 2) {
    echo json_encode(['status' => 'success', 'success' => true, 'message' => 'Dziękujemy! Twoja wiadomość została wysłana pomyślnie.']);
    exit;
}

// 7. Zapis finalnego leada i zgody newsletterowej (Zero-Data-Loss)
save_lead([
    date('Y-m-d'),
    date('H:i:s'),
    $name,
    $hasEmail ? $email : '-',
    $message,
    hash('sha256', $maskedIp),
    $phone,
    $newsletterConsent
], false);

// 8. Hybrydowa wysyłka: Helpdesk osTicket API (HTTPS Zero-Trust) z powiadomieniem Ntfy 1-Klik i fallbackiem do mail()
@session_write_close();
$osTicketApiKey = get_env_secret('OSTICKET_API_KEY');
$defaultOsTicketUrl = 'https://hd.twojastronawww.pl/ticket_hook.php';
$configuredOsTicketUrl = trim(get_env_secret('OSTICKET_API_URL', $defaultOsTicketUrl));
if ($configuredOsTicketUrl === '' || stripos($configuredOsTicketUrl, 'https://') !== 0) {
    $configuredOsTicketUrl = $defaultOsTicketUrl;
}
$ticketCreated = false;
$ticketNum = 'BRAK';

if (!empty($osTicketApiKey) && function_exists('curl_init')) {
    $digits = preg_replace('/\D+/', '', $phone) ?: date('YmdHis');
    $ticketData = [
        'site' => 'fuegolingua',
        'name' => $name,
        'email' => $hasEmail ? $email : "tel-{$digits}@fuegolingua.pl",
        'phone' => $hasPhone ? $phone : '',
        'subject' => $messageRaw === '' ? "[Fuego Lingua] Szybki kontakt telefoniczny: $name ($phone)" : "[Fuego Lingua] Wiadomość z formularza od: $name",
        'message' => "Telefon: $phone\nNewsletter: $newsletterConsent\n\n$message",
        'ip' => $maskedIp,
        'source' => 'Web',
        'autorespond' => false,
        'send_email' => false,
    ];

    $endpoints = [$configuredOsTicketUrl];
    if ($configuredOsTicketUrl !== $defaultOsTicketUrl) {
        $endpoints[] = $defaultOsTicketUrl;
    }

    foreach ($endpoints as $epUrl) {
        $ch = curl_init($epUrl);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'X-API-Key: ' . preg_replace('/[\r\n\0]+/', '', $osTicketApiKey),
            'Content-Type: application/json',
            'Expect:'
        ]);
        curl_setopt($ch, CURLOPT_USERAGENT, 'FuegoLingua-HelpdeskClient/2.1');
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($ticketData, JSON_UNESCAPED_UNICODE));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 6);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
        curl_setopt($ch, CURLOPT_MAXREDIRS, 0);
        if (defined('CURLPROTO_HTTPS')) {
            curl_setopt($ch, CURLOPT_PROTOCOLS, CURLPROTO_HTTPS);
            curl_setopt($ch, CURLOPT_REDIR_PROTOCOLS, CURLPROTO_HTTPS);
        }

        $apiResponse = @curl_exec($ch);
        if (is_string($apiResponse) && strlen($apiResponse) > 65536) {
            $apiResponse = substr($apiResponse, 0, 65536);
        }
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        unset($ch);

        $resArr = is_string($apiResponse) ? json_decode($apiResponse, true, 16) : null;
        if ($httpCode === 201 && !empty($resArr['success'])) {
            $ticketCreated = true;
            $ticketNum = preg_replace('/[^a-zA-Z0-9_-]/', '', (string)($resArr['number'] ?? 'OK')) ?: 'OK';
            break;
        }
    }
}

// 8b. Powiadomienie Push 1-Klik na Ntfy (wsparcie self-hosted NTFY_BASE_URL + NTFY_TOKEN lub publicznego ntfy.sh)
$ntfyTopic = trim(get_env_secret('NTFY_TOPIC'));
if ($ntfyTopic !== '' && function_exists('curl_init')) {
    $sanitizeNtfyHeader = static fn(string $v): string => trim((string)preg_replace('/[\r\n\0]+/', ' ', $v));
    $sanitizeNtfyActionItem = static fn(string $v): string => trim((string)preg_replace('/[\r\n\0;,]+/', ' ', $v));

    $ntfyBaseUrl = rtrim(trim(get_env_secret('NTFY_BASE_URL', 'https://ntfy.sh')), '/');
    if ($ntfyBaseUrl === '' || stripos($ntfyBaseUrl, 'https://') !== 0) {
        $ntfyBaseUrl = 'https://ntfy.sh';
    }
    $ntfyToken = $sanitizeNtfyHeader(get_env_secret('NTFY_TOKEN'));
    $safeTopic = rawurlencode($sanitizeNtfyHeader($ntfyTopic));

    $ntfyLines = ["👤 IMIĘ: {$name}"];
    $ntfyActions = [];
    $titleParts = [$sanitizeNtfyHeader($name)];

    if ($hasPhone) {
        $digits = preg_replace('/\D+/', '', $phone) ?: '';
        $dial = (strlen($digits) === 9) ? '+48' . $digits : '+' . $digits;
        $safePhoneLabel = $sanitizeNtfyActionItem($phone);
        $ntfyLines[] = "📞 TELEFON: {$phone}";
        $titleParts[] = "TEL: {$safePhoneLabel}";
        $ntfyActions[] = "view, Zadzwon ({$safePhoneLabel}), tel:{$dial}";
    }
    if ($hasEmail) {
        $safeEmailLabel = $sanitizeNtfyActionItem($email);
        $ntfyLines[] = "✉️ E-MAIL: {$email}";
        $titleParts[] = "EMAIL: {$safeEmailLabel}";
        $ntfyActions[] = "view, Napisz e-mail ({$safeEmailLabel}), mailto:{$safeEmailLabel}";
    }
    $ntfyLines[] = "🎫 TICKET: " . ($ticketCreated ? "#{$ticketNum}" : "brak");
    $ntfyLines[] = "🌐 ŹRÓDŁO: Formularz fuegolingua.pl";
    $ntfyLines[] = "────────────────────────";
    $ntfyLines[] = $message;
    $ntfyActions[] = "view, Otworz Helpdesk, https://hd.twojastronawww.pl/scp/";

    $ntfyHeaders = [
        'Title: ' . $sanitizeNtfyHeader('Formularz (Fuego Lingua) - ' . implode(' | ', $titleParts)),
        'Priority: high',
        'Tags: incoming_envelope,telephone_receiver',
        'Actions: ' . $sanitizeNtfyHeader(implode('; ', array_slice($ntfyActions, 0, 3)))
    ];
    if ($ntfyToken !== '') {
        $ntfyHeaders[] = 'Authorization: Bearer ' . $ntfyToken;
    }

    $chNtfy = curl_init("{$ntfyBaseUrl}/{$safeTopic}");
    curl_setopt_array($chNtfy, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => implode("\n", $ntfyLines),
        CURLOPT_HTTPHEADER => $ntfyHeaders,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 3,
        CURLOPT_CONNECTTIMEOUT => 2,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_MAXREDIRS => 0
    ]);
    if (defined('CURLPROTO_HTTPS')) {
        curl_setopt($chNtfy, CURLOPT_PROTOCOLS, CURLPROTO_HTTPS);
        curl_setopt($chNtfy, CURLOPT_REDIR_PROTOCOLS, CURLPROTO_HTTPS);
    }
    @curl_exec($chNtfy);
    unset($chNtfy);
}

$rawToEmail = get_env_secret('CONTACT_EMAIL', 'kontakt@fuegolingua.pl');
$toEmail = filter_var(preg_replace('/[\r\n\0]+/', '', $rawToEmail), FILTER_VALIDATE_EMAIL) ?: 'kontakt@fuegolingua.pl';
$brandName = trim((string)preg_replace('/[\r\n\0<>]+/', ' ', get_env_secret('BRAND_NAME', 'Fuego Lingua'))) ?: 'Fuego Lingua';

if (!$ticketCreated) {
    $rawSubject = $messageRaw === ''
        ? "SZYBKI TELEFON od: $name ($phone)"
        : "Nowa wiadomość ze strony Fuego Lingua od: $name";
    $encodedSubject = encode_rfc2047_subject($rawSubject);

    $email_content = "Nowe zgłoszenie kontaktowe (Fuego Lingua):\n\n";
    $email_content .= "Imię lub pseudonim: $name\n";
    $email_content .= "Telefon: $phone\n";
    $email_content .= "Email: " . ($hasEmail ? $email : '-') . "\n";
    $email_content .= "Newsletter: $newsletterConsent\n";
    $email_content .= "Wiadomość:\n$message\n\n";
    $email_content .= "---\nData: " . date("Y-m-d H:i:s") . "\n";
    $email_content .= "Zanonimizowane IP (RODO): $maskedIp\n";

    $headers = "From: no-reply@fuegolingua.pl\r\n";
    if ($hasEmail) {
        $safeReplyTo = preg_replace('/[\r\n\0]+/', '', $email);
        $headers .= "Reply-To: $safeReplyTo\r\n";
    }
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

    @mail($toEmail, $encodedSubject, $email_content, $headers);
}

// 9. Autoresponder dla klienta (gdy podał adres e-mail)
if ($hasEmail) {
    $encodedAutoSubject = encode_rfc2047_subject("Potwierdzenie otrzymania wiadomości — $brandName");
    $autoBody  = "¡Hola $name!\n\n";
    $autoBody .= "Dziękujemy za skontaktowanie się z $brandName.\n";
    $autoBody .= "Twoje zgłoszenie dotarło do nas bezpiecznie. Odpowiemy najszybciej jak to możliwe (zazwyczaj w ciągu 24 godzin).\n\n";
    $autoBody .= "Podsumowanie Twojego zgłoszenia:\n";
    $autoBody .= "-----------------------------------------\n";
    $autoBody .= "Telefon kontaktowy: $phone\n";
    $autoBody .= "Treść wiadomości:\n$message\n";
    $autoBody .= "-----------------------------------------\n\n";
    if ($newsletterConsent === 'TAK') {
        $autoBody .= "Odnotowaliśmy również Twoją zgodę na otrzymywanie informacji o nowościach i ofertach specjalnych (możesz zrezygnować w dowolnym momencie).\n\n";
    }
    $autoBody .= "Pozdrawiamy,\n";
    $autoBody .= "Zespół $brandName\n";

    $encodedBrandFrom = encode_rfc2047_subject($brandName);
    $autoHeaders  = "From: $encodedBrandFrom <$toEmail>\r\n";
    $autoHeaders .= "Reply-To: $toEmail\r\n";
    $autoHeaders .= "MIME-Version: 1.0\r\n";
    $autoHeaders .= "Content-Type: text/plain; charset=UTF-8\r\n";

    @mail($email, $encodedAutoSubject, $autoBody, $autoHeaders);
}

echo json_encode([
    'status' => 'success',
    'success' => true,
    'message' => $hasEmail
        ? '¡Gracias! Twoja wiadomość została wysłana pomyślnie. Sprawdź potwierdzenie na swoim e-mailu.'
        : '¡Gracias! Twój numer został zapisany — oddzwonimy najszybciej jak to możliwe.'
]);
