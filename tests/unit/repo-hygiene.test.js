import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..', '..');

describe('Higiena repozytorium i bezpieczeństwo danych (ISO 27001)', () => {
  it('package.json posiada wymagane skrypty CI/CD (test, test:smoke, build:pdf, check, check:syntax, prepare, serve, dev)', () => {
    const pkgPath = path.join(ROOT_DIR, 'package.json');
    assert.ok(fs.existsSync(pkgPath), 'Brak package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

    assert.ok(pkg.scripts, 'Brak sekcji scripts w package.json');
    assert.ok(pkg.scripts.test, 'Brak skryptu test');
    assert.ok(pkg.scripts['test:smoke'], 'Brak skryptu test:smoke');
    assert.ok(pkg.scripts['build:pdf'], 'Brak skryptu build:pdf');
    assert.ok(pkg.scripts['check:syntax'], 'Brak skryptu check:syntax');
    assert.ok(pkg.scripts.check, 'Brak skryptu check');
    assert.ok(pkg.scripts.prepare, 'Brak skryptu prepare');
    assert.ok(pkg.scripts.serve, 'Brak skryptu serve');
    assert.ok(pkg.scripts.dev, 'Brak skryptu dev');
  });

  it('konfiguracja CI/CD (.github/workflows) posiada ci.yml, deploy.yml oraz dependabot-automerge.yml', () => {
    const workflows = ['ci.yml', 'deploy.yml', 'dependabot-automerge.yml'];
    for (const wf of workflows) {
      const wfPath = path.join(ROOT_DIR, '.github', 'workflows', wf);
      assert.ok(fs.existsSync(wfPath), `Brak pliku .github/workflows/${wf}`);
      const content = fs.readFileSync(wfPath, 'utf-8');
      assert.match(content, /runs-on:\s*ubuntu-latest/i);
    }
    const ciContent = fs.readFileSync(path.join(ROOT_DIR, '.github', 'workflows', 'ci.yml'), 'utf-8');
    assert.match(ciContent, /gitleaks/i);
    assert.match(ciContent, /smoke-diagnostics/i);
  });

  it('repozytorium nie zawiera markerów po konfliktach gita (merge conflict markers)', () => {
    const extensionsToCheck = ['.html', '.js', '.css', '.json', '.yml', '.md', '.php'];
    const CONFLICT_START = '<<<<<<<' + ' ';
    const CONFLICT_END = '>>>>>>>' + ' ';

    function scanDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.git') || entry.name === 'node_modules' || entry.name === 'dist') continue;
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

  it('pliki dokumentacji, standardów (.gitleaks.toml, .env.example, .htaccess, sw.js) oraz konfiguracji istnieją', () => {
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'AGENTS.md')), 'Brak AGENTS.md');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'GEMINI.md')), 'Brak GEMINI.md');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'README.md')), 'Brak README.md');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'ROADMAP.md')), 'Brak ROADMAP.md');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'BLUEPRINT.md')), 'Brak BLUEPRINT.md');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'SECURITY.md')), 'Brak SECURITY.md');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'LICENSE')), 'Brak LICENSE');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, '.editorconfig')), 'Brak .editorconfig');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, '.gitleaks.toml')), 'Brak .gitleaks.toml');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, '.env.example')), 'Brak .env.example');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, '.htaccess')), 'Brak głównego .htaccess');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'sw.js')), 'Brak Service Workera sw.js');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'eslint.config.mjs')), 'Brak eslint.config.mjs');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, '.htmlhintrc')), 'Brak .htmlhintrc');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'docker-compose.yml')), 'Brak docker-compose.yml');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'tests', 'smoke', 'ui-smoke.js')), 'Brak tests/smoke/ui-smoke.js');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, '.github', 'pull_request_template.md')), 'Brak .github/pull_request_template.md');
  });

  it('katalogi api/, api/sessions oraz api/rate_limits posiadają ochronę .htaccess, moduł leads-store.php oraz RODO mask_ip w contact.php', () => {
    const apiHt = path.join(ROOT_DIR, 'api', '.htaccess');
    const leadsStore = path.join(ROOT_DIR, 'api', 'leads-store.php');
    const rateLimitPhp = path.join(ROOT_DIR, 'api', 'rate-limit.php');
    const contactPhp = path.join(ROOT_DIR, 'api', 'contact.php');
    const sessionsHt = path.join(ROOT_DIR, 'api', 'sessions', '.htaccess');
    const rateLimitsHt = path.join(ROOT_DIR, 'api', 'rate_limits', '.htaccess');

    assert.ok(fs.existsSync(apiHt), 'Brak .htaccess w api/ chroniącego pliki CSV');
    assert.ok(fs.existsSync(leadsStore), 'Brak api/leads-store.php');
    assert.ok(fs.existsSync(rateLimitPhp), 'Brak api/rate-limit.php');
    assert.ok(fs.existsSync(sessionsHt), 'Brak .htaccess w api/sessions');
    assert.ok(fs.existsSync(rateLimitsHt), 'Brak .htaccess w api/rate_limits');
    assert.match(fs.readFileSync(apiHt, 'utf-8'), /csv/i);
    assert.match(fs.readFileSync(sessionsHt, 'utf-8'), /Deny from all/i);
    assert.match(fs.readFileSync(rateLimitsHt, 'utf-8'), /Deny from all/i);

    const contactCode = fs.readFileSync(contactPhp, 'utf-8');
    assert.match(contactCode, /function\s+mask_ip/i, 'Brak anonimizacji IP mask_ip() w api/contact.php');
    assert.match(contactCode, /function\s+get_env_secret/i, 'Brak get_env_secret() w api/contact.php');
    assert.match(contactCode, /OSTICKET_API_KEY/i, 'Brak integracji osTicket w api/contact.php');
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

  it('git hooki (.githooks/pre-commit i commit-msg) oraz .gitattributes istnieją i mają poprawny format', () => {
    const preCommit = path.join(ROOT_DIR, '.githooks', 'pre-commit');
    const commitMsg = path.join(ROOT_DIR, '.githooks', 'commit-msg');
    const gitAttrPath = path.join(ROOT_DIR, '.gitattributes');
    assert.ok(fs.existsSync(preCommit), 'Brak .githooks/pre-commit');
    assert.ok(fs.existsSync(commitMsg), 'Brak .githooks/commit-msg');
    assert.ok(fs.existsSync(gitAttrPath), 'Brak .gitattributes');

    assert.match(fs.readFileSync(preCommit, 'utf-8'), /npm run check/);
    assert.match(fs.readFileSync(commitMsg, 'utf-8'), /Conventional Commits/i);
    assert.match(fs.readFileSync(gitAttrPath, 'utf-8'), /\* text=auto eol=lf/i);
  });

  it('szablony zgłoszeń GitHub (.github/ISSUE_TEMPLATE) oraz skrypty narzędziowe istnieją i chronią przed Directory Traversal', async () => {
    assert.ok(fs.existsSync(path.join(ROOT_DIR, '.github', 'ISSUE_TEMPLATE', 'bug_report.yml')), 'Brak bug_report.yml');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, '.github', 'ISSUE_TEMPLATE', 'task.yml')), 'Brak task.yml');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, '.github', 'ISSUE_TEMPLATE', 'config.yml')), 'Brak config.yml');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'scripts', 'serve.js')), 'Brak scripts/serve.js');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'scripts', 'generate-pdf.js')), 'Brak scripts/generate-pdf.js');

    const serveModule = await import('../../scripts/serve.js');
    assert.strictEqual(typeof serveModule.resolveSafeFilePath, 'function');
    assert.strictEqual(serveModule.SECURITY_HEADERS['X-Content-Type-Options'], 'nosniff');
    assert.ok(serveModule.MIME_TYPES['.webmanifest']);

    const validResult = serveModule.resolveSafeFilePath('/', ROOT_DIR);
    assert.strictEqual(validResult.isAllowed, true);

    const traversalResult = serveModule.resolveSafeFilePath('/../../etc/passwd', ROOT_DIR);
    assert.strictEqual(traversalResult.isAllowed, false, 'Serwer powinien blokować próby Directory Traversal');

    const sensitiveResult = serveModule.resolveSafeFilePath('/.env', ROOT_DIR);
    assert.strictEqual(sensitiveResult.isAllowed, false, 'Serwer powinien blokować dostęp do pliku .env');

    const malformedResult = serveModule.resolveSafeFilePath('/%E0%A4%A', ROOT_DIR);
    assert.strictEqual(malformedResult.isMalformed, true, 'Serwer powinien wykrywać uszkodzone URI');

    const dispatchReq = (url) => new Promise((resolve) => {
      let statusCode = 0;
      const res = {
        headersSent: false,
        writeHead(code) { statusCode = code; this.headersSent = true; },
        end(body) { resolve({ statusCode, body }); },
        on() {},
        once() {},
        emit() {}
      };
      serveModule.server.emit('request', { url }, res);
    });

    const res400 = await dispatchReq('/%E0%A4%A');
    assert.strictEqual(res400.statusCode, 400);

    const res403 = await dispatchReq('/.env');
    assert.strictEqual(res403.statusCode, 403);

    const res404 = await dispatchReq('/nie-istnieje-404.html');
    assert.strictEqual(res404.statusCode, 404);

    const pdfModule = await import('../../scripts/generate-pdf.js');
    assert.strictEqual(typeof pdfModule.findBrowserBinary, 'function');
    assert.strictEqual(typeof pdfModule.generatePdf, 'function');

    const pkgPath = path.join(ROOT_DIR, 'package.json');
    assert.strictEqual(pdfModule.findBrowserBinary('linux', { CHROME_PATH: pkgPath }), pkgPath);
    assert.strictEqual(pdfModule.findBrowserBinary('linux', {}, () => pkgPath), pkgPath);
    assert.strictEqual(pdfModule.findBrowserBinary('linux', {}, () => { throw new Error('missing'); }), null);

    assert.throws(
      () => pdfModule.generatePdf(path.join(ROOT_DIR, 'dist', 'test.pdf'), { inputHtml: path.join(ROOT_DIR, 'brak.html') }),
      /Plik źródłowy HTML nie istnieje/
    );
    assert.throws(
      () => pdfModule.generatePdf(path.join(ROOT_DIR, 'dist', 'test.pdf'), { browser: null }),
      /Nie znaleziono silnika Chromium/
    );
  });

  it('standard Asystenta AI (assets/js/ai-widget.js, docs/AI_KNOWLEDGE_TEMPLATE.md oraz test jednostkowy) istnieje i nie zawiera kluczy API (ISO 27001)', () => {
    const widgetPath = path.join(ROOT_DIR, 'assets', 'js', 'ai-widget.js');
    const templatePath = path.join(ROOT_DIR, 'docs', 'AI_KNOWLEDGE_TEMPLATE.md');
    const testPath = path.join(ROOT_DIR, 'tests', 'unit', 'ai-widget.test.js');

    assert.ok(fs.existsSync(widgetPath), 'Brak assets/js/ai-widget.js');
    assert.ok(fs.existsSync(templatePath), 'Brak docs/AI_KNOWLEDGE_TEMPLATE.md');
    assert.ok(fs.existsSync(testPath), 'Brak tests/unit/ai-widget.test.js');

    const widgetCode = fs.readFileSync(widgetPath, 'utf-8');
    assert.ok(widgetCode.includes('https://ai.twojastronawww.pl/chat-router.php'), 'Widget AI musi wskazywać na centralny VPS AI Router');
    assert.strictEqual(/AIzaSy|gsk_|sk-or-v1-/i.test(widgetCode), false, 'Widget frontendowy nie może zawierać zahardkodowanych kluczy API');
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
