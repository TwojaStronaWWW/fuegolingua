import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupMockDom } from '../helpers/mock-dom.js';
import { initNavigation, initTabs, initLightbox } from '../../assets/js/main.js';

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

  test('initLightbox zwraca null gdy brak elementów w DOM', () => {
    const emptyDom = setupMockDom();
    const res = initLightbox(emptyDom.mockDocument);
    assert.equal(res, null);
  });

  test('initLightbox poprawnie otwiera modal po kliknięciu i obsługuje klawiaturę', () => {
    const modal = dom.mockDocument.createElement('div');
    modal.id = 'image-lightbox';
    modal.setAttribute('hidden', '');

    const imgEl = dom.mockDocument.createElement('img');
    imgEl.id = 'lightbox-image';

    const captionEl = dom.mockDocument.createElement('div');
    captionEl.id = 'lightbox-caption';

    const closeBtn = dom.mockDocument.createElement('button');
    closeBtn.id = 'lightbox-close';

    const prevBtn = dom.mockDocument.createElement('button');
    prevBtn.id = 'lightbox-prev';

    const nextBtn = dom.mockDocument.createElement('button');
    nextBtn.id = 'lightbox-next';

    const backdrop = dom.mockDocument.createElement('div');
    backdrop.id = 'lightbox-backdrop';

    modal.children.push(imgEl, captionEl, closeBtn, prevBtn, nextBtn, backdrop);

    const galleryItem1 = dom.mockDocument.createElement('button');
    galleryItem1.className = 'pricing-gallery-item';
    const img1 = dom.mockDocument.createElement('img');
    img1.setAttribute('src', 'https://media.fuegolingua.pl/plakat1.webp');
    img1.setAttribute('alt', 'Plakat 1');
    galleryItem1.children.push(img1);

    const galleryItem2 = dom.mockDocument.createElement('button');
    galleryItem2.className = 'pricing-gallery-item';
    const img2 = dom.mockDocument.createElement('img');
    img2.setAttribute('src', 'https://media.fuegolingua.pl/plakat2.webp');
    img2.setAttribute('alt', 'Plakat 2');
    galleryItem2.children.push(img2);

    dom.elements.set('image-lightbox', modal);
    dom.elements.set('lightbox-image', imgEl);
    dom.elements.set('lightbox-caption', captionEl);
    dom.elements.set('lightbox-close', closeBtn);
    dom.elements.set('lightbox-prev', prevBtn);
    dom.elements.set('lightbox-next', nextBtn);
    dom.elements.set('lightbox-backdrop', backdrop);
    dom.elements.set('item1', galleryItem1);
    dom.elements.set('item2', galleryItem2);

    const lb = initLightbox(dom.mockDocument);
    assert.ok(lb);

    // Otwórz plakat 1
    galleryItem1.dispatchEvent({ type: 'click' });
    assert.equal(modal.classList.contains('is-open'), true);
    assert.equal(modal.hasAttribute('hidden'), false);
    assert.equal(imgEl.getAttribute('src'), 'https://media.fuegolingua.pl/plakat1.webp');
    assert.equal(captionEl.textContent, 'Plakat 1');
    assert.equal(closeBtn._focused, true);

    // Nawigacja ArrowRight -> przejście do plakatu 2
    dom.mockDocument.dispatchEvent({ type: 'keydown', key: 'ArrowRight', preventDefault: () => {} });
    assert.equal(imgEl.getAttribute('src'), 'https://media.fuegolingua.pl/plakat2.webp');
    assert.equal(captionEl.textContent, 'Plakat 2');

    // Nawigacja ArrowLeft -> powrót do plakatu 1
    dom.mockDocument.dispatchEvent({ type: 'keydown', key: 'ArrowLeft', preventDefault: () => {} });
    assert.equal(imgEl.getAttribute('src'), 'https://media.fuegolingua.pl/plakat1.webp');

    // Klawisz Escape -> zamknięcie i powrót do item1
    dom.mockDocument.dispatchEvent({ type: 'keydown', key: 'Escape', preventDefault: () => {} });
    assert.equal(modal.classList.contains('is-open'), false);
    assert.equal(modal.hasAttribute('hidden'), true);
    assert.equal(galleryItem1._focused, true);
  });
});
