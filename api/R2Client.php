<?php
declare(strict_types=1);

namespace TwojaStronaWWW\Api;

/**
 * Lekki, bezbiblioteczny klient Cloudflare R2 oparty na autoryzacji AWS S3 SigV4.
 * Zero zewnętrznych zależności (brak aws-sdk, brak guzzle).
 */
class R2Client
{
    public const MAX_RESPONSE_BYTES = 10485760;

    private string $accountId;
    private string $accessKeyId;
    private string $secretAccessKey;
    private string $bucketName;
    private string $region;
    private ?string $lastError = null;
    private ?int $lastStatusCode = null;

    public function __construct(
        string $accountId,
        string $accessKeyId,
        string $secretAccessKey,
        string $bucketName,
        string $region = 'auto'
    ) {
        $this->accountId = trim($accountId);
        $this->accessKeyId = trim($accessKeyId);
        $this->secretAccessKey = trim($secretAccessKey);
        $this->bucketName = trim($bucketName);
        $this->region = trim($region) !== '' ? trim($region) : 'auto';
    }

    public function getLastError(): ?string
    {
        return $this->lastError;
    }

    public function getLastStatusCode(): ?int
    {
        return $this->lastStatusCode;
    }

    /**
     * Wysyła plik do bucketu Cloudflare R2.
     */
    public function putObject(string $key, string $content, string $contentType = 'application/octet-stream'): bool
    {
        $this->lastError = null;
        $this->lastStatusCode = null;

        $key = ltrim($key, '/');
        $host = "{$this->accountId}.r2.cloudflarestorage.com";
        $uri = '/' . rawurlencode($this->bucketName) . '/' . $this->encodeKey($key);

        $response = $this->sendRequest('PUT', $host, $uri, $content, $contentType);

        if ($response['status'] >= 200 && $response['status'] < 300) {
            return true;
        }

        $this->lastError = "Błąd przesyłania R2 HTTP {$response['status']}: {$response['body']}";
        return false;
    }

    /**
     * Pobiera zawartość obiektu z Cloudflare R2.
     */
    public function getObject(string $key): ?string
    {
        $this->lastError = null;
        $this->lastStatusCode = null;

        $key = ltrim($key, '/');
        $host = "{$this->accountId}.r2.cloudflarestorage.com";
        $uri = '/' . rawurlencode($this->bucketName) . '/' . $this->encodeKey($key);

        $response = $this->sendRequest('GET', $host, $uri, '', 'application/octet-stream');

        if ($response['status'] >= 200 && $response['status'] < 300) {
            return $response['body'];
        }

        $this->lastError = "Błąd odczytu R2 HTTP {$response['status']}: {$response['body']}";
        return null;
    }

    /**
     * Sprawdza, czy obiekt istnieje w Cloudflare R2 (żądanie HEAD).
     */
    public function hasObject(string $key): bool
    {
        $this->lastError = null;
        $this->lastStatusCode = null;

        $key = ltrim($key, '/');
        $host = "{$this->accountId}.r2.cloudflarestorage.com";
        $uri = '/' . rawurlencode($this->bucketName) . '/' . $this->encodeKey($key);

        $response = $this->sendRequest('HEAD', $host, $uri, '', 'application/octet-stream');

        return $response['status'] >= 200 && $response['status'] < 300;
    }

    /**
     * Sprawdza połączenie z bucketem.
     */
    public function testConnection(): bool
    {
        $testKey = '.test-connection-' . bin2hex(random_bytes(4));
        $success = $this->putObject($testKey, 'ok', 'text/plain');
        if ($success) {
            $this->deleteObject($testKey);
        }
        return $success;
    }

    /**
     * Usuwa obiekt z bucketu R2.
     */
    public function deleteObject(string $key): bool
    {
        $key = ltrim($key, '/');
        $host = "{$this->accountId}.r2.cloudflarestorage.com";
        $uri = '/' . rawurlencode($this->bucketName) . '/' . $this->encodeKey($key);

        $response = $this->sendRequest('DELETE', $host, $uri, '', '');
        return ($response['status'] >= 200 && $response['status'] < 300) || $response['status'] === 404;
    }

    private function encodeKey(string $key): string
    {
        $segments = explode('/', $key);
        $encodedSegments = array_map('rawurlencode', $segments);
        return implode('/', $encodedSegments);
    }

    private function sendRequest(string $method, string $host, string $uri, string $payload, string $contentType): array
    {
        $service = 's3';
        $now = time();
        $amzDate = gmdate('Ymd\THis\Z', $now);
        $dateStamp = gmdate('Ymd', $now);

        $payloadHash = hash('sha256', $payload);

        $headers = [
            'host' => $host,
            'x-amz-content-sha256' => $payloadHash,
            'x-amz-date' => $amzDate,
        ];

        if ($contentType !== '' && $method !== 'DELETE') {
            $headers['content-type'] = $contentType;
        }

        ksort($headers);

        $canonicalHeaders = '';
        $signedHeaderList = [];
        foreach ($headers as $k => $v) {
            $canonicalHeaders .= strtolower($k) . ':' . trim((string)$v) . "\n";
            $signedHeaderList[] = strtolower($k);
        }
        $signedHeaders = implode(';', $signedHeaderList);

        $canonicalRequest = implode("\n", [
            $method,
            $uri,
            '',
            $canonicalHeaders,
            $signedHeaders,
            $payloadHash,
        ]);

        $credentialScope = "{$dateStamp}/{$this->region}/{$service}/aws4_request";
        $stringToSign = implode("\n", [
            'AWS4-HMAC-SHA256',
            $amzDate,
            $credentialScope,
            hash('sha256', $canonicalRequest),
        ]);

        $kDate = hash_hmac('sha256', $dateStamp, 'AWS4' . $this->secretAccessKey, true);
        $kRegion = hash_hmac('sha256', $this->region, $kDate, true);
        $kService = hash_hmac('sha256', $service, $kRegion, true);
        $kSigning = hash_hmac('sha256', 'aws4_request', $kService, true);
        $signature = hash_hmac('sha256', $stringToSign, $kSigning);

        $authorization = "AWS4-HMAC-SHA256 Credential={$this->accessKeyId}/{$credentialScope}, SignedHeaders={$signedHeaders}, Signature={$signature}";

        $curlHeaders = [];
        foreach ($headers as $k => $v) {
            $curlHeaders[] = "{$k}: {$v}";
        }
        $curlHeaders[] = "Authorization: {$authorization}";

        $url = "https://{$host}{$uri}";

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $curlHeaders);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
        curl_setopt($ch, CURLOPT_MAXREDIRS, 0);
        if (defined('CURLPROTO_HTTPS')) {
            curl_setopt($ch, CURLOPT_PROTOCOLS, CURLPROTO_HTTPS);
            curl_setopt($ch, CURLOPT_REDIR_PROTOCOLS, CURLPROTO_HTTPS);
        }

        if ($method === 'HEAD') {
            curl_setopt($ch, CURLOPT_NOBODY, true);
        } elseif ($method === 'PUT' || $method === 'POST') {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        }

        $body = curl_exec($ch);
        $statusCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        $this->lastStatusCode = $statusCode;

        if ($curlError !== '') {
            $this->lastError = "cURL Error: {$curlError}";
            return ['status' => 0, 'body' => $curlError];
        }

        return ['status' => $statusCode, 'body' => (string)$body];
    }
}
