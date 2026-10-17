/**
 * Uniwersalny kompilator PDF (ofert, cenników, portfolio) dla platformy FuegoLingua / TwojaStronaWWW.
 * Wykorzystuje natywny silnik Chromium (Edge/Chrome) z izolowanym profilem --user-data-dir.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const INPUT_HTML = path.join(ROOT_DIR, 'index.html');
const OUTPUT_DIR = path.join(ROOT_DIR, 'dist');
export const OUTPUT_PDF = path.join(OUTPUT_DIR, 'document.pdf');

export function findBrowserBinary(platform = process.platform, env = process.env, whichExecutor = null) {
  if (env.CHROME_PATH && fs.existsSync(env.CHROME_PATH)) {
    return env.CHROME_PATH;
  }

  if (platform === 'win32') {
    const candidates = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(env.LOCALAPPDATA || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  } else {
    const candidates = [
      'google-chrome-stable',
      'google-chrome',
      'chromium-browser',
      'chromium',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
    ];

    const runWhich = whichExecutor || ((cmd, args) => {
      return execFileSync(cmd, args, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    });

    for (const name of candidates) {
      try {
        const which = runWhich('which', [name]);
        if (which && fs.existsSync(which)) return which;
      } catch {
        // Kontynuuj poszukiwania
      }
    }
  }

  return null;
}

export function generatePdf(destinationPath = OUTPUT_PDF, options = {}) {
  const inputHtml = options.inputHtml || INPUT_HTML;
  const minSize = options.minSize !== undefined ? options.minSize : 5000;
  const resolvedDest = path.resolve(destinationPath);

  if (!fs.existsSync(inputHtml)) {
    throw new Error(`Plik źródłowy HTML nie istnieje: ${inputHtml}`);
  }

  const browser = (options.browser !== undefined) ? options.browser : findBrowserBinary();
  if (!browser) {
    throw new Error(
      'Nie znaleziono silnika Chromium (Edge/Chrome). W środowisku CI upewnij się, że Chrome jest dostępny lub ustaw CHROME_PATH.'
    );
  }

  const destDir = path.dirname(resolvedDest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const fileUrl = pathToFileURL(inputHtml).href;
  const tempProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fuegolingua-pdf-'));

  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-extensions',
    `--user-data-dir=${tempProfileDir}`,
    '--no-pdf-header-footer',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=2000',
    `--print-to-pdf=${resolvedDest}`,
    fileUrl,
  ];

  console.log(`[PDF Generator] Używam silnika: ${browser}`);
  console.log(`[PDF Generator] Źródło: ${fileUrl}`);
  console.log(`[PDF Generator] Generowanie: ${resolvedDest}...`);

  try {
    execFileSync(browser, args, { stdio: 'inherit' });
  } finally {
    try {
      fs.rmSync(tempProfileDir, { recursive: true, force: true });
    } catch {
      // Ignoruj ewentualne blokady plików tymczasowych na Windows
    }
  }

  if (!fs.existsSync(resolvedDest)) {
    throw new Error('Plik PDF nie został utworzony.');
  }

  const stats = fs.statSync(resolvedDest);
  if (stats.size < minSize) {
    throw new Error(`Wygenerowany plik PDF jest podejrzanie mały (${stats.size} B).`);
  }

  console.log(`[PDF Generator] Sukces! Wygenerowano ${resolvedDest} (${(stats.size / 1024).toFixed(1)} KB).`);
  return {
    filePath: resolvedDest,
    sizeBytes: stats.size,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  try {
    generatePdf();
  } catch (err) {
    console.error(`[PDF Generator] Błąd: ${err.message}`);
    process.exit(1);
  }
}
