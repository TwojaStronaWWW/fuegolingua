<?php
header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
session_start();

// Konfiguracja
$toEmail = 'carolalmadeoriente@gmail.com';
$subject = '🔔 Potencjalny klient (Lead) na stronie Fuego Lingua';

$response = ['success' => false, 'message' => ''];

// Klucz sesji aby zapobiec duplikatom (chociaż JS też to blokuje, warto mieć backendowe zabezpieczenie)
if (isset($_SESSION['lead_recovered']) && $_SESSION['lead_recovered'] === true) {
    $response['message'] = 'Lead already recovered today.';
    echo json_encode($response);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] === "POST" && isset($_POST['action']) && $_POST['action'] === 'recover_lead') {
    
    // Odczyt rzeczywistego IP (uwzględnienie nagłówka Cloudflare proxy)
    $clientIp = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? 'Nieznane IP';
    
    // Treść powiadomienia
    $email_content = "Witaj,\n\n";
    $email_content .= "Ktoś przegląda Twoją stronę już od ponad 15 minut!\n";
    $email_content .= "To może być potencjalny klient, który jest zainteresowany ofertą, ale jeszcze się nie skontaktował.\n\n";
    $email_content .= "Data zdarzenia: " . date("Y-m-d H:i:s") . "\n";
    $email_content .= "Adres IP: " . htmlspecialchars($clientIp, ENT_QUOTES, 'UTF-8') . "\n";
    
    // Nagłówki
    $headers = "From: system@fuegolingua.pl\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

    // Wysyłka
    if (@mail($toEmail, $subject, $email_content, $headers)) {
        $_SESSION['lead_recovered'] = true; // Zaznacz w sesji PHP
        $response['success'] = true;
        $response['message'] = 'Lead alert sent.';
    } else {
        $response['message'] = 'Failed to send alert.';
    }
} else {
    $response['message'] = 'Invalid request.';
}

echo json_encode($response);
?>
