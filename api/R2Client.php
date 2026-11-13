<?php
declare(strict_types=1);

namespace TwojaStronaWWW\Api;

/**
 * Lekki, bezbiblioteczny klient Cloudflare R2 oparty na autoryzacji AWS S3 SigV4.
 * Zero zewnętrznych zależności (brak aws-sdk, brak guzzle).
 * Obsługuje bezpośrednie operacje obiektowe (PUT/GET/HEAD/DELETE) oraz Presigned URLs (wzorzec z sejf-vod).
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
     * Waliduje i normalizuje klucz obiektu Cloudflare R2.
     * Usuwa wiodące/końcowe '/', blokuje '..', '\', znaki kontrolne ASCII oraz puste klucze.
     */
    public function sanitizeObjectKey(string $key): string
    {
        if (preg_match('/[\x00-\x1F\x7F]/', $key) === 1 || strpos($key, '\\') !== false) {
            throw new \InvalidArgumentException('Invalid R2 object key: control characters or backslashes are forbidden.');
        }

        $trimmed = trim($key);
        $trimmed = trim($trimmed, '/');
        if ($trimmed === '') {
            throw new \InvalidArgumentException('Invalid R2 object key: key cannot be empty.');
        }

        if (strpos($trimmed, '..') !== false) {
            throw new \InvalidArgumentException('Invalid R2 object key: path traversal ("..") is forbidden.');
        }

        $segments = array_values(array_filter(
            array_map('trim', explode('/', $trimmed)),
            static fn(string $seg): bool => $seg !== '' && $seg !== '.'
        ));

        $normalized = implode('/', $segments);
        if ($normalized === '' || strlen($normalized) > 512) {
            throw new \InvalidArgumentException('Invalid R2 object key: normalized key length out of bounds.');
        }

        return $normalized;
    }

    /**
     * Generuje podpisany Presigned GET URL (AWS Signature V4, UNSIGNED-PAYLOAD) do bezpiecznego pobierania obiektu z R2.
     */
    public function createPresignedGetUrl(string $key, int $expiresInSeconds = 3600, ?int $nowTimestamp = null): string
    {
        return $this->buildPresignedUrl('GET', $key, $expiresInSeconds, $nowTimestamp);
    }

    /**
     * Generuje podpisany Presigned PUT URL (AWS Signature V4, UNSIGNED-PAYLOAD) do bezpośredniego przesyłania pliku do R2.
     */
    public function createPresignedPutUrl(
        string $key,
        int|string $expiresOrContentType = 3600,
        int|string|null $contentTypeOrExpires = null,
        ?int $nowTimestamp = null
    ): string {
        $expiresInSeconds = 3600;
        if (is_int($expiresOrContentType)) {
            $expiresInSeconds = $expiresOrContentType;
        } elseif (is_int($contentTypeOrExpires)) {
            $expiresInSeconds = $contentTypeOrExpires;
        }
        return $this->buildPresignedUrl('PUT', $key, $expiresInSeconds, $nowTimestamp);
    }

    /**
     * Wysyła plik do bucketu Cloudflare R2.
     */
    public function putObject(string $key, string $content, string $contentType = 'application/octet-stream'): bool
    {
        $this->lastError = null;
        $this->lastStatusCode = null;

        $safeKey = $this->sanitizeObjectKey($key);
        $host = "{$this->accountId}.r2.cloudflarestorage.com";
        $uri = '/' . rawurlencode($this->bucketName) . '/' . $this->encodeKey($safeKey);

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

        $safeKey = $this->sanitizeObjectKey($key);
        $host = "{$this->accountId}.r2.cloudflarestorage.com";
        $uri = '/' . rawurlencode($this->bucketName) . '/' . $this->encodeKey($safeKey);

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

        $safeKey = $this->sanitizeObjectKey($key);
        $host = "{$this->accountId}.r2.cloudflarestorage.com";
        $uri = '/' . rawurlencode($this->bucketName) . '/' . $this->encodeKey($safeKey);

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
        $safeKey = $this->sanitizeObjectKey($key);
        $host = "{$this->accountId}.r2.cloudflarestorage.com";
        $uri = '/' . rawurlencode($this->bucketName) . '/' . $this->encodeKey($safeKey);

        $response = $this->sendRequest('DELETE', $host, $uri, '', '');
        return ($response['status'] >= 200 && $response['status'] < 300) || $response['status'] === 404;
    }

    private function encodeKey(string $key): string
    {
        $segments = explode('/', $key);
        $encodedSegments = array_map('rawurlencode', $segments);
        return implode('/', $encodedSegments);
    }

    private function deriveSigningKey(string $dateStamp, string $service = 's3'): string
    {
        $kDate = hash_hmac('sha256', $dateStamp, 'AWS4' . $this->secretAccessKey, true);
        $kRegion = hash_hmac('sha256', $this->region, $kDate, true);
        $kService = hash_hmac('sha256', $service, $kRegion, true);
        return hash_hmac('sha256', 'aws4_request', $kService, true);
    }

    private function buildPresignedUrl(string $method, string $key, int $expiresInSeconds, ?int $nowTimestamp): string
    {
        $safeKey = $this->sanitizeObjectKey($key);
        if ($this->accountId === '' || $this->accessKeyId === '' || $this->secretAccessKey === '' || $this->bucketName === '') {
            throw new \RuntimeException('Missing Cloudflare R2 credentials (accountId, accessKeyId, secretAccessKey, bucketName).');
        }

        $expires = min(max($expiresInSeconds, 60), 86400);
        $now = $nowTimestamp ?? time();
        $amzDate = gmdate('Ymd\THis\Z', $now);
        $dateStamp = gmdate('Ymd', $now);
        $service = 's3';

        $host = "{$this->accountId}.r2.cloudflarestorage.com";
        $canonicalUri = '/' . rawurlencode($this->bucketName) . '/' . $this->encodeKey($safeKey);
        $credentialScope = "{$dateStamp}/{$this->region}/{$service}/aws4_request";
        $credential = "{$this->accessKeyId}/{$credentialScope}";

        $queryParams = [
            'X-Amz-Algorithm'     => 'AWS4-HMAC-SHA256',
            'X-Amz-Credential'    => $credential,
            'X-Amz-Date'          => $amzDate,
            'X-Amz-Expires'       => (string)$expires,
            'X-Amz-SignedHeaders' => 'host',
        ];
        ksort($queryParams);

        $encodedPairs = [];
        foreach ($queryParams as $k => $v) {
            $encodedPairs[] = rawurlencode($k) . '=' . rawurlencode($v);
        }
        $canonicalQueryString = implode('&', $encodedPairs);

        $canonicalHeaders = "host:{$host}\n";
        $signedHeaders = 'host';
        $payloadHash = 'UNSIGNED-PAYLOAD';

        $canonicalRequest = implode("\n", [
            strtoupper($method),
            $canonicalUri,
            $canonicalQueryString,
            $canonicalHeaders,
            $signedHeaders,
            $payloadHash,
        ]);

        $stringToSign = implode("\n", [
            'AWS4-HMAC-SHA256',
            $amzDate,
            $credentialScope,
            hash('sha256', $canonicalRequest),
        ]);

        $signingKey = $this->deriveSigningKey($dateStamp, $service);
        $signature = hash_hmac('sha256', $stringToSign, $signingKey);

        return "https://{$host}{$canonicalUri}?{$canonicalQueryString}&X-Amz-Signature={$signature}";
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

        $signingKey = $this->deriveSigningKey($dateStamp, $service);
        $signature = hash_hmac('sha256', $stringToSign, $signingKey);

        $authorization = "AWS4-HMAC-SHA256 Credential={$this->accessKeyId}/{$credentialScope}, SignedHeaders={$signedHeaders}, Signature={$signature}";

        $curlHeaders = [];
        foreach ($headers as $k => $v) {
            $curlHeaders[] = "{$k}: {$v}";
        }
        $curlHeaders[] = "Authorization: {$authorization}";

        $url = "https://{$host}{$uri}";

        // [REF-05] SSRF Guard — blokada wywołań do metadanych chmury (169.254.169.254) i adresów prywatnych
        if (
            strpos($host, '169.254.169.254') !== false ||
            strpos($host, '169.254.') === 0 ||
            !preg_match('/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.r2\.cloudflarestorage\.com$/i', $host)
        ) {
            $this->lastStatusCode = 0;
            $this->lastError = 'SSRF Guard: Blocked non-R2 or link-local metadata host';
            return ['status' => 0, 'body' => $this->lastError];
        }

        if (session_status() === PHP_SESSION_ACTIVE) {
            @session_write_close();
        }

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
        unset($ch);

        $this->lastStatusCode = $statusCode;

        if ($curlError !== '') {
            $this->lastError = "cURL Error: {$curlError}";
            return ['status' => 0, 'body' => $curlError];
        }

        $responseBody = (string)$body;
        if (strlen($responseBody) > self::MAX_RESPONSE_BYTES) {
            $this->lastError = 'R2 response exceeded MAX_RESPONSE_BYTES limit';
            $responseBody = substr($responseBody, 0, self::MAX_RESPONSE_BYTES);
        }

        return ['status' => $statusCode, 'body' => $responseBody];
    }
}
