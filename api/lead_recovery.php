<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

if (session_status() === PHP_SESSION_ACTIVE) {
    @session_write_close();
}

// [REF-05] Ochrona OWASP Fetch Metadata (Sec-Fetch-Site) i limit rozmiaru żądania (64 KB)
if (isset($_SERVER['HTTP_SEC_FETCH_SITE']) && strtolower(trim((string)$_SERVER['HTTP_SEC_FETCH_SITE'])) === 'cross-site') {
    http_response_code(403);
    echo json_encode(['success' => false, 'status' => 'error', 'message' => 'Cross-Site Request Blocked.']);
    exit;
}

$contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : 0;
if ($contentLength > 65536) {
    http_response_code(413);
    echo json_encode(['success' => false, 'status' => 'error', 'message' => 'Payload Too Large.']);
    exit;
}

// Zgodnie z RODO (art. 5 i 6) szkice formularza przed kliknięciem "Wyślij"
// są przechowywane wyłącznie lokalnie w przeglądarce użytkownika (localStorage).
echo json_encode([
    'success' => true,
    'status' => 'ok',
    'rodo_mode' => 'client_local_storage',
    'message' => 'Draft handled locally in browser storage (GDPR compliant).'
]);
