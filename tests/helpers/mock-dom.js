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
      this._listeners = new Map();
      this.style = {};
      this.textContent = '';
      this._innerHTML = '';
      this.children = [];
      this.value = '';
      this.disabled = false;
      this.scrollTop = 0;
      this.scrollHeight = 100;
      this.parentNode = null;
    }

    get innerHTML() {
      return this._innerHTML;
    }

    set innerHTML(val) {
      this._innerHTML = String(val || '');
      if (this._innerHTML === '') {
        this.children = [];
        return;
      }
      const tagRegex = /<([a-zA-Z0-9]+)\b([^>]*)>/g;
      let match;
      while ((match = tagRegex.exec(this._innerHTML)) !== null) {
        const [, tag, attrs] = match;
        const idMatch = attrs.match(/\bid=["']([^"']+)["']/);
        const classMatch = attrs.match(/\bclass=["']([^"']+)["']/);
        if (idMatch) {
          const child = new MockElement(tag, idMatch[1], classMatch ? classMatch[1] : '');
          const ariaExpanded = attrs.match(/\baria-expanded=["']([^"']+)["']/);
          if (ariaExpanded) child.setAttribute('aria-expanded', ariaExpanded[1]);
          const ariaLabel = attrs.match(/\baria-label=["']([^"']+)["']/);
          if (ariaLabel) child.setAttribute('aria-label', ariaLabel[1]);
          child.parentNode = this;
          this.children.push(child);
          elements.set(child.id, child);
        }
      }
    }

    get className() {
      return Array.from(this._classes).join(' ');
    }

    set className(val) {
      this._classes = new Set(val ? String(val).split(' ').filter(Boolean) : []);
    }

    appendChild(child) {
      if (!child) return null;
      child.parentNode = this;
      this.children.push(child);
      if (child.id) elements.set(child.id, child);
      return child;
    }

    remove() {
      if (this.parentNode && Array.isArray(this.parentNode.children)) {
        this.parentNode.children = this.parentNode.children.filter(c => c !== this);
      }
      if (this.id) elements.delete(this.id);
    }

    setAttribute(k, v) {
      this.attributes.set(k, String(v));
      if (k === 'class') this.className = v;
      if (k === 'id') {
        this.id = v;
        elements.set(v, this);
      }
    }
    getAttribute(k) { return this.attributes.get(k) || null; }
    removeAttribute(k) { this.attributes.delete(k); }
    hasAttribute(k) { return this.attributes.has(k); }
    addEventListener(evt, fn) {
      if (!this._listeners.has(evt)) this._listeners.set(evt, []);
      this._listeners.get(evt).push(fn);
    }
    dispatchEvent(evt) {
      const fns = this._listeners.get(evt.type) || [];
      fns.forEach(fn => fn.call(this, evt));
      return true;
    }
    focus() { this._focused = true; }
    reset() { this.value = ''; }
    querySelector(sel) {
      const parts = sel.split(',').map(s => s.trim()).filter(Boolean);
      for (const child of this.children) {
        if (parts.some(p => matchSelector(child, p))) return child;
        const sub = child.querySelector?.(sel);
        if (sub) return sub;
      }
      for (const el of elements.values()) {
        if (parts.some(p => matchSelector(el, p))) return el;
      }
      return null;
    }
    querySelectorAll(sel) {
      return queryAll(sel);
    }
  }

  const matchSelector = (el, rawSel) => {
    const sel = rawSel.trim();
    if (!sel) return false;
    if (sel.startsWith('#')) return el.id === sel.slice(1);
    if (sel.startsWith('.')) return el.classList.contains(sel.slice(1));
    const attrMatch = sel.match(/^(?:[a-zA-Z0-9]+)?\[([a-zA-Z0-9_-]+)(?:(\^=|\*=|=)["']?([^"'\]]*)["']?)?\]$/);
    if (attrMatch) {
      const [, attrName, op, attrVal] = attrMatch;
      if (op === '^=') return (el.getAttribute(attrName) || '').startsWith(attrVal);
      if (op === '*=') return (el.getAttribute(attrName) || '').includes(attrVal);
      if (op === '=') return el.getAttribute(attrName) === attrVal;
      return el.hasAttribute(attrName);
    }
    if (/^[a-zA-Z0-9]+$/.test(sel)) return el.tagName.toLowerCase() === sel.toLowerCase();
    return false;
  };

  const queryAll = (sel) => {
    const parts = sel.split(',').map(s => s.trim()).filter(Boolean);
    const matched = new Set();
    for (const el of elements.values()) {
      if (parts.some(p => matchSelector(el, p))) {
        matched.add(el);
      }
    }
    return Array.from(matched);
  };

  const mockDocument = {
    readyState: 'complete',
    head: new MockElement('head'),
    body: new MockElement('body'),
    documentElement: new MockElement('html'),
    getElementById: (id) => elements.get(id) || null,
    querySelector: (sel) => {
      const parts = sel.split(',').map(s => s.trim()).filter(Boolean);
      for (const el of elements.values()) {
        if (parts.some(p => matchSelector(el, p))) return el;
      }
      return null;
    },
    querySelectorAll: (sel) => queryAll(sel),
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
