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
        if (is_readable($envPath)) {
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

/**
 * Anonimizacja adresu IP zgodnie z zasadą minimalizacji danych RODO (Privacy-by-Design)
 * Zeruje ostatni oktet w IPv4 (np. 192.168.1.0) lub końcówkę w IPv6.
 */
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

// Rzeczywiste IP klienta (uwzględnienie Cloudflare Proxy Anycast) i anonimizacja RODO
$clientIp = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
$maskedIp = mask_ip($clientIp);

// 0. Zabezpieczenie Rate Limiting (ISO 27001): maks. 5 zgłoszeń na 60 sekund
if (!rate_limit('contact_' . $maskedIp, 5, 60)) {
    http_response_code(429);
    echo json_encode(['status' => 'error', 'success' => false, 'message' => 'Zbyt wiele prób wysłania wiadomości. Odczekaj chwilę przed kolejną próbą.']);
    exit;
}

// Obsługa wejścia: JSON (Fetch API) lub tradycyjne FormData / POST
$input = json_decode((string)file_get_contents("php://input"), true);
if (!is_array($input)) {
    $input = is_array($_POST) ? $_POST : [];
}

if (empty($input)) {
    echo json_encode(['status' => 'error', 'success' => false, 'message' => 'Brak danych wejściowych']);
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

// 4. Oczyszczenie i normalizacja danych wejściowych (ochrona przed Email Header Injection)
$rawName = isset($input['name']) ? strip_tags(trim((string)$input['name'])) : '';
$name = mb_substr(trim((string)preg_replace('/[\r\n]+/', ' ', $rawName)), 0, 120);

$rawEmail = isset($input['email']) ? filter_var(trim((string)$input['email']), FILTER_SANITIZE_EMAIL) : '';
$email = mb_substr(trim((string)preg_replace('/[\r\n]+/', '', (string)$rawEmail)), 0, 180);

$phoneRaw = isset($input['phone']) ? trim(strip_tags((string)$input['phone'])) : '';
$phone = preg_replace('/[^0-9+\-\s()]/', '', $phoneRaw) ?: '-';

$fromScratch = isset($input['from_scratch']) ? mb_substr(trim(strip_tags((string)$input['from_scratch'])), 0, 40) : '';
$purposeRaw = $input['purpose'] ?? [];
if (is_array($purposeRaw)) {
    $purposeList = array_map(static fn($item) => mb_substr(trim(strip_tags((string)$item)), 0, 80), $purposeRaw);
    $purposeStr = implode(', ', array_filter($purposeList));
} else {
    $purposeStr = mb_substr(trim(strip_tags((string)$purposeRaw)), 0, 200);
}

$messageRaw = isset($input['message']) ? mb_substr(trim(strip_tags((string)$input['message'])), 0, 4000) : '';
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

// 8. Hybrydowa wysyłka: Helpdesk osTicket API (Dual-Endpoint Failover) z powiadomieniem Ntfy 1-Klik i fallbackiem do mail()
@session_write_close();
$osTicketApiKey = get_env_secret('OSTICKET_API_KEY');
$osTicketApiUrl = get_env_secret('OSTICKET_API_URL', 'http://hd.twojastronawww.pl:8080/ticket_hook.php');
$ticketCreated = false;
$ticketNum = 'BRAK';

if (!empty($osTicketApiKey) && function_exists('curl_init')) {
    $digits = preg_replace('/\D+/', '', $phone) ?: date('YmdHis');
    $ticketData = [
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

    $endpoints = [
        ['url' => $osTicketApiUrl, 'resolve' => ['hd.twojastronawww.pl:8080:127.0.0.1']],
        ['url' => 'https://hd.twojastronawww.pl/ticket_hook.php', 'resolve' => []],
    ];

    foreach ($endpoints as $ep) {
        $ch = curl_init($ep['url']);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'X-API-Key: ' . $osTicketApiKey,
            'Content-Type: application/json',
            'Expect:'
        ]);
        if (!empty($ep['resolve'])) {
            curl_setopt($ch, CURLOPT_RESOLVE, $ep['resolve']);
        }
        curl_setopt($ch, CURLOPT_USERAGENT, 'FuegoLingua-HelpdeskClient/2.0');
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($ticketData, JSON_UNESCAPED_UNICODE));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 6);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
        curl_setopt($ch, CURLOPT_MAXREDIRS, 0);
        if (defined('CURLPROTO_HTTPS') && defined('CURLPROTO_HTTP')) {
            curl_setopt($ch, CURLOPT_PROTOCOLS, CURLPROTO_HTTPS | CURLPROTO_HTTP);
        }

        $apiResponse = @curl_exec($ch);
        if (is_string($apiResponse) && strlen($apiResponse) > 65536) {
            $apiResponse = substr($apiResponse, 0, 65536);
        }
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $resArr = is_string($apiResponse) ? json_decode($apiResponse, true) : null;
        if ($httpCode === 201 && !empty($resArr['success'])) {
            $ticketCreated = true;
            $ticketNum = (string)($resArr['number'] ?? 'OK');
            break;
        }
    }
}

// 8b. Powiadomienie Push 1-Klik na Ntfy.sh (jeśli skonfigurowano NTFY_TOPIC w .env)
$ntfyTopic = get_env_secret('NTFY_TOPIC');
if ($ntfyTopic !== '' && function_exists('curl_init')) {
    $ntfyLines = ["👤 IMIĘ: {$name}"];
    $ntfyActions = [];
    $titleParts = [$name];
    if ($hasPhone) {
        $digits = preg_replace('/\D+/', '', $phone) ?: '';
        $dial = (strlen($digits) === 9) ? '+48' . $digits : '+' . $digits;
        $ntfyLines[] = "📞 TELEFON: {$phone}";
        $titleParts[] = "TEL: {$phone}";
        $ntfyActions[] = "view, Zadzwon ({$phone}), tel:{$dial}";
    }
    if ($hasEmail) {
        $ntfyLines[] = "✉️ E-MAIL: {$email}";
        $titleParts[] = "EMAIL: {$email}";
        $ntfyActions[] = "view, Napisz e-mail ({$email}), mailto:{$email}";
    }
    $ntfyLines[] = "🎫 TICKET: " . ($ticketCreated ? "#{$ticketNum}" : "brak");
    $ntfyLines[] = "🌐 ŹRÓDŁO: Formularz fuegolingua.pl";
    $ntfyLines[] = "────────────────────────";
    $ntfyLines[] = $message;
    $ntfyActions[] = "view, Otworz Helpdesk, https://hd.twojastronawww.pl/scp/";

    $chNtfy = curl_init("https://ntfy.sh/{$ntfyTopic}");
    curl_setopt_array($chNtfy, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => implode("\n", $ntfyLines),
        CURLOPT_HTTPHEADER => [
            'Title: Formularz (Fuego Lingua) - ' . implode(' | ', $titleParts),
            'Priority: high',
            'Tags: incoming_envelope,telephone_receiver',
            'Actions: ' . implode('; ', array_slice($ntfyActions, 0, 3))
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 3,
        CURLOPT_CONNECTTIMEOUT => 2,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_MAXREDIRS => 0
    ]);
    if (defined('CURLPROTO_HTTPS')) {
        curl_setopt($chNtfy, CURLOPT_PROTOCOLS, CURLPROTO_HTTPS);
    }
    @curl_exec($chNtfy);
    curl_close($chNtfy);
}

$toEmail = get_env_secret('CONTACT_EMAIL', 'kontakt@fuegolingua.pl');
$brandName = get_env_secret('BRAND_NAME', 'Fuego Lingua');

if (!$ticketCreated) {
    $subject = $messageRaw === '' ? "SZYBKI TELEFON od: $name ($phone)" : "Nowa wiadomość ze strony Fuego Lingua od: $name";
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
        $headers .= "Reply-To: $email\r\n";
    }
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

    @mail($toEmail, $subject, $email_content, $headers);
}

// 9. Autoresponder dla klienta (gdy podał adres e-mail)
if ($hasEmail) {
    $autoSubject = "Potwierdzenie otrzymania wiadomości — $brandName";
    $autoBody  = " ¡Hola $name!\n\n";
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

    $autoHeaders  = "From: $brandName <$toEmail>\r\n";
    $autoHeaders .= "Reply-To: $toEmail\r\n";
    $autoHeaders .= "Content-Type: text/plain; charset=UTF-8\r\n";

    @mail($email, $autoSubject, $autoBody, $autoHeaders);
}

echo json_encode([
    'status' => 'success',
    'success' => true,
    'message' => $hasEmail
        ? '¡Gracias! Twoja wiadomość została wysłana pomyślnie. Sprawdź potwierdzenie na swoim e-mailu.'
        : '¡Gracias! Twój numer został zapisany — oddzwonimy najszybciej jak to możliwe.'
]);
