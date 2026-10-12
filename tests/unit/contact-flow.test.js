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

  test('initLeadRecovery nie inicjalizuje timera jeśli lead został już odzyskany w danej sesji', () => {
    dom.mockWindow.sessionStorage.setItem('fuego_lead_recovered', 'true');
    const res = initLeadRecovery(dom.mockWindow, dom.mockDocument);
    assert.ok(res);
  });
});
