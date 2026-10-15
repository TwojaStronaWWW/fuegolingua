/**
 * FuegoLingua - Skrypt zbiorczy (kompatybilność wsteczna)
 * Deleguje zadania do dedykowanych modułów ES6: main.js oraz contact.js
 */

import { initNavigation, initSmoothScroll, initTabs, initScrollAnimations } from './main.js';
import { initContactForm, initLeadRecovery } from './contact.js';
import { initAiWidget } from './ai-widget.js';

export function initAll(doc = document, win = globalThis.window) {
  const nav = initNavigation(doc);
  const scroll = initSmoothScroll(doc);
  const tabs = initTabs(doc);
  const anim = initScrollAnimations(doc);
  const contact = initContactForm(doc);
  const lead = initLeadRecovery(win, doc);
  const aiWidget = initAiWidget(doc, win);

  return { nav, scroll, tabs, anim, contact, lead, aiWidget };
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAll(document, window));
  } else {
    initAll(document, window);
  }
}
