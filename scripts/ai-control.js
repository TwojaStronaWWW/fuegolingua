/**
 * Sterownik Multi-Tenant Asystenta AI (Platform Core — TwojaStronaWWW)
 * Użycie:
 *   npm run ai:enable
 *   npm run ai:disable
 *   npm run ai:status
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_CONFIG_PATH = path.resolve(__dirname, '..', 'assets', 'data', 'ai-config.json');

export function readAiConfig(configPath = DEFAULT_CONFIG_PATH) {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Brak pliku konfiguracji AI: ${configPath}`);
  }
  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Nieprawidłowy format pliku ai-config.json');
  }
  return parsed;
}

export function setAiEnabled(enabled, configPath = DEFAULT_CONFIG_PATH) {
  const current = readAiConfig(configPath);
  const updated = {
    ...current,
    enabled: Boolean(enabled)
  };
  const tmpPath = `${configPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
  fs.renameSync(tmpPath, configPath);
  return updated;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const action = String(process.argv[2] || 'status').toLowerCase();
  try {
    if (action === 'enable' || action === 'on') {
      const cfg = setAiEnabled(true);
      console.log(`✅ [AI Control] Asystent AI został WŁĄCZONY dla siteId="${cfg.siteId}" (enabled: true).`);
    } else if (action === 'disable' || action === 'off') {
      const cfg = setAiEnabled(false);
      console.log(`⏸️ [AI Control] Asystent AI został WYŁĄCZONY dla siteId="${cfg.siteId}" (enabled: false).`);
    } else if (action === 'status') {
      const cfg = readAiConfig();
      console.log(`ℹ️ [AI Control] siteId="${cfg.siteId}" | enabled=${Boolean(cfg.enabled)} | title="${cfg.title || ''}"`);
    } else {
      console.error(`Nieznana komenda: "${action}". Użyj: enable | disable | status.`);
      process.exitCode = 1;
    }
  } catch (err) {
    console.error(`❌ [AI Control] Błąd: ${err.message}`);
    process.exitCode = 1;
  }
}
