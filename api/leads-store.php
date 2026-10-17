<?php
declare(strict_types=1);

function csv_files(): array {
    return glob(__DIR__ . '/leads_*.csv') ?: [];
}

function is_draft_file(string $file): bool {
    return strpos(basename($file), '_draft_') !== false;
}

/**
 * Normalizuje wiersz CSV (kompatybilność wsteczna 6 kolumn -> 8 kolumn:
 * [0]=date, [1]=time, [2]=name, [3]=email, [4]=message, [5]=ip_hash, [6]=phone, [7]=newsletter)
 */
function normalize_lead_row(array $row): ?array {
    if (count($row) === 6) {
        return [$row[0], $row[1], $row[2], $row[3], $row[4], $row[5], '-', 'NIE'];
    }
    if (count($row) >= 8) {
        return array_slice($row, 0, 8);
    }
    return null;
}

function read_leads(bool $draft = false, int $limit = 200): array {
    $rows = [];
    $files = csv_files();
    rsort($files);

    foreach ($files as $file) {
        if ($draft !== is_draft_file($file)) {
            continue;
        }

        if (($h = fopen($file, 'r')) === false) {
            continue;
        }

        $fileRows = [];
        fgetcsv($h);

        while (($row = fgetcsv($h)) !== false) {
            $normalized = normalize_lead_row($row);
            if ($normalized !== null) {
                array_unshift($fileRows, $normalized);
            }
        }
        fclose($h);

        foreach ($fileRows as $r) {
            $rows[] = $r;
            if (count($rows) >= $limit) {
                break 2;
            }
        }

        if (count($rows) >= $limit) {
            break;
        }
    }
    return $rows;
}

function lead_id(array $row): string {
    $normalized = normalize_lead_row($row) ?? $row;
    return hash('sha256', implode('|', array_slice($normalized, 0, 6)));
}

function save_lead(array $data, bool $draft = false): void {
    if (count($data) < 6) {
        return;
    }
    $normalized = normalize_lead_row($data);
    if ($normalized === null) {
        return;
    }

    $suffix = $draft ? '_draft' : '';
    $file = __DIR__ . '/leads' . $suffix . '_' . date('Y-m') . '.csv';
    $isNew = !file_exists($file);

    $fp = fopen($file, 'a');
    if (!$fp) return;

    if (flock($fp, LOCK_EX)) {
        if ($isNew) {
            fputcsv($fp, ['date', 'time', 'name', 'email', 'message', 'ip_hash', 'phone', 'newsletter']);
        }
        fputcsv($fp, $normalized);
        fflush($fp);
        flock($fp, LOCK_UN);
    }
    fclose($fp);
}
