import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupMockDom } from '../helpers/mock-dom.js';
import {
  formatMarkdown,
  getLocalFallbackAnswer,
  computeKnowledgeVersion,
  searchKnowledgeEntries,
  initAiWidget
} from '../../assets/js/ai-widget.js';

describe('Uniwersalny Widget Asystenta AI v3.0 (assets/js/ai-widget.js)', () => {
  let dom;

  beforeEach(() => {
    dom = setupMockDom();
    const scriptTag = dom.mockDocument.createElement('script');
    scriptTag.setAttribute('data-site-id', 'twojastronawww');
    scriptTag.setAttribute('data-title', 'Asystent TwojaStronaWWW');
    dom.elements.set('ai-script', scriptTag);
  });

  test('formatMarkdown bezpiecznie escapuje HTML (ochrona XSS) i formatuje pogrubienia, kursywę, listy oraz linki', () => {
    const xss = '<script>alert("xss")</script> **Wycena 24h** *szybko* #contact salsopedia.html kontakt@twojastronawww.pl https://twojastronawww.pl\n- Krok 1\n- Krok 2';
    const html = formatMarkdown(xss);

    assert.equal(html.includes('<script>'), false);
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(html.includes('<strong>Wycena 24h</strong>'));
    assert.ok(html.includes('<em>szybko</em>'));
    assert.ok(html.includes('href="#contact"'));
    assert.ok(html.includes('href="salsopedia.html"'));
    assert.ok(html.includes('href="mailto:kontakt@twojastronawww.pl"'));
    assert.ok(html.includes('href="https://twojastronawww.pl"'));
    assert.ok(html.includes('<ul class="tsw-ai-list"><li>Krok 1</li><li>Krok 2</li></ul>'));
  });

  test('getLocalFallbackAnswer zwraca merytoryczne odpowiedzi awaryjne (Zero-Downtime Fallback) dla różnych witryn (w tym raricart, fuegolingua i radar-p1)', () => {
    assert.match(getLocalFallbackAnswer('Wdrożenie czatbota AI (RAG)'), /RAG/i);
    assert.match(getLocalFallbackAnswer('Ile kosztuje strona WWW?'), /wycen/i);
    assert.match(getLocalFallbackAnswer('Jak wygląda współpraca?'), /3 prostych krokach/i);
    assert.match(getLocalFallbackAnswer('Jak się skontaktować?'), /formularz/i);
    assert.match(getLocalFallbackAnswer('Dzień dobry!', 'twojastronawww'), /twojastronawww/i);
    assert.match(getLocalFallbackAnswer('Ile kosztują lody włoskie i mini pancakes?', 'raricart'), /3 000 zł/);
    assert.match(getLocalFallbackAnswer('Bezpłatna lekcja próbna', 'fuegolingua'), /bezpłatna/i);
    assert.match(getLocalFallbackAnswer('Co zrobić gdy nie działa e-Recepta P1?', 'radar-p1'), /gabinet\.gov\.pl/i);
    assert.match(getLocalFallbackAnswer('Nie działa eWUŚ w rejestracji', 'radar-p1'), /oświadczenia pacjenta/i);
    assert.match(getLocalFallbackAnswer('Jak działa tryb offline24 w KSeF i ZUS e-ZLA?', 'radar-p1'), /offline24/i);
  });

  test('Single Source of Truth v4.0: obsługuje zmienne kolorystyczne CSS (--tsw-ai-*), atrybuty data-primary/data-accent oraz dyktowanie głosowe', () => {
    const widget = initAiWidget(dom.mockDocument, dom.mockWindow, {
      siteId: 'raricart',
      primaryColor: '#3d4a3a',
      accentColor: '#8fa085'
    });
    assert.ok(widget);
    const styleEl = dom.mockDocument.getElementById('tsw-ai-widget-styles');
    assert.ok(styleEl);
    assert.match(styleEl.textContent, /--tsw-ai-primary:\s*#3d4a3a/);
    assert.match(styleEl.textContent, /--tsw-ai-accent:\s*#8fa085/);
    assert.ok(widget.voiceBtn, 'Przycisk mikrofonu #tswAiVoiceBtn musi być obecny');
  });

  test('initAiWidget tworzy strukturę DOM, obsługuje otwieranie/zamykanie (w tym Escape) i chroni przed duplikacją', () => {
    const widget = initAiWidget(dom.mockDocument, dom.mockWindow);
    assert.ok(widget);
    assert.equal(widget.toggleBtn.getAttribute('aria-expanded'), 'false');

    // Druga próba inicjalizacji zwraca null (idempotentność)
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

  test('sendQuestion korzysta z Response Cache (drugie identyczne pytanie nie odpytuje ponownie AI) oraz obsługuje fallback', async () => {
    let fetchCalls = 0;
    dom.mockWindow.fetch = async () => {
      fetchCalls++;
      return {
        ok: true,
        json: async () => ({
          success: true,
          answer: 'Wdrożenie strony z modułem **AI RAG** zajmuje od 7 dni.'
        })
      };
    };

    const widget = initAiWidget(dom.mockDocument, dom.mockWindow);
    const firstRes = await widget.sendQuestion('Ile trwa wdrożenie?');
    assert.equal(fetchCalls, 1);
    assert.equal(firstRes.cached, false);

    // Drugie identyczne pytanie -> odpowiedź z Response Cache bez wywołania fetch!
    const secondRes = await widget.sendQuestion('ile trwa wdrożenie?!');
    assert.equal(fetchCalls, 1, 'Drugie pytanie o to samo nie powinno odpytywać sieci/AI');
    assert.equal(secondRes.cached, true);
    assert.match(secondRes.answer, /AI RAG/);

    // Test awarii sieci dla nowego pytania -> automatyczny fallback bazy wiedzy
    dom.mockWindow.fetch = async () => {
      fetchCalls++;
      throw new Error('Network error');
    };
    await widget.sendQuestion('Jak wygląda współpraca?');
    assert.equal(fetchCalls, 2);
    assert.match(widget.getHistory()[5].text, /3 prostych krokach/i);

    // Wyczyszczenie historii rozmowy
    widget.clearBtn.dispatchEvent({ type: 'click' });
    assert.equal(widget.getHistory().length, 0);
  });

  test('Dynamic Knowledge Base: zmiana hasła w Salsopedii zmienia kbVersion, inwaliduje cache i aktualizuje zapisaną odpowiedź', async () => {
    const initialTerms = [
      {
        id: 'term_32',
        term: 'Enchufla',
        definition: 'Podstawowy obrót i zamiana miejsc na 1-2-3.',
        category: ['figures', 'steps'],
        status: 'verified',
        verification_count: 1
      }
    ];

    let fetchCalls = 0;
    dom.mockWindow.fetch = async () => {
      fetchCalls++;
      throw new Error('Offline mode - use local knowledge base');
    };

    const widget = initAiWidget(dom.mockDocument, dom.mockWindow, {
      siteId: 'katosalsahub',
      initialKnowledge: initialTerms,
      skipInitialFetch: true
    });

    const v1 = widget.getKnowledgeVersion();
    const res1 = await widget.sendQuestion('Co to jest Enchufla?');
    assert.equal(fetchCalls, 1);
    assert.match(res1.answer, /Podstawowy obrót i zamiana miejsc na 1-2-3/);

    // Drugie zapytanie przed zmianą w Salsopedii -> trafia w cache, brak wywołania fetch
    const resCached = await widget.sendQuestion('Co to jest Enchufla?');
    assert.equal(fetchCalls, 1);
    assert.equal(resCached.cached, true);

    // Zmiana definicji hasła w Salsopedii
    const updatedTerms = [
      {
        id: 'term_32',
        term: 'Enchufla',
        definition: 'Zaktualizowana definicja: obrót partnerki pod lewą ręką na 1-2-3 i wymiana miejsc na 5-6-7.',
        category: ['figures', 'steps'],
        status: 'verified',
        verification_count: 2
      }
    ];
    widget.updateKnowledgeEntries(updatedTerms);

    const v2 = widget.getKnowledgeVersion();
    assert.notEqual(v1, v2, 'Wersja wiedzy kbVersion musi ulec zmianie po edycji Salsopedii');

    // Zapisana wcześniej odpowiedź oraz nowe zapytanie mają już zaktualizowaną wiedzę z Salsopedii
    const resAfterUpdate = await widget.sendQuestion('Co to jest Enchufla?');
    assert.match(resAfterUpdate.answer, /Zaktualizowana definicja: obrót partnerki pod lewą ręką/);
    assert.equal(searchKnowledgeEntries('Enchufla', updatedTerms).length, 1);
    assert.ok(computeKnowledgeVersion(updatedTerms).startsWith('kb_v1_'));
  });

  test('Lead Extractor Contract: wiadomości z numerem telefonu lub e-mailem (hasContactPii) omijają cache i zawsze trafiają do VPS AI Routera', async () => {
    let fetchCalls = 0;
    dom.mockWindow.fetch = async () => {
      fetchCalls++;
      return {
        ok: true,
        json: async () => ({
          success: true,
          answer: 'Dziękujemy! Oddzwonimy pod podany numer.'
        })
      };
    };

    const widget = initAiWidget(dom.mockDocument, dom.mockWindow);
    await widget.sendQuestion('Proszę o telefon: (+48) 500.600.700');
    await widget.sendQuestion('Proszę o telefon: (+48) 500.600.700');
    assert.equal(fetchCalls, 2, 'Wiadomość z numerem telefonu nie może być cachowana lokalnie (musi wyzwolić Ntfy na VPS)');
    assert.equal(widget.getCachedAnswer('Proszę o telefon: (+48) 500.600.700'), null);
  });

  test('openAndAsk oraz trackCookielessSearch obsługują bezpośrednie wywołania z kart oferty i wyszukiwarki', async () => {
    dom.mockWindow.fetch = async () => ({
      ok: true,
      json: async () => ({
        success: true,
        answer: 'Oferujemy pakiet **Enterprise**.'
      })
    });

    const widget = initAiWidget(dom.mockDocument, dom.mockWindow);
    assert.equal(typeof widget.openAndAsk, 'function');
    assert.equal(typeof dom.mockWindow.TSWAiWidget?.openAndAsk, 'function');
    assert.equal(typeof dom.mockWindow.trackCookielessSearch, 'function');

    const res = await widget.openAndAsk('Jaki pakiet polecacie?');
    assert.equal(widget.chatWindow.classList.contains('tsw-open'), true);
    assert.match(res.answer, /Enterprise/);
  });

  test('Fail-Closed Cache Invalidation: odrzuca i czyści uszkodzone wpisy w localStorage (złe ts, brak answer, tablica zamiast obiektu)', () => {
    dom.mockWindow.localStorage.setItem('tsw_ai_cache_twojastronawww', JSON.stringify({
      kbVersion: 'kb_v0_empty',
      entries: {
        'ile kosztuje strona www': { answer: 'Stara odpowiedź', ts: -500 },
        'jak wyglada wspolpraca': { answer: '', ts: Date.now() }
      }
    }));

    const widget = initAiWidget(dom.mockDocument, dom.mockWindow);
    assert.equal(widget.getCachedAnswer('Ile kosztuje strona WWW?'), null);
    assert.equal(widget.getCachedAnswer('Jak wygląda współpraca?'), null);
  });
});

