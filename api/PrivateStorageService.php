<?php
declare(strict_types=1);

namespace TwojaStronaWWW\Api;

require_once __DIR__ . '/R2Client.php';

/**
 * Serwis do zarządzania prywatnym, autoryzowanym magazynem w Cloudflare R2 (Zero Public Access).
 * Służy do automatycznego Off-Site Backupu leadów CSV i migawek danych (ISO 27001).
 */
class PrivateStorageService
{
    private ?R2Client $client = null;
    private string $bucketName;

    public function __construct(
        string $accountId = '',
        string $accessKey = '',
        string $secretKey = '',
        string $bucketName = ''
    ) {
        $acc = $accountId !== '' ? $accountId : (string)(getenv('R2_ACCOUNT_ID') ?: ($_ENV['R2_ACCOUNT_ID'] ?? ''));
        $key = $accessKey !== '' ? $accessKey : (string)(getenv('R2_ACCESS_KEY_ID') ?: ($_ENV['R2_ACCESS_KEY_ID'] ?? ''));
        $sec = $secretKey !== '' ? $secretKey : (string)(getenv('R2_SECRET_ACCESS_KEY') ?: ($_ENV['R2_SECRET_ACCESS_KEY'] ?? ''));
        $bkt = $bucketName !== '' ? $bucketName : (string)(getenv('R2_PRIVATE_BUCKET_NAME') ?: ($_ENV['R2_PRIVATE_BUCKET_NAME'] ?? ''));

        $this->bucketName = trim($bkt);

        if ($acc !== '' && $key !== '' && $sec !== '' && $this->bucketName !== '') {
            $this->client = new R2Client($acc, $key, $sec, $this->bucketName, 'auto');
        }
    }

    public function isAvailable(): bool
    {
        return $this->client !== null;
    }

    /**
     * Tworzy kopię zapasową pliku CSV leadów w prywatnym buckecie R2
     * (zarówno kopię główną leads/leady.csv, jak i migawkę dzienną).
     */
    public function backupLeads(string $localCsvPath): bool
    {
        if (!$this->isAvailable() || !file_exists($localCsvPath)) {
            return false;
        }

        $fp = @fopen($localCsvPath, 'rb');
        if (!$fp) {
            return false;
        }

        $content = '';
        if (@flock($fp, LOCK_SH)) {
            $content = (string)stream_get_contents($fp);
            @flock($fp, LOCK_UN);
        }
        fclose($fp);

        if ($content === '') {
            return false;
        }

        $uploadedMaster = $this->client->putObject('leads/leady.csv', $content, 'text/csv; charset=UTF-8');
        $dateKey = 'leads/archive/leady_' . date('Y-m-d') . '.csv';
        $this->client->putObject($dateKey, $content, 'text/csv; charset=UTF-8');

        return $uploadedMaster;
    }

    /**
     * Pobiera najnowszą kopię główną pliku CSV leadów z prywatnego bucketa R2.
     */
    public function fetchLatestLeads(): ?string
    {
        if (!$this->isAvailable()) {
            return null;
        }
        return $this->client->getObject('leads/leady.csv');
    }

    /**
     * Odtwarza lokalny plik CSV z prywatnego R2, jeśli plik lokalny nie istnieje lub jest pusty.
     */
    public function restoreLeadsIfMissing(string $localCsvPath): bool
    {
        if (file_exists($localCsvPath) && (int)@filesize($localCsvPath) > 10) {
            return true;
        }

        $remoteContent = $this->fetchLatestLeads();
        if ($remoteContent === null || trim($remoteContent) === '') {
            return false;
        }

        $dir = dirname($localCsvPath);
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }

        $tmpPath = $localCsvPath . '.tmp.' . getmypid() . '.' . bin2hex(random_bytes(4));
        $fp = @fopen($tmpPath, 'wb');
        if (!$fp) {
            return false;
        }

        fwrite($fp, $remoteContent);
        fflush($fp);
        fclose($fp);

        return @rename($tmpPath, $localCsvPath);
    }
}
