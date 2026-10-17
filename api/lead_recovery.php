<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

// Zgodnie z RODO (art. 5 i 6) szkice formularza przed kliknięciem "Wyślij"
// są przechowywane wyłącznie lokalnie w przeglądarce użytkownika (localStorage).
echo json_encode([
    'success' => true,
    'status' => 'ok',
    'rodo_mode' => 'client_local_storage',
    'message' => 'Draft handled locally in browser storage (GDPR compliant).'
]);
