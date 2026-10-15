import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupMockDom } from '../helpers/mock-dom.js';
import { initContactForm, initLeadRecovery } from '../../assets/js/contact.js';

describe('Obsługa formularza i Lead Recovery (assets/js/contact.js)', () => {
  let dom;

  beforeEach(() => {
    dom = setupMockDom();
  });

  test('initContactForm zwraca null, gdy brakuje formularza w DOM', () => {
    const res = initContactForm(dom.mockDocument);
    assert.equal(res, null);
  });

  test('initContactForm inicjalizuje nasłuchiwacz zdarzenia submit', () => {
    const form = dom.mockDocument.createElement('form');
    form.id = 'contactForm';

    const status = dom.mockDocument.createElement('div');
    status.id = 'formStatus';

    const submitBtn = dom.mockDocument.createElement('button');
    submitBtn.setAttribute('type', 'submit');
    submitBtn.textContent = 'Wyślij';

    dom.elements.set('contactForm', form);
    dom.elements.set('formStatus', status);

    const res = initContactForm(dom.mockDocument);
    assert.ok(res);
    assert.equal(typeof res.submitHandler, 'function');
  });

  test('initLeadRecovery nie inicjalizuje timera jeśli lead został już odzyskany w danej sesji', async () => {
    dom.mockWindow.sessionStorage.setItem('fuego_lead_recovered', 'true');
    const res = initLeadRecovery(dom.mockWindow, dom.mockDocument);
    assert.ok(res);
    await res.triggerLeadRecovery();
  });

  test('submitHandler blokuje wysyłkę przy wypełnionym polu honeypot i obsługuje wysyłkę fetch', async () => {
    const form = dom.mockDocument.createElement('form');
    form.id = 'contactForm';
    const status = dom.mockDocument.createElement('div');
    status.id = 'formStatus';
    const submitBtn = dom.mockDocument.createElement('button');
    submitBtn.setAttribute('type', 'submit');
    submitBtn.innerText = 'Wyślij';
    form.appendChild(submitBtn);

    dom.elements.set('contactForm', form);
    dom.elements.set('formStatus', status);

    const origFormData = globalThis.FormData;
    const origFetch = globalThis.fetch;
    let honeypotValue = 'https://spam.bot';

    globalThis.FormData = class {
      get(key) {
        return key === 'website_url' ? honeypotValue : 'test';
      }
    };

    try {
      const res = initContactForm(dom.mockDocument);
      await res.submitHandler({ preventDefault: () => {} });
      assert.match(status.innerHTML, /Gracias/i);

      honeypotValue = '';
      globalThis.fetch = async () => ({
        json: async () => ({ success: true, message: 'Wysłano pomyślnie' })
      });
      await res.submitHandler({ preventDefault: () => {} });
      assert.match(status.innerHTML, /Wysłano pomyślnie/);

      globalThis.fetch = async () => ({
        json: async () => ({ success: false, message: 'Błąd walidacji' })
      });
      await res.submitHandler({ preventDefault: () => {} });
      assert.match(status.innerHTML, /Błąd walidacji/);
    } finally {
      globalThis.FormData = origFormData;
      globalThis.fetch = origFetch;
    }
  });
});
