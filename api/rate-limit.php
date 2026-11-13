<?php
declare(strict_types=1);

/**
 * Mechanizm Rate Limiting & 15-Minute IP Penalty Box (ISO 27001 / OWASP ASVS / Zero-PII RODO).
 * Chroni formularze i endpointy API przed atakami brute-force, DoS, Phar Deserialization oraz L7 WAF.
 */

// Wyrejestrowanie niebezpiecznych wrapperów strumieni PHP (ochrona przed Phar Deserialization i SSRF)
foreach (['phar', 'ftp', 'ftps', 'expect'] as $dangerousWrapper) {
    if (in_array($dangerousWrapper, stream_get_wrappers(), true)) {
        @stream_wrapper_unregister($dangerousWrapper);
    }
}
$__rawQs = (string)($_SERVER['QUERY_STRING'] ?? '');
if ($__rawQs !== '' && preg_match('/(^|&)(%2d|%ad|-)(d|n|s|w)\b|allow_url_include|auto_prepend_file|auto_append_file|php:\/\/|phar:\/\//i', $__rawQs)) {
    http_response_code(403);
    exit('Forbidden');
}

if (!function_exists('resolve_trusted_client_ip')) {
    /**
     * Rozpoznaje rzeczywisty adres IP klienta z ochroną przed spoofingiem nagłówka CF-Connecting-IP.
     */
    function resolve_trusted_client_ip(): string {
        $remoteAddr = trim((string)($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'));
        $cfIp = trim((string)($_SERVER['HTTP_CF_CONNECTING_IP'] ?? ''));
        if ($cfIp !== '' && !empty($_SERVER['HTTP_CF_RAY']) && filter_var($cfIp, FILTER_VALIDATE_IP)) {
            return $cfIp;
        }
        return filter_var($remoteAddr, FILTER_VALIDATE_IP) ? $remoteAddr : '0.0.0.0';
    }
}

if (!function_exists('mask_ip')) {
    /**
     * Anonimizacja adresu IP zgodnie z zasadą minimalizacji danych RODO (Privacy-by-Design).
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
}

if (!function_exists('is_safe_outbound_https_url')) {
    /**
     * [REF-05] SSRF Guard (OWASP ASVS): weryfikuje, że docelowy URL używa wyłącznie HTTPS
     * i nie wskazuje na adresy prywatne, loopback ani metadane chmurowe (169.254.169.254).
     */
    function is_safe_outbound_https_url(string $url): bool {
        $trimmed = trim($url);
        if ($trimmed === '' || preg_match('/[\r\n\0]/', $trimmed) === 1) {
            return false;
        }
        $parts = @parse_url($trimmed);
        if (!is_array($parts)) {
            return false;
        }
        $scheme = strtolower((string)($parts['scheme'] ?? ''));
        $host = strtolower(trim((string)($parts['host'] ?? ''), '[]'));
        if ($scheme !== 'https' || $host === '' || isset($parts['user']) || isset($parts['pass'])) {
            return false;
        }
        if (
            $host === 'localhost' ||
            $host === '169.254.169.254' ||
            $host === 'metadata.google.internal' ||
            str_ends_with($host, '.local') ||
            str_ends_with($host, '.internal')
        ) {
            return false;
        }
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            return filter_var(
                $host,
                FILTER_VALIDATE_IP,
                FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
            ) !== false;
        }
        return true;
    }
}

function get_rate_limits_dir(): string {
    $dir = __DIR__ . '/rate_limits';
    if (!file_exists($dir)) {
        if (!@mkdir($dir, 0755, true)) {
            return sys_get_temp_dir();
        }
        @file_put_contents($dir . '/.htaccess', "Deny from all\n");
        @file_put_contents($dir . '/index.html', '');
    }
    return $dir;
}

function get_penalty_box_file(string $clientIp): string {
    $dir = get_rate_limits_dir();
    $hash = hash('sha256', 'penalty_box|' . trim($clientIp));
    return $dir . '/rate_penalty_' . $hash . '.json';
}

/**
 * Sprawdza, czy dany adres IP znajduje się w aktywnym 15-minutowym IP Penalty Boxie.
 */
function is_client_ip_banned(string $clientIp): bool {
    if ($clientIp === '' || $clientIp === '0.0.0.0') {
        return false;
    }
    $file = get_penalty_box_file($clientIp);
    if (!file_exists($file)) {
        return false;
    }
    $fp = @fopen($file, 'rb');
    if (!$fp) {
        return false;
    }
    $banned = false;
    if (@flock($fp, LOCK_SH)) {
        $content = stream_get_contents($fp);
        @flock($fp, LOCK_UN);
        if ($content !== false && $content !== '') {
            $decoded = json_decode($content, true, 16);
            if (is_array($decoded) && isset($decoded['blocked_until']) && (int)$decoded['blocked_until'] > time()) {
                $banned = true;
            }
        }
    }
    fclose($fp);
    return $banned;
}

/**
 * Umieszcza adres IP w 15-minutowym IP Penalty Boxie (domyślnie 900s) bez zapisu surowego IP na dysku (Zero-PII).
 */
function ban_client_ip(string $clientIp, int $durationSeconds = 900, string $reason = 'security_violation'): void {
    if ($clientIp === '' || $clientIp === '0.0.0.0') {
        return;
    }
    $file = get_penalty_box_file($clientIp);
    $fp = @fopen($file, 'c+b');
    if (!$fp) {
        return;
    }
    if (@flock($fp, LOCK_EX)) {
        $existing = [];
        $content = stream_get_contents($fp);
        if ($content !== false && $content !== '') {
            $decoded = json_decode($content, true, 16);
            if (is_array($decoded)) {
                $existing = $decoded;
            }
        }
        $now = time();
        $blockedUntil = max((int)($existing['blocked_until'] ?? 0), $now + max(60, $durationSeconds));
        $payload = [
            'blocked_until' => $blockedUntil,
            'violations' => (int)($existing['violations'] ?? 0) + 1,
            'reason' => preg_replace('/[^a-zA-Z0-9_-]/', '', substr($reason, 0, 40)),
            'updated_at' => $now,
        ];
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, (string)json_encode($payload));
        fflush($fp);
        @flock($fp, LOCK_UN);
    }
    fclose($fp);
}

/**
 * Sprawdza i aktualizuje licznik żądań w oknie czasowym.
 * Nazwa pliku ma postać rate_<akcja>_<sha256>.json (Zero-PII — brak jakichkolwiek cyfr IP w nazwie pliku).
 * Po 3 naruszeniach limitu automatycznie nakłada 15-minutowy IP Penalty Box (blocked_until = time() + 900).
 */
function rate_limit(string $key, int $limit, int $seconds, ?string $clientIp = null): bool {
    if ($clientIp !== null && $clientIp !== '' && is_client_ip_banned($clientIp)) {
        return false;
    }

    $dir = get_rate_limits_dir();

    // Wyodrębnienie wyłącznie literowej nazwy akcji (Zero-PII: zero oktetów/cyfr IP w nazwie pliku)
    $actionName = 'default';
    if (preg_match('/^[a-zA-Z]+(?:_[a-zA-Z]+)*/', $key, $matches)) {
        $actionName = strtolower(substr($matches[0], 0, 24));
    }
    $keyHash = hash('sha256', $key);
    $file = $dir . '/rate_' . $actionName . '_' . $keyHash . '.json';

    // Probabilistyczny Garbage Collector (1%) z nieblokującym flock(LOCK_EX | LOCK_NB) przeciwko Race Condition
    if (random_int(1, 100) === 1) {
        $files = glob($dir . '/rate_*.json');
        if (is_array($files)) {
            $nowGc = time();
            foreach ($files as $f) {
                if ($nowGc - (int)@filemtime($f) > 3600) {
                    $gcFp = @fopen($f, 'r+b');
                    if ($gcFp !== false) {
                        if (@flock($gcFp, LOCK_EX | LOCK_NB)) {
                            @unlink($f);
                            @flock($gcFp, LOCK_UN);
                        }
                        fclose($gcFp);
                    }
                }
            }
        }
    }

    $fp = @fopen($file, 'c+b');
    if (!$fp) {
        return true; // Fail-open wyłącznie w razie braku uprawnień zapisu systemu plików
    }

    if (!@flock($fp, LOCK_EX)) {
        fclose($fp);
        return true;
    }

    $current = [];
    $content = stream_get_contents($fp);
    if ($content !== false && $content !== '') {
        $decoded = json_decode($content, true, 16);
        if (is_array($decoded)) {
            $current = $decoded;
        }
    }

    $now = time();

    // Aktywny 15-minutowy Penalty Box na danym kluczu
    if (isset($current['blocked_until']) && (int)$current['blocked_until'] > $now) {
        @flock($fp, LOCK_UN);
        fclose($fp);
        return false;
    }

    $violations = (int)($current['violations'] ?? 0);
    // Resetuj licznik naruszeń po godzinie spokoju
    if (isset($current['last_violation_at']) && ($now - (int)$current['last_violation_at'] > 3600)) {
        $violations = 0;
    }

    if (!isset($current['start_time']) || ($now - (int)$current['start_time'] > $seconds)) {
        $current = [
            'start_time' => $now,
            'count' => 0,
            'violations' => $violations,
            'blocked_until' => 0,
        ];
    }

    if ((int)$current['count'] >= $limit) {
        $violations++;
        $current['violations'] = $violations;
        $current['last_violation_at'] = $now;
        if ($violations >= 3) {
            $current['blocked_until'] = $now + 900;
            if ($clientIp !== null && $clientIp !== '') {
                ban_client_ip($clientIp, 900, 'rate_limit_exceeded');
            }
        }

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, (string)json_encode($current));
        fflush($fp);

        @flock($fp, LOCK_UN);
        fclose($fp);
        return false;
    }

    $current['count'] = (int)$current['count'] + 1;

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, (string)json_encode($current));
    fflush($fp);

    @flock($fp, LOCK_UN);
    fclose($fp);

    return true;
}
