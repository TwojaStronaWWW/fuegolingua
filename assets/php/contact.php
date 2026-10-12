<?php
header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

// Konfiguracja
$toEmail = 'carolalmadeoriente@gmail.com';
$subject = 'Nowa wiadomość ze strony Fuego Lingua';

$response = ['success' => false, 'message' => ''];

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    // 1. Zabezpieczenie Honeypot (pole website_url wypełniane wyłącznie przez boty)
    if (!empty($_POST["website_url"])) {
        // Ciche odrzucenie bota ze statusem powodzenia
        $response['success'] = true;
        $response['message'] = '¡Gracias! Twoja wiadomość dotarła do mnie tanecznym krokiem 💃 Odpiszę najszybciej jak to możliwe!';
        echo json_encode($response);
        exit;
    }

    // 2. Pobranie i oczyszczenie danych wejściowych
    $name = isset($_POST["name"]) ? htmlspecialchars(strip_tags(trim($_POST["name"])), ENT_QUOTES, 'UTF-8') : '';
    $email = isset($_POST["email"]) ? filter_var(trim($_POST["email"]), FILTER_SANITIZE_EMAIL) : '';
    $message = isset($_POST["message"]) ? htmlspecialchars(strip_tags(trim($_POST["message"])), ENT_QUOTES, 'UTF-8') : '';
    
    // Pola dodatkowe
    $from_scratch = (isset($_POST['from_scratch']) && $_POST['from_scratch'] === 'tak') ? 'Tak' : 'Nie (ma podstawy)';
    $purpose = isset($_POST['purpose']) ? htmlspecialchars(strip_tags(trim($_POST['purpose'])), ENT_QUOTES, 'UTF-8') : 'Nie podano';

    // 3. Rygorystyczna walidacja
    if (empty($name) || empty($message) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $response['message'] = 'Proszę wypełnić wszystkie pola poprawnie.';
        echo json_encode($response);
        exit;
    }

    // 4. Treść wiadomości e-mail (z uwzględnieniem proxy Cloudflare)
    $clientIp = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? 'Nieznane IP';
    $email_content = "Nowe zgłoszenie ze strony Fuego Lingua:\n\n";
    $email_content .= "Imię: $name\n";
    $email_content .= "Email: $email\n";
    $email_content .= "Czy od zera?: $from_scratch\n";
    $email_content .= "Cel nauki: $purpose\n\n";
    $email_content .= "Wiadomość:\n$message\n";
    $email_content .= "\n---\nData zgłoszenia: " . date("Y-m-d H:i:s") . "\n";
    $email_content .= "Adres IP: " . htmlspecialchars($clientIp, ENT_QUOTES, 'UTF-8') . "\n";

    // 5. Bezpieczne nagłówki e-mail
    $clean_name = str_replace(["\r", "\n"], '', $name);
    $headers = "From: no-reply@fuegolingua.pl\r\n";
    $headers .= "Reply-To: $email\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

    // 6. Wysyłka
    if (@mail($toEmail, $subject, $email_content, $headers)) {
        $response['success'] = true;
        $response['message'] = '¡Gracias! Twoja wiadomość dotarła do mnie tanecznym krokiem 💃 Odpiszę najszybciej jak to możliwe!';
    } else {
        $response['message'] = 'Ay, caramba! Coś poszło nie tak podczas wysyłania 🌵 Spróbuj ponownie lub zadzwoń do mnie bezpośrednio.';
    }
} else {
    $response['message'] = 'Nieprawidłowe żądanie.';
}

echo json_encode($response);
?>
