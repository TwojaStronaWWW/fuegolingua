<?php
declare(strict_types=1);

/**
 * Cross-platform PHP Syntax Linter
 * Scans all project PHP files and validates syntax using `php -l`.
 */

$rootDir = dirname(__DIR__);
$excludeDirs = ['vendor', '.git', 'drafts', 'node_modules'];

echo "=== WERYFIKACJA SKŁADNI PHP (PHP LINT) ===\n";

$iterator = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($rootDir, RecursiveDirectoryIterator::SKIP_DOTS)
);

$filesChecked = 0;
$errors = [];

foreach ($iterator as $path => $file) {
    if ($file->isDir()) {
        continue;
    }

    $relative = str_replace([$rootDir . DIRECTORY_SEPARATOR, $rootDir . '/'], '', $path);
    $parts = explode(DIRECTORY_SEPARATOR, str_replace('/', DIRECTORY_SEPARATOR, $relative));

    $isExcluded = false;
    foreach ($parts as $p) {
        if (in_array($p, $excludeDirs, true)) {
            $isExcluded = true;
            break;
        }
    }
    if ($isExcluded) {
        continue;
    }

    if ($file->getExtension() === 'php') {
        $filesChecked++;
        $cmd = escapeshellcmd(PHP_BINARY) . ' -l ' . escapeshellarg($path);
        $output = [];
        $returnCode = 0;
        exec($cmd, $output, $returnCode);

        if ($returnCode !== 0) {
            $errors[] = [
                'file' => $relative,
                'output' => implode("\n", $output)
            ];
            echo "  ❌ BŁĄD: $relative\n";
        }
    }
}

echo "Przeskanowano plików PHP: $filesChecked\n";

if (!empty($errors)) {
    echo "❌ Wykryto błędy składni w " . count($errors) . " plikach:\n";
    foreach ($errors as $e) {
        echo "Plik: {$e['file']}\n{$e['output']}\n\n";
    }
    exit(1);
}

$piiGuardFile = $rootDir . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'pii-guard.php';
if (is_file($piiGuardFile)) {
    require_once $piiGuardFile;

    // 1. Test maskowania polskich adresów ulicznych (<ADRES_1>) oraz PESEL
    $sample = 'Zgłoszenie: PESEL 44051401458, zam. ul. Marszałkowska 10/4 oraz al. Jana Pawła II 24a m. 12 w Warszawie.';
    $maskedRes = mask_sensitive_pl_pii($sample);
    if (
        strpos($maskedRes['masked'], '<PESEL_1>') === false ||
        strpos($maskedRes['masked'], '<ADRES_1>') === false ||
        strpos($maskedRes['masked'], '<ADRES_2>') === false ||
        ($maskedRes['replacements']['<ADRES_1>'] ?? '') !== 'ul. Marszałkowska 10/4' ||
        ($maskedRes['replacements']['<ADRES_2>'] ?? '') !== 'al. Jana Pawła II 24a m. 12'
    ) {
        echo "❌ BŁĄD ASERCJI PII GUARD: Niepoprawne maskowanie adresów ulicznych lub PESEL.\n";
        exit(1);
    }

    // 2. Test odporności wzorca adresowego na ReDoS (limit <= 8 słów ulicy)
    $redosInput = 'ul. ' . str_repeat('Krakowska ', 60) . 'bez numeru lokalu!';
    $t0 = microtime(true);
    $redosRes = mask_sensitive_pl_pii($redosInput);
    $elapsedMs = (microtime(true) - $t0) * 1000.0;
    if ($elapsedMs > 100.0 || $redosRes['count'] !== 0) {
        echo "❌ BŁĄD ASERCJI PII GUARD: Wzorzec adresowy przekroczył budżet czasu ReDoS ({$elapsedMs} ms).\n";
        exit(1);
    }

    // 3. Test restore_stream_chunk i flush_stream_restorer (StreamRestorer port z polanon)
    $carry = '';
    $replacements = [
        '<PESEL_1>' => '44051401458',
        '<OSOBA_1>' => 'Jan Kowalski',
        '<ADRES_1>' => 'ul. Marszałkowska 10/4',
    ];
    $out1 = restore_stream_chunk('Klient <OSO', $carry, $replacements);
    $out2 = restore_stream_chunk('BA_1> (PESEL: <PESEL_', $carry, $replacements);
    $out3 = restore_stream_chunk('1>) mieszka przy <ADRES_1>. <NIEDOMKNIETY_1', $carry, $replacements);
    $out4 = flush_stream_restorer($carry, $replacements);
    $fullRestored = $out1 . $out2 . $out3 . $out4;
    $expectedRestored = 'Klient Jan Kowalski (PESEL: 44051401458) mieszka przy ul. Marszałkowska 10/4. <NIEDOMKNIETY_1';

    if ($fullRestored !== $expectedRestored || $carry !== '') {
        echo "❌ BŁĄD ASERCJI STREAM RESTORER: Otrzymano '$fullRestored', oczekiwano '$expectedRestored'.\n";
        exit(1);
    }
    echo "✅ Asercje jednostkowe api/pii-guard.php (PESEL, ADRES ReDoS-safe, StreamRestorer) zakończone sukcesem.\n";
}

echo "✅ Wszystkie pliki PHP są poprawne syntaktycznie.\n";
exit(0);
