<?php
declare(strict_types=1);

/**
 * Ochrona One-Time CSRF Token (ISO 27001) z bezpiecznym porównaniem stałoczasowym hash_equals().
 */
function csrf_token(): string {
    if (empty($_SESSION['csrf_token']) || !is_string($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function csrf_check(?string $token): bool {
    if (empty($_SESSION['csrf_token']) || !is_string($_SESSION['csrf_token']) || !$token) {
        return false;
    }
    $result = hash_equals($_SESSION['csrf_token'], $token);
    if ($result) {
        unset($_SESSION['csrf_token']);
    }
    return $result;
}
