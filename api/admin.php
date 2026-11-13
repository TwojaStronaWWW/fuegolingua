<?php
declare(strict_types=1);

/**
 * Panel Leadów i Zgód RODO (ISO 27001 — Zero zahardkodowanych sekretów w repozytorium).
 * Wymaga ustawienia ADMIN_PASSWORD_HASH (bcrypt) lub ADMIN_PIN w pliku .env poza webrootem.
 */

$sessionDir = __DIR__ . '/sessions';
if (!file_exists($sessionDir)) {
    @mkdir($sessionDir, 0755, true);
}
ini_set('session.save_path', $sessionDir);
ini_set('session.use_strict_mode', '1');
ini_set('session.cookie_httponly', '1');

$isSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (!empty($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443);

session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $isSecure,
    'httponly' => true,
    'samesite' => 'Strict'
]);

@session_start();

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-Robots-Tag: noindex, nofollow');
header('Referrer-Policy: same-origin');
header('Cache-Control: no-store, no-cache, must-revalidate');
header("Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");

require_once __DIR__ . '/rate-limit.php';
require_once __DIR__ . '/leads-store.php';
require_once __DIR__ . '/csrf.php';

$SESSION_TTL = 1800;
$clientIp = resolve_trusted_client_ip();
$maskedIp = mask_ip($clientIp);

// [REF-05] Ochrona OWASP Fetch Metadata (Sec-Fetch-Site) oraz limit rozmiaru żądania (CONTENT_LENGTH <= 65536) dla POST
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : 0;
    if ($contentLength > 65536) {
        @session_write_close();
        http_response_code(413);
        exit('413 Payload Too Large.');
    }
    if (isset($_SERVER['HTTP_SEC_FETCH_SITE']) && strtolower(trim((string)$_SERVER['HTTP_SEC_FETCH_SITE'])) === 'cross-site') {
        @session_write_close();
        http_response_code(403);
        exit('403 Forbidden: Cross-Site Request Blocked.');
    }
}

// Bezpieczne wylogowanie wyłącznie metodą POST z weryfikacją tokenu CSRF (ochrona przed Cross-Site Logout)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['logout'])) {
    if (csrf_check((string)($_POST['csrf_token'] ?? ''))) {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(),
                '',
                time() - 42000,
                $params['path'] ?? '/',
                $params['domain'] ?? '',
                (bool)($params['secure'] ?? false),
                (bool)($params['httponly'] ?? true)
            );
        }
        session_destroy();
    } else {
        @session_write_close();
    }
    header('Location: admin.php');
    exit;
}

$adminHash = get_env_secret('ADMIN_PASSWORD_HASH');
$adminPin  = get_env_secret('ADMIN_PIN');
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['pin'])) {
    if (is_client_ip_banned($clientIp)) {
        http_response_code(403);
        $error = 'Adres IP został tymczasowo zablokowany (15 min).';
    } elseif (!csrf_check((string)($_POST['csrf_token'] ?? ''))) {
        http_response_code(403);
        $error = 'Sesja formularza wygasła. Odśwież stronę i spróbuj ponownie.';
    } elseif (!rate_limit('admin_login_' . $maskedIp, 5, 300, $clientIp)) {
        http_response_code(429);
        $error = 'Zbyt wiele prób logowania. Odczekaj 5 minut.';
    } else {
        $inputPin = (string)$_POST['pin'];
        $valid = false;
        if ($adminHash !== '' && password_verify($inputPin, $adminHash)) {
            $valid = true;
        } elseif ($adminPin !== '' && hash_equals($adminPin, $inputPin)) {
            $valid = true;
        }

        if ($valid) {
            session_regenerate_id(true);
            $_SESSION['auth'] = true;
            $_SESSION['auth_at'] = time();
            unset($_SESSION['csrf_token']);
            @session_write_close();
            header('Location: admin.php');
            exit;
        }
        $error = 'Nieprawidłowy klucz dostępu.';
    }
}

$isAuthenticated = !empty($_SESSION['auth']) && $_SESSION['auth'] === true;
if ($isAuthenticated && (time() - (int)($_SESSION['auth_at'] ?? 0) > $SESSION_TTL)) {
    session_destroy();
    $isAuthenticated = false;
    $error = 'Sesja wygasła. Zaloguj się ponownie.';
}

if ($isAuthenticated) {
    $_SESSION['auth_at'] = time();

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['delete_id'])) {
        $tokenOk = csrf_check((string)($_POST['csrf_token'] ?? ''));
        $csrf = csrf_token();
        @session_write_close();
        if ($tokenOk) {
            delete_lead_by_id((string)$_POST['delete_id']);
        }
        header('Location: admin.php');
        exit;
    }

    if (isset($_GET['export']) && $_GET['export'] === 'csv') {
        @session_write_close();
        $leads = read_leads(false, 5000);
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="leads_export_' . date('Y-m-d') . '.csv"');
        $out = fopen('php://output', 'wb');
        if ($out) {
            fputcsv($out, ['date', 'time', 'name', 'email', 'message', 'ip_hash', 'phone', 'newsletter'], ',', '"', '');
            foreach ($leads as $row) {
                fputcsv($out, $row, ',', '"', '');
            }
            fclose($out);
        }
        exit;
    }

    $csrf = csrf_token();
    @session_write_close();
    $leads = read_leads(false);
    $newsletterCount = count(array_filter($leads, static fn($l) => ($l[7] ?? 'NIE') === 'TAK'));
    ?>
<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Panel Leadów i Zgód RODO</title>
<style>
body { font-family: system-ui, sans-serif; padding: 20px; background: #0f172a; color: #f8fafc; }
table { border-collapse: collapse; width: 100%; max-width: 1320px; background: #1e293b; border-radius: 8px; overflow: hidden; }
th, td { border: 1px solid #334155; padding: 12px; text-align: left; font-size: 14px; }
th { background: #0f172a; color: #94a3b8; }
.top-actions { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
.inline-form { display: inline; margin: 0; }
.btn { background: #2563eb; color: #fff; text-decoration: none; padding: 8px 14px; border-radius: 6px; font-size: 13px; border: none; cursor: pointer; }
.btn-del { background: #ef4444; }
</style>
</head>
<body>
<div class="top-actions">
    <strong>Zebrane zapytania: <?= count($leads) ?> | Zgody Newsletter (TAK): <?= $newsletterCount ?></strong>
    <a href="?export=csv" class="btn">Eksportuj CSV</a>
    <form method="post" action="admin.php" class="inline-form">
        <input type="hidden" name="logout" value="1">
        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrf) ?>">
        <button type="submit" class="btn btn-del">Wyloguj</button>
    </form>
</div>
<table>
<tr><th>Data</th><th>Imię</th><th>E-mail</th><th>Telefon</th><th>Newsletter</th><th>Wiadomość</th><th>RODO (Art. 17)</th></tr>
<?php foreach ($leads as $l): ?>
<tr>
    <td><?= htmlspecialchars(($l[0] ?? '') . ' ' . ($l[1] ?? '')) ?></td>
    <td><?= htmlspecialchars((string)($l[2] ?? '')) ?></td>
    <td><?= htmlspecialchars((string)($l[3] ?? '')) ?></td>
    <td><?= htmlspecialchars((string)($l[6] ?? '-')) ?></td>
    <td><?= htmlspecialchars((string)($l[7] ?? 'NIE')) ?></td>
    <td><?= htmlspecialchars(mb_substr((string)($l[4] ?? ''), 0, 140)) ?></td>
    <td>
        <form method="post" action="admin.php" class="inline-form">
            <input type="hidden" name="delete_id" value="<?= htmlspecialchars(lead_id($l)) ?>">
            <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrf) ?>">
            <button type="submit" class="btn btn-del">Usuń</button>
        </form>
    </td>
</tr>
<?php endforeach; ?>
</table>
</body>
</html>
    <?php
    exit;
}

$loginCsrf = csrf_token();
@session_write_close();
?>
<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Logowanie — Panel RODO</title>
<style>
body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
form { background: #1e293b; padding: 28px; border-radius: 12px; border: 1px solid #334155; width: 320px; }
input { width: 100%; box-sizing: border-box; padding: 10px; margin: 12px 0; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; }
button { width: 100%; padding: 10px; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; }
.err { color: #f87171; font-size: 13px; }
</style>
</head>
<body>
<form method="post" action="admin.php">
    <h2>Panel Leadów RODO</h2>
    <?php if ($error !== ''): ?><p class="err"><?= htmlspecialchars($error) ?></p><?php endif; ?>
    <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($loginCsrf) ?>">
    <input type="password" name="pin" placeholder="Klucz dostępu (.env)" required autocomplete="current-password">
    <button type="submit">Zaloguj</button>
</form>
</body>
</html>
