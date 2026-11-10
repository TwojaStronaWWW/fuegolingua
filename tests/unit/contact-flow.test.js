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

  test('initContactForm inicjalizuje nasłuchiwacz zdarzenia submit oraz obsługuje zapis i odtwarzanie szkicu RODO (w tym <select name="purpose">) w localStorage', () => {
    const form = dom.mockDocument.createElement('form');
    form.id = 'contactForm';

    const nameInput = dom.mockDocument.createElement('input');
    nameInput.name = 'name';
    nameInput.type = 'text';
    nameInput.value = '';

    const purposeSelect = dom.mockDocument.createElement('select');
    purposeSelect.name = 'purpose';
    purposeSelect.type = 'select-one';
    purposeSelect.value = '';

    const consentCheckbox = dom.mockDocument.createElement('input');
    consentCheckbox.name = 'newsletter_consent';
    consentCheckbox.type = 'checkbox';
    consentCheckbox.checked = false;

    const status = dom.mockDocument.createElement('div');
    status.id = 'formStatus';

    form.querySelectorAll = () => [nameInput, purposeSelect, consentCheckbox];

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
      purpose: 'praca',
      newsletter_consent: true
    }));

    const res = initContactForm(dom.mockDocument, mockStorage);
    assert.ok(res);
    assert.equal(typeof res.submitHandler, 'function');
    assert.equal(nameInput.value, 'Carlos');
    assert.equal(purposeSelect.value, 'praca');
    assert.equal(consentCheckbox.checked, true);

    nameInput.value = 'Lucia';
    purposeSelect.value = 'podroze';
    res.saveDraft();
    const saved = JSON.parse(mockStorage.getItem('tsw_contact_draft_v1'));
    assert.equal(saved.name, 'Lucia');
    assert.equal(saved.purpose, 'podroze');
  });

  test('initLeadRecovery obsługuje odzyskiwanie sesji i nie blokuje pętli zdarzeń', async () => {
    dom.mockWindow.sessionStorage.setItem('fuego_lead_recovered', 'true');
    const res = initLeadRecovery(dom.mockWindow, dom.mockDocument);
    assert.ok(res);
    await res.triggerLeadRecovery();
  });

  test('submitHandler mierzy rzeczywisty czas interakcji (blokada bota < 2s bez sztucznego podbijania oraz poprawna wysyłka > 3s) i chroni honeypotem', async () => {
    const form = dom.mockDocument.createElement('form');
    form.id = 'contactForm';
    const nameInput = dom.mockDocument.createElement('input');
    nameInput.name = 'name';
    nameInput.type = 'text';
    nameInput.value = 'Elena';

    const emailInput = dom.mockDocument.createElement('input');
    emailInput.name = 'email';
    emailInput.type = 'email';
    emailInput.value = 'elena@example.com';

    const purposeSelect = dom.mockDocument.createElement('select');
    purposeSelect.name = 'purpose';
    purposeSelect.value = 'biznes';

    const honeypotInput = dom.mockDocument.createElement('input');
    honeypotInput.name = 'website_url';
    honeypotInput.type = 'text';
    honeypotInput.value = 'https://spam.bot';

    form.querySelectorAll = () => [nameInput, emailInput, purposeSelect, honeypotInput];

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
    const origPerfDesc = Object.getOwnPropertyDescriptor(globalThis, 'performance');
    const origDateNow = Date.now;

    let simulatedMs = 10000;
    Date.now = () => simulatedMs;
    Object.defineProperty(globalThis, 'performance', {
      configurable: true,
      writable: true,
      value: { now: () => simulatedMs }
    });

    globalThis.FormData = class {
      get(key) {
        return key === 'website_url' ? honeypotInput.value : '';
      }
      append() {}
    };

    try {
      const res = initContactForm(dom.mockDocument);

      // 1. Test Honeypot (natychmiastowe odrzucenie bez fetch)
      let fetchCalled = false;
      globalThis.fetch = async () => {
        fetchCalled = true;
        throw new Error('Fetch nie powinien zostać wywołany dla honeypota');
      };
      await res.submitHandler({ preventDefault: () => {} });
      assert.equal(fetchCalled, false);
      assert.match(status.innerHTML, /Gracias/i);

      // 2. Test bota wysyłającego formularz w < 2s (np. 0.45s) — brak sztucznego Math.max(2.6, ...)
      honeypotInput.value = '';
      simulatedMs = 10450; // 0.45 sekundy od inicjalizacji formularza (10000 ms)
      let capturedPayload = null;
      globalThis.fetch = async (_url, options) => {
        capturedPayload = JSON.parse(options.body);
        const sec = Number(capturedPayload.submission_seconds);
        if (sec < 2.5) {
          return {
            ok: false,
            json: async () => ({ success: false, status: 'bot_blocked', message: 'Zbyt szybkie wysłanie formularza.' })
          };
        }
        return {
          ok: true,
          json: async () => ({ success: true, message: 'Wysłano pomyślnie' })
        };
      };

      await res.submitHandler({ preventDefault: () => {} });
      assert.ok(capturedPayload, 'Payload powinien zostać zbudowany');
      assert.equal(capturedPayload.submission_seconds, '0.45');
      assert.ok(Number(capturedPayload.submission_seconds) < 2.0, 'Czas bota < 2s nie może być sztucznie podbijany do >= 2.6s');
      assert.match(status.innerHTML, /Zbyt szybkie wysłanie formularza/);
      assert.equal(errorDiv.textContent, 'Zbyt szybkie wysłanie formularza.');

      // 3. Test realnego użytkownika (> 3 sekundy, np. 3.60s) — poprawna wysyłka i escapowanie HTML
      simulatedMs = 13600; // 3.60 sekundy od inicjalizacji formularza
      await res.submitHandler({ preventDefault: () => {} });
      assert.equal(capturedPayload.submission_seconds, '3.60');
      assert.ok(Number(capturedPayload.submission_seconds) > 3.0);
      assert.equal(capturedPayload.purpose, 'biznes');
      assert.match(status.innerHTML, /Wysłano pomyślnie/);
      assert.equal(successMsg.textContent, 'Wysłano pomyślnie');

      // 4. Test błędu walidacji z potencjalnym XSS w komunikacie z serwera
      globalThis.fetch = async () => ({
        ok: false,
        json: async () => ({ success: false, message: 'Błąd walidacji <img src=x onerror=alert(1)>' })
      });
      await res.submitHandler({ preventDefault: () => {} });
      assert.match(status.innerHTML, /Błąd walidacji &lt;img/);
      assert.doesNotMatch(status.innerHTML, /<img/i);
    } finally {
      globalThis.FormData = origFormData;
      globalThis.fetch = origFetch;
      Date.now = origDateNow;
      if (origPerfDesc) {
        Object.defineProperty(globalThis, 'performance', origPerfDesc);
      }
    }
  });
});
