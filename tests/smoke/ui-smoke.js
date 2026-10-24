/**
 * Headless Browser UI Smoke Test (Wzorzec Kato Salsa Hub & FuegoLingua)
 * Weryfikuje poprawność renderowania strony głównej i brak błędów runtime JS.
 * Jeśli pakiet playwright nie jest zainstalowany lokalnie, kończy się bezpiecznym pominięciem (graceful skip).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { server } from '../../scripts/serve.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const DIAG_DIR = path.join(ROOT_DIR, 'smoke-diagnostics');

async function runSmokeTest() {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    console.log('ℹ️ [UI Smoke Test] Pakiet "playwright" nie jest zainstalowany w tym środowisku — pomijam test przeglądarkowy (OK).');
    process.exit(0);
  }

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  let browser;
  let page;
  const errors = [];

  try {
    browser = await playwright.chromium.launch({ headless: true });
    page = await browser.newPage();

    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith(baseUrl) || url.startsWith('data:')) {
        route.continue();
      } else {
        route.abort();
      }
    });

    page.on('pageerror', (err) => errors.push(`PageError: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('ERR_FAILED') && !text.includes('Failed to load resource')) {
          errors.push(`ConsoleError: ${text}`);
        }
      }
    });

    const response = await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (!response || response.status() !== 200) {
      throw new Error(`Nieprawidłowy kod odpowiedzi HTTP: ${response ? response.status() : 'brak'}`);
    }

    const h1Count = await page.locator('h1').count();
    if (h1Count < 1) {
      throw new Error('Brak nagłówka <h1> na stronie głównej');
    }

    if (errors.length > 0) {
      throw new Error(`Wykryto błędy runtime JS:\n${errors.join('\n')}`);
    }

    console.log('✅ [UI Smoke Test] Strona główna wyrenderowana poprawnie bez błędów JS.');
  } catch (err) {
    fs.mkdirSync(DIAG_DIR, { recursive: true });
    fs.writeFileSync(path.join(DIAG_DIR, 'smoke-error.log'), String(err.stack || err.message), 'utf-8');
    if (page) {
      try {
        await page.screenshot({ path: path.join(DIAG_DIR, 'failure.png'), fullPage: true });
      } catch {}
    }
    console.error('❌ [UI Smoke Test] BŁĄD:', err.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

runSmokeTest();
