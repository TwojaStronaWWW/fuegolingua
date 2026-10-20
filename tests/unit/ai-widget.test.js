import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupMockDom } from '../helpers/mock-dom.js';
import {
  formatMarkdown,
  getLocalFallbackAnswer,
  initAiWidget,
  computeKnowledgeVersion,
  searchKnowledgeEntries
} from '../../assets/js/ai-widget.js';

describe('Widget Asystenta AI v3.0 (assets/js/ai-widget.js)', () => {
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

  test('getLocalFallbackAnswer zwraca dopasowane odpowiedzi z bazy wiedzy FuegoLingua (w tym pytanie o tłumaczenia)', () => {
    assert.match(getLocalFallbackAnswer('Bezpłatna lekcja próbna'), /bezpłatna/i);
    assert.match(getLocalFallbackAnswer('Ile kosztuje kurs hiszpańskiego?'), /95 zł/);
    assert.match(getLocalFallbackAnswer('Hiszpański w biznesie i stolarce'), /130 zł/);
    assert.match(getLocalFallbackAnswer('Zajęcia indywidualne czy grupowe?'), /80% lekcji to żywa rozmowa/);
    assert.match(getLocalFallbackAnswer('Jaki jest kontakt telefoniczny?'), /796-868-967/);
    assert.match(getLocalFallbackAnswer('Czy robicie tłumaczenia przysięgłe na delegację?'), /tłumacza przysięgłego/i);
    assert.match(getLocalFallbackAnswer('Cześć!'), /Fuego Lingua/);
  });

  test('computeKnowledgeVersion oraz searchKnowledgeEntries obsługują dynamiczną bazę wiedzy', () => {
    assert.equal(computeKnowledgeVersion([]), 'kb_v0_empty');
    const entries = [
      { id: '1', term: 'Subjuntivo', category: ['grammar'], definition: 'Tryb łączący w języku hiszpańskim.' }
    ];
    const v1 = computeKnowledgeVersion(entries);
    assert.match(v1, /^kb_v1_/);
    const matched = searchKnowledgeEntries('Co to jest Subjuntivo?', entries);
    assert.equal(matched.length, 1);
    assert.equal(matched[0].term, 'Subjuntivo');
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

  test('sendQuestion obsługuje odpowiedź z VPS AI Routera, Response Cache oraz fallback przy błędzie sieci bez wycieku timera', async () => {
    let fetchCalls = 0;
    dom.mockWindow.fetch = async () => {
      fetchCalls++;
      return {
        ok: true,
        json: async () => ({
          success: true,
          answer: 'Lekcja indywidualna kosztuje **95 zł** za 60 minut.'
        })
      };
    };

    const widget = initAiWidget(dom.mockDocument, dom.mockWindow);
    await widget.sendQuestion('Ile kosztuje lekcja?');

    assert.equal(fetchCalls, 1);
    assert.equal(widget.getHistory().length, 2);
    assert.equal(widget.getHistory()[0].text, 'Ile kosztuje lekcja?');
    assert.match(widget.getHistory()[1].text, /95 zł/);

    // Drugie identyczne pytanie -> natychmiastowa odpowiedź z Response Cache bez wywołania fetch
    const cachedRes = await widget.sendQuestion('Ile kosztuje lekcja?');
    assert.equal(cachedRes.cached, true);
    assert.equal(fetchCalls, 1);

    // Test awarii sieci -> automatyczny fallback bazy wiedzy
    dom.mockWindow.fetch = async () => {
      throw new Error('Network error');
    };
    await widget.sendQuestion('Bezpłatna lekcja próbna');
    assert.equal(widget.getHistory().length, 6);
    assert.match(widget.getHistory()[5].text, /bezpłatna/i);

    // Wyczyszczenie historii rozmowy
    widget.clearBtn.dispatchEvent({ type: 'click' });
    assert.equal(widget.getHistory().length, 0);
  });

  test('sendQuestion omija pamięć podręczną (Response Cache) dla leadów z numerem telefonu lub e-mailem (gwarancja Ntfy 1-Klik)', async () => {
    let fetchCalls = 0;
    dom.mockWindow.fetch = async () => {
      fetchCalls++;
      return {
        ok: true,
        json: async () => ({
          success: true,
          answer: 'Dziękuję! Zapisałam Twój kontakt i oddzwonię.'
        })
      };
    };

    const widget = initAiWidget(dom.mockDocument, dom.mockWindow);
    await widget.sendQuestion('Proszę o kontakt na +48 (600) 700 800 lub anna@firma.pl');
    assert.equal(fetchCalls, 1);
    assert.equal(widget.getCachedAnswer('Proszę o kontakt na +48 (600) 700 800 lub anna@firma.pl'), null);

    await widget.sendQuestion('Proszę o kontakt na +48 (600) 700 800 lub anna@firma.pl');
    assert.equal(fetchCalls, 2);
  });

  test('Dyktowanie głosowe (Web Speech API — Tryb Bezpieczny): rozpoznaje mowę po polsku na żywo do pola tekstowego bez automatycznego wysyłania', () => {
    let lastInstance = null;
    dom.mockWindow.webkitSpeechRecognition = class MockSpeechRecognition {
      constructor() {
        this.lang = '';
        this.continuous = true;
        this.interimResults = false;
        this.maxAlternatives = 1;
        this.started = false;
        lastInstance = this;
      }
      start() {
        this.started = true;
        if (typeof this.onstart === 'function') this.onstart();
      }
      stop() {
        this.started = false;
        if (typeof this.onend === 'function') this.onend();
      }
    };

    const widget = initAiWidget(dom.mockDocument, dom.mockWindow);

    assert.ok(widget.voiceBtn, 'Przycisk mikrofonu #tswAiVoiceBtn musi istnieć w formularzu czatu');
    assert.equal(widget.voiceBtn.getAttribute('aria-pressed'), 'false');
    assert.equal(widget.isVoiceListening(), false);

    // 1. Kliknięcie mikrofonu uruchamia nasłuchiwanie pl-PL z interimResults=true
    widget.voiceBtn.click();
    assert.ok(lastInstance, 'Instancja SpeechRecognition powinna zostać utworzona');
    assert.equal(lastInstance.lang, 'pl-PL');
    assert.equal(lastInstance.interimResults, true);
    assert.equal(lastInstance.continuous, false);
    assert.equal(widget.isVoiceListening(), true);
    assert.equal(widget.voiceBtn.getAttribute('aria-pressed'), 'true');
    assert.equal(widget.voiceBtn.classList.contains('tsw-listening'), true);

    // 2. Transkrypcja na żywo (interim) wpisuje tekst do pola #tswAiInput
    lastInstance.onresult({
      results: [
        Object.assign([{ transcript: 'Ile kosztuje ' }], { isFinal: true }),
        Object.assign([{ transcript: 'kurs hiszpańskiego' }], { isFinal: false })
      ]
    });
    assert.equal(widget.chatInput.value, 'Ile kosztuje kurs hiszpańskiego');

    // 3. Zakończenie wypowiedzi wyłącza mikrofon, ale zostawia tekst w polu do weryfikacji przed wysłaniem
    lastInstance.stop();
    assert.equal(widget.isVoiceListening(), false);
    assert.equal(widget.voiceBtn.getAttribute('aria-pressed'), 'false');
    assert.equal(widget.voiceBtn.classList.contains('tsw-listening'), false);
    assert.equal(widget.chatInput.value, 'Ile kosztuje kurs hiszpańskiego');
    assert.equal(widget.getHistory().length, 0, 'Tryb bezpieczny nie może wysłać wiadomości automatycznie bez kliknięcia Wyślij');
  });
});

