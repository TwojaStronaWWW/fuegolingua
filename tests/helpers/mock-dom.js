/**
 * Lekki helper Mock DOM do testów jednostkowych w czystym Node.js
 * Eliminuje potrzebę instalowania ciężkich zewnętrznych zależności (np. jsdom).
 */

export function setupMockDom(initialHtml = '<!DOCTYPE html><html><body></body></html>') {
  const elements = new Map();
  const listeners = new Map();

  class MockElement {
    constructor(tagName, id = '', className = '') {
      this.tagName = tagName.toUpperCase();
      this.id = id;
      this._classes = new Set(className ? className.split(' ').filter(Boolean) : []);
      const self = this;
      this.classList = {
        get _classes() { return self._classes; },
        add(...cls) { cls.forEach(c => self._classes.add(c)); },
        remove(...cls) { cls.forEach(c => self._classes.delete(c)); },
        toggle(cls, force) {
          if (typeof force === 'boolean') {
            if (force) self._classes.add(cls);
            else self._classes.delete(cls);
            return force;
          }
          if (self._classes.has(cls)) {
            self._classes.delete(cls);
            return false;
          }
          self._classes.add(cls);
          return true;
        },
        contains(cls) { return self._classes.has(cls); }
      };
      this.attributes = new Map();
      this.style = {};
      this.textContent = '';
      this.innerHTML = '';
      this.children = [];
      this.value = '';
      this.disabled = false;
    }

    get className() {
      return Array.from(this._classes).join(' ');
    }

    set className(val) {
      this._classes = new Set(val ? String(val).split(' ').filter(Boolean) : []);
    }

    setAttribute(k, v) {
      this.attributes.set(k, String(v));
      if (k === 'class') this.className = v;
      if (k === 'id') this.id = v;
    }
    getAttribute(k) { return this.attributes.get(k) || null; }
    removeAttribute(k) { this.attributes.delete(k); }
    hasAttribute(k) { return this.attributes.has(k); }
    addEventListener(evt, fn) {
      if (!listeners.has(evt)) listeners.set(evt, []);
      listeners.get(evt).push(fn);
    }
    dispatchEvent(evt) {
      const fns = listeners.get(evt.type) || [];
      fns.forEach(fn => fn(evt));
      return true;
    }
    focus() { this._focused = true; }
    reset() { this.value = ''; }
    querySelector(sel) {
      if (sel.startsWith('#')) return elements.get(sel.slice(1)) || null;
      if (sel.startsWith('.')) {
        const cls = sel.slice(1);
        for (const el of elements.values()) {
          if (el.classList.contains(cls)) return el;
        }
      }
      return null;
    }
    querySelectorAll(sel) {
      const results = [];
      if (sel.startsWith('.')) {
        const cls = sel.slice(1);
        for (const el of elements.values()) {
          if (el.classList.contains(cls)) results.push(el);
        }
      }
      return results;
    }
  }

  const mockDocument = {
    readyState: 'complete',
    body: new MockElement('body'),
    documentElement: new MockElement('html'),
    getElementById: (id) => elements.get(id) || null,
    querySelector: (sel) => {
      if (sel.startsWith('#')) return elements.get(sel.slice(1)) || null;
      if (sel.startsWith('.')) {
        const cls = sel.slice(1);
        for (const el of elements.values()) {
          if (el.classList.contains(cls)) return el;
        }
      }
      return null;
    },
    querySelectorAll: (sel) => {
      const results = [];
      if (sel.startsWith('.')) {
        const cls = sel.slice(1);
        for (const el of elements.values()) {
          if (el.classList.contains(cls)) results.push(el);
        }
      }
      return results;
    },
    createElement: (tag) => new MockElement(tag),
    addEventListener: (evt, fn) => {
      if (!listeners.has(evt)) listeners.set(evt, []);
      listeners.get(evt).push(fn);
    },
    dispatchEvent: (evt) => {
      const fns = listeners.get(evt.type) || [];
      fns.forEach(fn => fn(evt));
      return true;
    }
  };

  const mockWindow = {
    document: mockDocument,
    innerWidth: 1024,
    innerHeight: 768,
    pageYOffset: 0,
    scrollY: 0,
    scrollTo: () => {},
    sessionStorage: {
      _data: new Map(),
      getItem(k) { return this._data.get(k) || null; },
      setItem(k, v) { this._data.set(k, String(v)); },
      removeItem(k) { this._data.delete(k); },
      clear() { this._data.clear(); }
    },
    localStorage: {
      _data: new Map(),
      getItem(k) { return this._data.get(k) || null; },
      setItem(k, v) { this._data.set(k, String(v)); },
      removeItem(k) { this._data.delete(k); },
      clear() { this._data.clear(); }
    },
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    addEventListener: (evt, fn) => mockDocument.addEventListener(evt, fn)
  };

  globalThis.window = mockWindow;
  globalThis.document = mockDocument;
  globalThis.sessionStorage = mockWindow.sessionStorage;
  globalThis.localStorage = mockWindow.localStorage;

  return { mockWindow, mockDocument, MockElement, elements, listeners };
}
