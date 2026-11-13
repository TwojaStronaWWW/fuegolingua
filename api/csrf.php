<?php
declare(strict_types=1);

/**
 * [REF-05] Ochrona One-Time CSRF Token (ISO 27001 / OWASP ASVS) z bezpiecznym porównaniem stałoczasowym hash_equals()
 * oraz walidacją nagłówków przeglądarkowych Fetch Metadata (Sec-Fetch-Site).
 */
function verify_fetch_metadata(): bool {
    if (isset($_SERVER['HTTP_SEC_FETCH_SITE'])) {
        $site = strtolower(trim((string)$_SERVER['HTTP_SEC_FETCH_SITE']));
        if ($site === 'cross-site') {
            return false;
        }
    }
    return true;
}

function csrf_token(): string {
    if (empty($_SESSION['csrf_token']) || !is_string($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function csrf_check(?string $token): bool {
    if (!verify_fetch_metadata()) {
        return false;
    }
    if (empty($_SESSION['csrf_token']) || !is_string($_SESSION['csrf_token']) || !$token) {
        return false;
    }
    $result = hash_equals($_SESSION['csrf_token'], $token);
    if ($result) {
        unset($_SESSION['csrf_token']);
    }
    return $result;
}
