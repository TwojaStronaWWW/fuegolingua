import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.join(__dirname, '..', '..');
const CSS_FILES = [
  path.join(ROOT_DIR, 'assets', 'css', 'style.css'),
  path.join(ROOT_DIR, 'assets', 'css', 'media.css'),
  path.join(ROOT_DIR, 'assets', 'css', 'cennik.css'),
];

describe('Integralność i składnia arkuszy stylów CSS (assets/css/*.css)', () => {
  const styleCss = fs.readFileSync(CSS_FILES[0], 'utf-8');

  it('wszystkie arkusze stylów istnieją i posiadają zbalansowane nawiasy klamrowe {} oraz okrągłe ()', () => {
    for (const cssPath of CSS_FILES) {
      assert.ok(fs.existsSync(cssPath), `Brak pliku CSS: ${cssPath}`);
      const content = fs.readFileSync(cssPath, 'utf-8');
      const name = path.basename(cssPath);

      const openBraces = (content.match(/\{/g) || []).length;
      const closeBraces = (content.match(/\}/g) || []).length;
      assert.strictEqual(
        openBraces,
        closeBraces,
        `Niezbalansowane nawiasy klamrowe w ${name}: { (${openBraces}) vs } (${closeBraces})`
      );

      const openParen = (content.match(/\(/g) || []).length;
      const closeParen = (content.match(/\)/g) || []).length;
      assert.strictEqual(
        openParen,
        closeParen,
        `Niezbalansowane nawiasy okrągłe w ${name}: ( (${openParen}) vs ) (${closeParen})`
      );
    }
  });

  it('główny arkusz style.css definiuje spójną paletę zmiennych CSS (Design Tokens) w :root', () => {
    assert.match(styleCss, /:root\s*\{/i);
    assert.match(styleCss, /--fuego-red:/i);
    assert.match(styleCss, /--fuego-gradient:/i);
    assert.match(styleCss, /--text-dark:/i);
    assert.match(styleCss, /--color-primary:/i);
    assert.match(styleCss, /--color-bg:/i);
    assert.match(styleCss, /--color-text:/i);
  });

  it('wszystkie użyte zmienne var(--token) bez fallbacku posiadają definicję w style.css (:root)', () => {
    const definedVars = new Set();
    const defRegex = /(--[a-zA-Z0-9-]+)\s*:/g;
    let m;
    while ((m = defRegex.exec(styleCss)) !== null) {
      definedVars.add(m[1]);
    }

    for (const cssPath of CSS_FILES) {
      const content = fs.readFileSync(cssPath, 'utf-8');
      const name = path.basename(cssPath);
      const useRegex = /var\(\s*(--[a-zA-Z0-9-]+)\s*\)/g;
      let u;
      while ((u = useRegex.exec(content)) !== null) {
        const varName = u[1];
        assert.ok(
          definedVars.has(varName),
          `Niezdefiniowana zmienna CSS ${varName} użyta w pliku ${name}`
        );
      }
    }
  });

  it('arkusze nie zawierają pustych reguł CSS bez deklaracji właściwości oraz wspierają prefers-reduced-motion', () => {
    const emptyRuleRegex = /[^{}]+\{\s*\}/g;
    for (const cssPath of CSS_FILES) {
      const content = fs.readFileSync(cssPath, 'utf-8');
      const name = path.basename(cssPath);
      const emptyMatches = content.match(emptyRuleRegex);
      assert.strictEqual(emptyMatches, null, `Wykryto puste reguły w ${name}: ${emptyMatches}`);
    }
    assert.match(styleCss, /prefers-reduced-motion:\s*reduce/i);
  });
});
