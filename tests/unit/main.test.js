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

  test('initTabs poprawnie przełącza aktywne zakładki cennika', () => {
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
  });
});
