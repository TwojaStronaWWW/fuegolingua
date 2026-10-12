<?php
declare(strict_types=1);

/**
 * TwojaStronaWWW - Narzędzie optymalizacji i migracji mediów do Cloudflare R2
 * Konwertuje lokalne obrazy (PNG, JPG) do WebP i opcjonalnie wysyła do Cloudflare R2.
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    die("Dostęp wyłącznie z CLI.\n");
}

require_once __DIR__ . '/../api/R2Client.php';
use TwojaStronaWWW\Api\R2Client;

$rootDir = dirname(__DIR__);
$outputDir = $rootDir . '/dist/media_r2';

if (!is_dir($outputDir)) {
    mkdir($outputDir, 0777, true);
}

echo "========================================================\n";
echo "🚀 TwojaStronaWWW Cloudflare R2 Media Optimizer & Tool\n";
echo "========================================================\n\n";

// Skanowanie katalogów z mediami
$mediaDirs = [
    'assets/images' => $rootDir . '/assets/images',
    'assets/cennik' => $rootDir . '/assets/cennik',
    'assets/img'    => $rootDir . '/assets/img',
];

$totalOriginalSize = 0;
$totalWebpSize = 0;
$processedFiles = [];

foreach ($mediaDirs as $label => $dirPath) {
    if (!is_dir($dirPath)) continue;

    $files = scandir($dirPath);
    foreach ($files as $file) {
        if ($file === '.' || $file === '..' || is_dir($dirPath . '/' . $file)) continue;

        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        if (!in_array($ext, ['png', 'jpg', 'jpeg', 'webp', 'svg'])) continue;

        $srcPath = $dirPath . '/' . $file;
        $fileSize = filesize($srcPath);
        $totalOriginalSize += $fileSize;

        $destFileName = pathinfo($file, PATHINFO_FILENAME) . '.webp';
        $destPath = $outputDir . '/' . $destFileName;

        if ($ext === 'svg') {
            copy($srcPath, $outputDir . '/' . $file);
            $newSize = filesize($outputDir . '/' . $file);
            $totalWebpSize += $newSize;
            $processedFiles[] = ['name' => $file, 'orig' => $fileSize, 'new' => $newSize, 'path' => $outputDir . '/' . $file, 'mime' => 'image/svg+xml'];
            continue;
        }

        if ($ext === 'webp') {
            copy($srcPath, $destPath);
            $newSize = filesize($destPath);
            $totalWebpSize += $newSize;
            $processedFiles[] = ['name' => $destFileName, 'orig' => $fileSize, 'new' => $newSize, 'path' => $destPath, 'mime' => 'image/webp'];
            continue;
        }

        // Konwersja GD do WebP z zachowaniem kanału alfa
        $image = null;
        if ($ext === 'png') {
            $image = @imagecreatefrompng($srcPath);
            if ($image) {
                imagepalettetotruecolor($image);
                imagealphablending($image, true);
                imagesavealpha($image, true);
            }
        } elseif ($ext === 'jpg' || $ext === 'jpeg') {
            $image = @imagecreatefromjpeg($srcPath);
        }

        if ($image) {
            imagewebp($image, $destPath, 85);
            imagedestroy($image);
            $newSize = filesize($destPath);
            $totalWebpSize += $newSize;
            $processedFiles[] = ['name' => $destFileName, 'orig' => $fileSize, 'new' => $newSize, 'path' => $destPath, 'mime' => 'image/webp'];
        }
    }
}

echo "📊 Podsumowanie kompresji WebP:\n";
echo "--------------------------------------------------------\n";
foreach ($processedFiles as $item) {
    $origMb = number_format($item['orig'] / 1024 / 1024, 2);
    $newKb = number_format($item['new'] / 1024, 1);
    $saving = $item['orig'] > 0 ? number_format((1 - ($item['new'] / $item['orig'])) * 100, 1) : 0;
    echo "  * {$item['name']}: {$origMb} MB -> {$newKb} KB (oszczędność: -{$saving}%)\n";
}
echo "--------------------------------------------------------\n";
$origTotalMb = number_format($totalOriginalSize / 1024 / 1024, 2);
$newTotalMb = number_format($totalWebpSize / 1024 / 1024, 2);
$totalSaving = $totalOriginalSize > 0 ? number_format((1 - ($totalWebpSize / $totalOriginalSize)) * 100, 1) : 0;
echo "ŁĄCZNIE: {$origTotalMb} MB -> {$newTotalMb} MB (redukcja o -{$totalSaving}%)\n\n";

// Sprawdzenie konfiguracji R2
$r2Account = getenv('R2_ACCOUNT_ID');
$r2KeyId = getenv('R2_ACCESS_KEY_ID');
$r2Secret = getenv('R2_SECRET_ACCESS_KEY');
$r2Bucket = getenv('R2_BUCKET_NAME') ?: 'fuegolingua-media';

if ($r2Account && $r2KeyId && $r2Secret) {
    echo "☁️ Wykryto klucze Cloudflare R2! Rozpoczynanie synchronizacji z bucketem '{$r2Bucket}'...\n";
    $r2 = new R2Client($r2Account, $r2KeyId, $r2Secret, $r2Bucket);
    $uploadSuccess = 0;
    foreach ($processedFiles as $fileInfo) {
        $content = file_get_contents($fileInfo['path']);
        if ($r2->putObject($fileInfo['name'], $content, $fileInfo['mime'])) {
            echo "  ✅ Wgrano: {$fileInfo['name']}\n";
            $uploadSuccess++;
        } else {
            echo "  ❌ Błąd {$fileInfo['name']}: " . $r2->getLastError() . "\n";
        }
    }
    echo "Synchronizacja zakończona: {$uploadSuccess}/" . count($processedFiles) . " plików w chmurze R2.\n";
} else {
    echo "ℹ️ Pliki WebP zostały przygotowane w folderze 'dist/media_r2/'.\n";
    echo "Aby automatycznie wysłać je do Cloudflare R2, ustaw zmienne środowiskowe lub utwórz bucket '{$r2Bucket}'.\n";
}
