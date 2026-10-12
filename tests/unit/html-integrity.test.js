import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..', '..');

describe('Integralność semantyczna i standardy HTML5 (FuegoLingua.pl)', () => {
  const indexHtmlPath = path.join(ROOT_DIR, 'index.html');
  const indexContent = fs.existsSync(indexHtmlPath) ? fs.readFileSync(indexHtmlPath, 'utf8') : '';

  const cennikHtmlPath = path.join(ROOT_DIR, 'cennik.html');
  const cennikContent = fs.existsSync(cennikHtmlPath) ? fs.readFileSync(cennikHtmlPath, 'utf8') : '';

  test('Pliki index.html oraz cennik.html istnieją i nie są puste', () => {
    assert.ok(indexContent.length > 100, 'index.html powinien zawierać pełny kod strony');
    assert.ok(cennikContent.length > 100, 'cennik.html powinien zawierać pełny kod strony');
  });

  test('Pliki HTML posiadają poprawny DOCTYPE i atrybut lang="pl"', () => {
    for (const [name, content] of [['index.html', indexContent], ['cennik.html', cennikContent]]) {
      assert.match(content, /<!DOCTYPE html>/i, `Brak <!DOCTYPE html> w ${name}`);
      assert.match(content, /<html\s+[^>]*lang=["']pl["']/i, `Tag <html> w ${name} musi posiadać lang="pl"`);
    }
  });

  test('Sekcja <head> zawiera kodowanie UTF-8, meta viewport, title oraz meta description', () => {
    for (const [name, content] of [['index.html', indexContent], ['cennik.html', cennikContent]]) {
      assert.match(content, /<meta\s+charset=["']?utf-8/i, `Brak deklaracji UTF-8 w ${name}`);
      assert.match(content, /<meta\s+name=["']viewport["']/i, `Brak meta viewport w ${name}`);
      assert.match(content, /<title>[^<]+<\/title>/i, `Brak tagu <title> w ${name}`);
      assert.match(content, /<meta\s+name=["']description["']/i, `Brak meta description w ${name}`);
      assert.match(content, /<meta\s+name=["']robots["']/i, `Brak meta robots w ${name}`);
      assert.match(content, /<link\s+rel=["']canonical["']/i, `Brak linku canonical w ${name}`);
      assert.match(content, /<link\s+rel=["']manifest["']/i, `Brak manifestu PWA w ${name}`);
      assert.match(content, /<script\s+type=["']application\/ld\+json["']/i, `Brak danych strukturalnych Schema.org w ${name}`);
    }
  });

  test('Hierarchia nagłówków: index.html oraz cennik.html posiadają dokładnie jeden główny nagłówek <h1>', () => {
    for (const [name, content] of [['index.html', indexContent], ['cennik.html', cennikContent]]) {
      const h1Count = (content.match(/<h1[\s>]/gi) || []).length;
      assert.equal(h1Count, 1, `Strona ${name} powinna posiadać dokładnie jeden nagłówek <h1>, znaleziono: ${h1Count}`);
    }
  });

  test('Formularz kontaktowy w index.html zawiera wymagane pola (name, email, message, honeypot)', () => {
    assert.match(indexContent, /<form[^>]*id=["']contactForm["']/i, 'Brak formularza #contactForm w index.html');
    assert.match(indexContent, /name=["']name["']/i, 'Brak pola name w formularzu');
    assert.match(indexContent, /name=["']email["']/i, 'Brak pola email w formularzu');
    assert.match(indexContent, /name=["']message["']/i, 'Brak pola message w formularzu');
    // Honeypot field
    assert.match(indexContent, /name=["']website_url["']/i, 'Brak pola honeypot website_url chroniącego przed botami');
  });

  test('Skrypty JS są poprawnie podpięte z zewnętrznych plików, brak martwych komentarzy testowych', () => {
    assert.match(indexContent, /src=["'][^"']*(?:main\.js|script\.js)[^"']*["']/i, 'Brak podpięcia skryptu w index.html');
    assert.match(cennikContent, /src=["'][^"']*(?:main\.js|script\.js)[^"']*["']/i, 'Brak podpięcia skryptu w cennik.html');
    assert.doesNotMatch(indexContent, /<!-- test -p->/i, 'index.html zawiera śmieciowy komentarz testowy');
  });
});
