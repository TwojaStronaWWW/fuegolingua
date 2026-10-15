import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupMockDom } from '../helpers/mock-dom.js';
import { formatMarkdown, getLocalFallbackAnswer, initAiWidget } from '../../assets/js/ai-widget.js';

describe('Widget Asystenta AI (assets/js/ai-widget.js)', () => {
  let dom;

  beforeEach(() => {
    dom = setupMockDom();
    const scriptTag = dom.mockDocument.createElement('script');
    scriptTag.setAttribute('data-site-id', 'fuegolingua');
    scriptTag.setAttribute('data-title', 'Asystent Fuego Lingua');
    dom.elements.set('ai-script', scriptTag);
  });

  test('formatMarkdown bezpiecznie escapuje HTML (ochrona XSS) i formatuje pogrubienia, listy oraz linki', () => {
    const xss = '<script>alert("xss")</script> **95 zł** kontakt@fuegolingua.pl https://fuegolingua.pl\n- Punkt 1\n- Punkt 2';
    const html = formatMarkdown(xss);

    assert.equal(html.includes('<script>'), false);
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(html.includes('<strong>95 zł</strong>'));
    assert.ok(html.includes('href="mailto:kontakt@fuegolingua.pl"'));
    assert.ok(html.includes('href="https://fuegolingua.pl"'));
    assert.ok(html.includes('<ul class="tsw-ai-list"><li>Punkt 1</li><li>Punkt 2</li></ul>'));
  });

  test('getLocalFallbackAnswer zwraca dopasowane odpowiedzi z bazy wiedzy FuegoLingua', () => {
    assert.match(getLocalFallbackAnswer('Bezpłatna lekcja próbna'), /bezpłatna/i);
    assert.match(getLocalFallbackAnswer('Ile kosztuje kurs hiszpańskiego?'), /95 zł/);
    assert.match(getLocalFallbackAnswer('Hiszpański w biznesie i stolarce'), /130 zł/);
    assert.match(getLocalFallbackAnswer('Zajęcia indywidualne czy grupowe?'), /80% lekcji to żywa rozmowa/);
    assert.match(getLocalFallbackAnswer('Jaki jest kontakt telefoniczny?'), /796-868-967/);
    assert.match(getLocalFallbackAnswer('Cześć!'), /Fuego Lingua/);
  });

  test('initAiWidget tworzy strukturę DOM, obsługuje otwieranie/zamykanie (w tym Escape) i duplikaty', () => {
    const widget = initAiWidget(dom.mockDocument, dom.mockWindow);
    assert.ok(widget);
    assert.equal(widget.toggleBtn.getAttribute('aria-expanded'), 'false');

    // Druga próba inicjalizacji zwraca null (ochrona przed duplikacją)
    assert.equal(initAiWidget(dom.mockDocument, dom.mockWindow), null);

    // Otwarcie czatu
    widget.toggleChat();
    assert.equal(widget.chatWindow.classList.contains('tsw-open'), true);
    assert.equal(widget.toggleBtn.getAttribute('aria-expanded'), 'true');

    // Zamknięcie klawiszem Escape
    dom.mockDocument.dispatchEvent({ type: 'keydown', key: 'Escape' });
    assert.equal(widget.chatWindow.classList.contains('tsw-open'), false);
    assert.equal(widget.toggleBtn.getAttribute('aria-expanded'), 'false');
  });

  test('sendQuestion obsługuje odpowiedź z VPS AI Routera oraz fallback przy błędzie sieci', async () => {
    dom.mockWindow.fetch = async () => ({
      ok: true,
      json: async () => ({
        success: true,
        answer: 'Lekcja indywidualna kosztuje **95 zł** za 60 minut.'
      })
    });

    const widget = initAiWidget(dom.mockDocument, dom.mockWindow);
    await widget.sendQuestion('Ile kosztuje lekcja?');

    assert.equal(widget.getHistory().length, 2);
    assert.equal(widget.getHistory()[0].text, 'Ile kosztuje lekcja?');
    assert.match(widget.getHistory()[1].text, /95 zł/);

    // Test awarii sieci -> automatyczny fallback bazy wiedzy
    dom.mockWindow.fetch = async () => {
      throw new Error('Network error');
    };
    await widget.sendQuestion('Bezpłatna lekcja próbna');
    assert.equal(widget.getHistory().length, 4);
    assert.match(widget.getHistory()[3].text, /bezpłatna/i);

    // Wyczyszczenie historii rozmowy
    widget.clearBtn.dispatchEvent({ type: 'click' });
    assert.equal(widget.getHistory().length, 0);
  });
});
