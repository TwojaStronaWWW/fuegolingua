import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..', '..');

describe('Higiena repozytorium i bezpieczeństwo danych (ISO 27001)', () => {
  it('package.json posiada wymagane skrypty CI/CD (test, check, check:syntax, prepare, serve, dev)', () => {
    const pkgPath = path.join(ROOT_DIR, 'package.json');
    assert.ok(fs.existsSync(pkgPath), 'Brak package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

    assert.ok(pkg.scripts, 'Brak sekcji scripts w package.json');
    assert.ok(pkg.scripts.test, 'Brak skryptu test');
    assert.ok(pkg.scripts['check:syntax'], 'Brak skryptu check:syntax');
    assert.ok(pkg.scripts.check, 'Brak skryptu check');
    assert.ok(pkg.scripts.prepare, 'Brak skryptu prepare');
    assert.ok(pkg.scripts.serve, 'Brak skryptu serve');
    assert.ok(pkg.scripts.dev, 'Brak skryptu dev');
  });

  it('repozytorium nie zawiera markerów po konfliktach gita (merge conflict markers)', () => {
    const extensionsToCheck = ['.html', '.js', '.css', '.json', '.yml', '.md', '.php'];
    const CONFLICT_START = '<<<<<<<' + ' ';
    const CONFLICT_END = '>>>>>>>' + ' ';

    function scanDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.git') || entry.name === 'node_modules') continue;
        const fullPath = path.join(dir, entry.name);
        if (fullPath === __filename) continue;
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (extensionsToCheck.some(ext => entry.name.endsWith(ext))) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          assert.strictEqual(
            content.includes(CONFLICT_START) || content.includes(CONFLICT_END),
            false,
            `Wykryto marker konfliktu git w pliku: ${path.relative(ROOT_DIR, fullPath)}`
          );
        }
      }
    }

    scanDir(ROOT_DIR);
  });

  it('pliki dokumentacji i standardów AGENTS.md, GEMINI.md, README.md, ROADMAP.md oraz BLUEPRINT.md istnieją', () => {
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'AGENTS.md')), 'Brak AGENTS.md');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'GEMINI.md')), 'Brak GEMINI.md');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'README.md')), 'Brak README.md');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'ROADMAP.md')), 'Brak ROADMAP.md');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'BLUEPRINT.md')), 'Brak BLUEPRINT.md');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, '.github', 'pull_request_template.md')), 'Brak .github/pull_request_template.md');
  });

  it('katalog api/sessions oraz api/rate_limits posiadają ochronę .htaccess (Deny from all)', () => {
    const sessionsHtaccess = path.join(ROOT_DIR, 'api', 'sessions', '.htaccess');
    const rateLimitsHtaccess = path.join(ROOT_DIR, 'api', 'rate_limits', '.htaccess');
    assert.ok(fs.existsSync(sessionsHtaccess), 'Brak .htaccess w api/sessions');
    assert.ok(fs.existsSync(rateLimitsHtaccess), 'Brak .htaccess w api/rate_limits');

    assert.match(fs.readFileSync(sessionsHtaccess, 'utf-8'), /Deny from all/i);
    assert.match(fs.readFileSync(rateLimitsHtaccess, 'utf-8'), /Deny from all/i);
  });

  it('plik .gitignore chroni sesje PHP, logi i dane CSV przed commitem do gita', () => {
    const gitignorePath = path.join(ROOT_DIR, '.gitignore');
    assert.ok(fs.existsSync(gitignorePath), 'Brak .gitignore');
    const content = fs.readFileSync(gitignorePath, 'utf-8');

    assert.ok(content.includes('api/sessions/*'), 'Brak reguły ignorowania sesji api/sessions/*');
    assert.ok(content.includes('api/rate_limits/*.json'), 'Brak reguły ignorowania liczników api/rate_limits/*.json');
    assert.ok(content.includes('api/leads_*.csv'), 'Brak reguły ignorowania leadów api/leads_*.csv');
  });

  it('pliki robots.txt, sitemap.xml, site.webmanifest oraz favicon.ico istnieją i są poprawne', () => {
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'robots.txt')), 'Brak robots.txt');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'sitemap.xml')), 'Brak sitemap.xml');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'site.webmanifest')), 'Brak site.webmanifest');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'favicon.ico')), 'Brak favicon.ico');

    const robotsContent = fs.readFileSync(path.join(ROOT_DIR, 'robots.txt'), 'utf-8');
    assert.match(robotsContent, /User-agent:\s*\*/i);
    assert.match(robotsContent, /Disallow:\s*\/api\//i);
  });

  it('pomocnik mock-dom (.tests/helpers/mock-dom.js) oraz serwer developerski istnieją', () => {
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'tests', 'helpers', 'mock-dom.js')), 'Brak tests/helpers/mock-dom.js');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'scripts', 'serve.js')), 'Brak scripts/serve.js');
  });

  it('git hooki (.githooks/pre-commit i commit-msg) istnieją i mają poprawny shebang', () => {
    const preCommit = path.join(ROOT_DIR, '.githooks', 'pre-commit');
    const commitMsg = path.join(ROOT_DIR, '.githooks', 'commit-msg');
    assert.ok(fs.existsSync(preCommit), 'Brak .githooks/pre-commit');
    assert.ok(fs.existsSync(commitMsg), 'Brak .githooks/commit-msg');

    assert.match(fs.readFileSync(preCommit, 'utf-8'), /npm run check/);
    assert.match(fs.readFileSync(commitMsg, 'utf-8'), /Conventional Commits/i);
  });

  it('workflow CI/CD (.github/workflows/deploy.yml) realizuje pełną formatkę Quality Gate (test, audit, deploy, concurrency, php-lint)', () => {
    const workflowPath = path.join(ROOT_DIR, '.github', 'workflows', 'deploy.yml');
    assert.ok(fs.existsSync(workflowPath), 'Brak .github/workflows/deploy.yml');
    const content = fs.readFileSync(workflowPath, 'utf-8');

    assert.match(content, /concurrency:/i, 'Brak sekcji concurrency w workflow CI/CD');
    assert.match(content, /cancel-in-progress:/i, 'Brak cancel-in-progress w concurrency');
    assert.match(content, /Walidacja składni PHP/i, 'Brak kroku walidacji składni PHP w workflow');
    assert.match(content, /npm run check:syntax/i, 'Brak kroku npm run check:syntax');
    assert.match(content, /npm run test:coverage/i, 'Brak kroku npm run test:coverage');
    assert.match(content, /lighthouse-ci-action/i, 'Brak etapu audytu Lighthouse CI');
    assert.match(content, /SFTP-Deploy-Action/i, 'Brak etapu deploy SFTP');
    assert.match(content, /needs:\s*\[test,\s*audit\]/i, 'Etap deploy musi zależeć od [test, audit]');
  });
});
