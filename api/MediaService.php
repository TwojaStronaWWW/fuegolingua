<?php
declare(strict_types=1);

namespace TwojaStronaWWW\Api;

require_once __DIR__ . '/R2Client.php';
require_once __DIR__ . '/leads-store.php';

/**
 * Serwis optymalizacji multimediów (ścisła walidacja MIME, konwersja GD do WebP i wysyłka do Cloudflare R2).
 */
class MediaService
{
    private ?R2Client $r2Client;
    private string $cdnBaseUrl;

    public function __construct(?R2Client $r2Client = null, string $cdnBaseUrl = '')
    {
        if ($r2Client === null) {
            $acc = \get_env_secret('R2_ACCOUNT_ID');
            $key = \get_env_secret('R2_ACCESS_KEY_ID');
            $sec = \get_env_secret('R2_SECRET_ACCESS_KEY');
            $bkt = \get_env_secret('R2_BUCKET_NAME', 'twojastronawww-media');
            if ($acc !== '' && $key !== '' && $sec !== '' && $bkt !== '') {
                $r2Client = new R2Client($acc, $key, $sec, $bkt, 'auto');
            }
        }
        $this->r2Client = $r2Client;
        $defaultCdn = \get_env_secret('R2_PUBLIC_URL', \get_env_secret('CDN_BASE_URL', 'https://media.twojastronawww.pl'));
        $this->cdnBaseUrl = rtrim($cdnBaseUrl !== '' ? $cdnBaseUrl : $defaultCdn, '/');
    }

    /**
     * Waliduje plik tymczasowy, konwertuje obrazy (JPG/PNG/GIF) do formatu WebP (max 1920px)
     * i przesyła bezpośrednio do Cloudflare R2.
     */
    public function processAndUpload(string $tmpFilePath, string $originalName, string $target = 'gallery'): array
    {
        if (!file_exists($tmpFilePath) || !is_readable($tmpFilePath)) {
            return ['status' => 'error', 'message' => 'Plik tymczasowy nie istnieje lub jest nieczytelny.'];
        }

        $target = ($target === 'content') ? 'content' : 'gallery';

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = $finfo ? (string)finfo_file($finfo, $tmpFilePath) : '';
        unset($finfo);

        $allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        $allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg'];
        $allowedTypes = array_merge($allowedImageTypes, $allowedVideoTypes);

        if (!in_array($mimeType, $allowedTypes, true)) {
            return ['status' => 'error', 'message' => "Nieobsługiwany format pliku ({$mimeType}). Dozwolone: JPG, PNG, WEBP, MP4."];
        }

        $isImage = in_array($mimeType, $allowedImageTypes, true);
        $ext = $isImage ? 'webp' : strtolower((string)pathinfo($originalName, PATHINFO_EXTENSION));
        if (!$isImage && $ext === '') {
            $ext = 'mp4';
        }

        $prefix = $isImage ? 'img_' : 'vid_';
        $filename = $prefix . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
        $r2Key = "{$target}/{$filename}";
        $outputMime = $isImage ? 'image/webp' : $mimeType;
        $payloadData = '';

        if ($isImage && function_exists('imagewebp')) {
            $imgDimensions = @getimagesize($tmpFilePath);
            if (
                $imgDimensions === false ||
                ($imgDimensions[0] ?? 0) > 8192 ||
                ($imgDimensions[1] ?? 0) > 8192 ||
                (($imgDimensions[0] ?? 0) * ($imgDimensions[1] ?? 0)) > 25000000
            ) {
                throw new RuntimeException('Wymiary obrazu przekraczają bezpieczny limit (maks. 8192x8192 px / 25 MP).');
            }
            $sourceImage = null;
            switch ($mimeType) {
                case 'image/jpeg':
                    $sourceImage = @imagecreatefromjpeg($tmpFilePath);
                    break;
                case 'image/png':
                    $sourceImage = @imagecreatefrompng($tmpFilePath);
                    if ($sourceImage) {
                        imagepalettetotruecolor($sourceImage);
                        imagealphablending($sourceImage, true);
                        imagesavealpha($sourceImage, true);
                    }
                    break;
                case 'image/gif':
                    $sourceImage = @imagecreatefromgif($tmpFilePath);
                    break;
                case 'image/webp':
                    $sourceImage = @imagecreatefromwebp($tmpFilePath);
                    break;
            }

            if ($sourceImage) {
                $width = imagesx($sourceImage);
                $height = imagesy($sourceImage);
                $maxWidth = 1920;

                if ($width > $maxWidth) {
                    $newWidth = $maxWidth;
                    $newHeight = (int)floor($height * ($maxWidth / $width));
                    $resized = imagecreatetruecolor($newWidth, $newHeight);
                    imagealphablending($resized, false);
                    imagesavealpha($resized, true);
                    imagecopyresampled($resized, $sourceImage, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
                    unset($sourceImage);
                    $sourceImage = $resized;
                }

                ob_start();
                imagewebp($sourceImage, null, 82);
                $payloadData = (string)ob_get_clean();
                unset($sourceImage);
            }
        }

        if ($payloadData === '') {
            $payloadData = (string)@file_get_contents($tmpFilePath);
        }

        if ($this->r2Client === null) {
            return ['status' => 'error', 'message' => 'Klient Cloudflare R2 nie jest skonfigurowany.'];
        }

        if (!$this->r2Client->putObject($r2Key, $payloadData, $outputMime)) {
            return ['status' => 'error', 'message' => 'Błąd zapisu w Cloudflare R2: ' . ($this->r2Client->getLastError() ?? 'nieznany')];
        }

        return [
            'status' => 'success',
            'url' => "{$this->cdnBaseUrl}/{$r2Key}",
            'key' => $r2Key,
            'mime' => $outputMime,
            'size' => strlen($payloadData)
        ];
    }
}
