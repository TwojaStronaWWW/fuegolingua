import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupMockDom } from '../helpers/mock-dom.js';
import { initNavigation, initTabs } from '../../assets/js/main.js';

describe('Nawigacja i interakcje UI (assets/js/main.js)', () => {
  let dom;

  beforeEach(() => {
    dom = setupMockDom();
    const btn = dom.mockDocument.createElement('button');
    btn.className = 'hamburger';
    btn.setAttribute('aria-expanded', 'false');

    const nav = dom.mockDocument.createElement('ul');
    nav.className = 'nav-links';

    dom.elements.set('hamburger', btn);
    dom.elements.set('nav-links', nav);
  });

  test('initNavigation zwraca null, gdy brakuje wymaganych elementów w DOM', () => {
    const emptyDom = setupMockDom();
    const result = initNavigation(emptyDom.mockDocument);
    assert.equal(result, null);
  });

  test('Kliknięcie przycisku przełącza stan aria-expanded oraz klasę active i is-open', () => {
    const res = initNavigation(dom.mockDocument);
    assert.ok(res);

    res.toggleHandler();
    assert.equal(res.menuBtn.getAttribute('aria-expanded'), 'true');
    assert.ok(res.navLinks.classList.contains('active'));
    assert.ok(res.navLinks.classList.contains('is-open'));

    res.toggleHandler();
    assert.equal(res.menuBtn.getAttribute('aria-expanded'), 'false');
    assert.equal(res.navLinks.classList.contains('active'), false);
    assert.equal(res.navLinks.classList.contains('is-open'), false);
  });

  test('Wciśnięcie klawisza Escape zamyka otwarte menu i zwraca focus', () => {
    const res = initNavigation(dom.mockDocument);
    res.toggleHandler(); // otwórz
    assert.equal(res.menuBtn.getAttribute('aria-expanded'), 'true');

    res.keyHandler({ key: 'Escape' });
    assert.equal(res.menuBtn.getAttribute('aria-expanded'), 'false');
    assert.equal(res.navLinks.classList.contains('active'), false);
    assert.equal(res.menuBtn._focused, true);
  });

  test('Wciśnięcie innego klawisza nie wpływa na otwarte menu', () => {
    const res = initNavigation(dom.mockDocument);
    res.toggleHandler();

    res.keyHandler({ key: 'Enter' });
    assert.equal(res.menuBtn.getAttribute('aria-expanded'), 'true');
    assert.ok(res.navLinks.classList.contains('active'));
  });

  test('initTabs poprawnie przełącza aktywne zakładki oraz stany ARIA po kliknięciu', () => {
    const tab1 = dom.mockDocument.createElement('button');
    tab1.className = 'pricing-tab active';
    tab1.setAttribute('data-target', 'content-1');

    const tab2 = dom.mockDocument.createElement('button');
    tab2.className = 'pricing-tab';
    tab2.setAttribute('data-target', 'content-2');

    const content1 = dom.mockDocument.createElement('div');
    content1.id = 'content-1';
    content1.className = 'pricing-content active';

    const content2 = dom.mockDocument.createElement('div');
    content2.id = 'content-2';
    content2.className = 'pricing-content';

    dom.elements.set('tab1', tab1);
    dom.elements.set('tab2', tab2);
    dom.elements.set('content-1', content1);
    dom.elements.set('content-2', content2);

    const tabsRes = initTabs(dom.mockDocument);
    assert.ok(tabsRes);
    assert.equal(tabsRes.tabs.length, 2);

    // Kliknięcie tab2
    tab2.dispatchEvent({ type: 'click' });

    assert.equal(tab2.classList.contains('active'), true);
    assert.equal(tab2.getAttribute('aria-selected'), 'true');
    assert.equal(tab2.getAttribute('tabindex'), '0');

    assert.equal(tab1.classList.contains('active'), false);
    assert.equal(tab1.getAttribute('aria-selected'), 'false');
    assert.equal(tab1.getAttribute('tabindex'), '-1');

    assert.equal(content2.classList.contains('active'), true);
    assert.equal(content1.classList.contains('active'), false);
    assert.equal(content1.hasAttribute('hidden'), true);
  });

  test('initTabs obsługuje nawigację klawiaturą (ArrowRight, ArrowLeft, Home, End)', () => {
    const tab1 = dom.mockDocument.createElement('button');
    tab1.className = 'pricing-tab active';
    tab1.setAttribute('role', 'tab');
    tab1.setAttribute('data-target', 'c1');

    const tab2 = dom.mockDocument.createElement('button');
    tab2.className = 'pricing-tab';
    tab2.setAttribute('role', 'tab');
    tab2.setAttribute('data-target', 'c2');

    const tab3 = dom.mockDocument.createElement('button');
    tab3.className = 'pricing-tab';
    tab3.setAttribute('role', 'tab');
    tab3.setAttribute('data-target', 'c3');

    const c1 = dom.mockDocument.createElement('div');
    c1.id = 'c1';
    c1.className = 'pricing-content active';

    const c2 = dom.mockDocument.createElement('div');
    c2.id = 'c2';
    c2.className = 'pricing-content';

    const c3 = dom.mockDocument.createElement('div');
    c3.id = 'c3';
    c3.className = 'pricing-content';

    dom.elements.set('t1', tab1);
    dom.elements.set('t2', tab2);
    dom.elements.set('t3', tab3);
    dom.elements.set('c1', c1);
    dom.elements.set('c2', c2);
    dom.elements.set('c3', c3);

    const res = initTabs(dom.mockDocument);
    assert.ok(res);

    // ArrowRight na tab1 -> przejście do tab2
    tab1.dispatchEvent({ type: 'keydown', key: 'ArrowRight', preventDefault: () => {} });
    assert.equal(tab2.classList.contains('active'), true);
    assert.equal(tab2._focused, true);

    // End na tab2 -> przejście do tab3
    tab2.dispatchEvent({ type: 'keydown', key: 'End', preventDefault: () => {} });
    assert.equal(tab3.classList.contains('active'), true);

    // ArrowRight na tab3 -> zapętlenie do tab1
    tab3.dispatchEvent({ type: 'keydown', key: 'ArrowRight', preventDefault: () => {} });
    assert.equal(tab1.classList.contains('active'), true);

    // ArrowLeft na tab1 -> zapętlenie do tab3
    tab1.dispatchEvent({ type: 'keydown', key: 'ArrowLeft', preventDefault: () => {} });
    assert.equal(tab3.classList.contains('active'), true);

    // Home na tab3 -> przejście do tab1
    tab3.dispatchEvent({ type: 'keydown', key: 'Home', preventDefault: () => {} });
    assert.equal(tab1.classList.contains('active'), true);
  });
});
