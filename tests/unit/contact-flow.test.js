import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupMockDom } from '../helpers/mock-dom.js';
import { initContactForm, initLeadRecovery } from '../../assets/js/contact.js';

describe('Obsługa formularza, szkiców RODO (localStorage) i Lead Recovery (assets/js/contact.js)', () => {
  let dom;

  beforeEach(() => {
    dom = setupMockDom();
  });

  test('initContactForm zwraca null, gdy brakuje formularza w DOM', () => {
    const res = initContactForm(dom.mockDocument);
    assert.equal(res, null);
  });

  test('initContactForm inicjalizuje nasłuchiwacz zdarzenia submit oraz obsługuje zapis i odtwarzanie szkicu RODO w localStorage', () => {
    const form = dom.mockDocument.createElement('form');
    form.id = 'contactForm';

    const nameInput = dom.mockDocument.createElement('input');
    nameInput.name = 'name';
    nameInput.type = 'text';
    nameInput.value = '';

    const consentCheckbox = dom.mockDocument.createElement('input');
    consentCheckbox.name = 'newsletter_consent';
    consentCheckbox.type = 'checkbox';
    consentCheckbox.checked = false;

    const status = dom.mockDocument.createElement('div');
    status.id = 'formStatus';

    form.querySelectorAll = () => [nameInput, consentCheckbox];

    dom.elements.set('contactForm', form);
    dom.elements.set('formStatus', status);

    const store = new Map();
    const mockStorage = {
      getItem: (k) => store.get(k) || null,
      setItem: (k, v) => store.set(k, v),
      removeItem: (k) => store.delete(k)
    };

    mockStorage.setItem('tsw_contact_draft_v1', JSON.stringify({
      name: 'Carlos',
      newsletter_consent: true
    }));

    const res = initContactForm(dom.mockDocument, mockStorage);
    assert.ok(res);
    assert.equal(typeof res.submitHandler, 'function');
    assert.equal(nameInput.value, 'Carlos');
    assert.equal(consentCheckbox.checked, true);

    nameInput.value = 'Lucia';
    res.saveDraft();
    const saved = JSON.parse(mockStorage.getItem('tsw_contact_draft_v1'));
    assert.equal(saved.name, 'Lucia');
  });

  test('initLeadRecovery obsługuje odzyskiwanie sesji i nie blokuje pętli zdarzeń', async () => {
    dom.mockWindow.sessionStorage.setItem('fuego_lead_recovered', 'true');
    const res = initLeadRecovery(dom.mockWindow, dom.mockDocument);
    assert.ok(res);
    await res.triggerLeadRecovery();
  });

  test('submitHandler blokuje wysyłkę przy wypełnionym polu honeypot i obsługuje wysyłkę fetch do api/contact.php', async () => {
    const form = dom.mockDocument.createElement('form');
    form.id = 'contactForm';
    const status = dom.mockDocument.createElement('div');
    status.id = 'formStatus';
    const errorDiv = dom.mockDocument.createElement('div');
    errorDiv.id = 'formErrors';
    const successMsg = dom.mockDocument.createElement('div');
    successMsg.id = 'formSuccess';
    const submitBtn = dom.mockDocument.createElement('button');
    submitBtn.setAttribute('type', 'submit');
    submitBtn.innerText = 'Wyślij';
    form.appendChild(submitBtn);

    dom.elements.set('contactForm', form);
    dom.elements.set('formStatus', status);
    dom.elements.set('formErrors', errorDiv);
    dom.elements.set('formSuccess', successMsg);

    const origFormData = globalThis.FormData;
    const origFetch = globalThis.fetch;
    let honeypotValue = 'https://spam.bot';

    globalThis.FormData = class {
      get(key) {
        return key === 'website_url' ? honeypotValue : 'test';
      }
      append() {}
    };

    try {
      const res = initContactForm(dom.mockDocument);
      await res.submitHandler({ preventDefault: () => {} });
      assert.match(status.innerHTML, /Gracias/i);

      honeypotValue = '';
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({ success: true, message: 'Wysłano pomyślnie' })
      });
      await res.submitHandler({ preventDefault: () => {} });
      assert.match(status.innerHTML, /Wysłano pomyślnie/);
      assert.equal(successMsg.textContent, 'Wysłano pomyślnie');

      globalThis.fetch = async () => ({
        ok: false,
        json: async () => ({ success: false, message: 'Błąd walidacji' })
      });
      await res.submitHandler({ preventDefault: () => {} });
      assert.match(status.innerHTML, /Błąd walidacji/);
      assert.equal(errorDiv.textContent, 'Błąd walidacji');
    } finally {
      globalThis.FormData = origFormData;
      globalThis.fetch = origFetch;
    }
  });
});
