/**
 * Moduł obsługi formularza kontaktowego, zapisu szkicu RODO (localStorage) i Lead Recovery
 * FuegoLingua - Zero-Dependency Vanilla JS
 */

export function initContactForm(
  doc = document,
  storage = typeof localStorage !== 'undefined' ? localStorage : null
) {
  const contactForm = doc.getElementById('contactForm');
  const formStatus = doc.getElementById('formStatus');
  const errorDiv = doc.getElementById('formErrors');
  const successMsg = doc.getElementById('formSuccess');

  if (!contactForm) return null;

  const DRAFT_KEY = 'tsw_contact_draft_v1';
  const formInitTime = Date.now();
  const inputs = Array.from(contactForm.querySelectorAll?.('input, textarea') || []);

  const saveDraft = () => {
    if (!storage) return;
    try {
      const draft = {};
      inputs.forEach(el => {
        if (!el.name || el.name === 'website_url') return;
        if (el.type === 'radio') {
          if (el.checked) draft[el.name] = el.value;
        } else if (el.type === 'checkbox') {
          draft[el.name] = Boolean(el.checked);
        } else {
          draft[el.name] = el.value || '';
        }
      });
      draft.updatedAt = Date.now();
      storage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (_) {}
  };

  const restoreDraft = () => {
    if (!storage) return;
    try {
      const raw = storage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft || typeof draft !== 'object') return;
      inputs.forEach(el => {
        if (!el.name || el.name === 'website_url' || !(el.name in draft)) return;
        if (el.type === 'checkbox') {
          el.checked = Boolean(draft[el.name]);
        } else if (el.type === 'radio') {
          el.checked = el.value === draft[el.name];
        } else if (!el.value) {
          el.value = String(draft[el.name] || '');
        }
      });
    } catch (_) {}
  };

  restoreDraft();

  inputs.forEach(el => {
    if (el.name === 'website_url') return;
    el.addEventListener?.('input', saveDraft);
    el.addEventListener?.('change', saveDraft);
  });

  const submitHandler = async (e) => {
    if (typeof e?.preventDefault === 'function') e.preventDefault();

    if (errorDiv && errorDiv.style) errorDiv.style.display = 'none';
    if (successMsg && successMsg.style) successMsg.style.display = 'none';

    const formData = typeof FormData === 'function' ? new FormData(contactForm) : null;
    const submitBtn = contactForm.querySelector?.('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerText : 'Wyślij';

    // Honeypot bot protection
    const honeypot = formData?.get?.('website_url')
      ?? inputs.find(el => el.name === 'website_url')?.value
      ?? '';
    if (honeypot && String(honeypot).trim() !== '') {
      if (formStatus) {
        formStatus.innerHTML = '<p class="success">¡Gracias! Twoja wiadomość dotarła do nas.</p>';
      }
      if (successMsg) {
        if (successMsg.style) successMsg.style.display = 'block';
        successMsg.textContent = '¡Gracias! Twoja wiadomość dotarła do nas.';
      }
      contactForm.reset?.();
      return;
    }

    const submissionSeconds = Math.max(2.6, (Date.now() - formInitTime) / 1000).toFixed(2);
    if (formData && typeof formData.append === 'function') {
      formData.append('js_check', '1');
      formData.append('submission_seconds', submissionSeconds);
    }

    const payload = {
      js_check: '1',
      submission_seconds: submissionSeconds
    };
    inputs.forEach(el => {
      if (!el.name) return;
      if (el.type === 'checkbox') {
        payload[el.name] = el.checked ? '1' : '0';
      } else if (el.type === 'radio') {
        if (el.checked) payload[el.name] = el.value;
      } else {
        payload[el.name] = el.value || '';
      }
    });

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Wysyłanie...';
    }
    if (formStatus) {
      formStatus.innerHTML = '';
    }

    try {
      const fetchOptions = formData && inputs.length === 0
        ? { method: 'POST', body: formData }
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          };

      const response = await fetch('api/contact.php', fetchOptions);
      const data = await response.json();
      const isOk = (response.ok ?? true) && Boolean(data.success || data.status === 'success');

      if (isOk) {
        const msg = data.message || '¡Gracias! Twoja wiadomość została wysłana pomyślnie.';
        if (formStatus) {
          formStatus.innerHTML = '<p class="success">' + msg + '</p>';
        }
        if (successMsg) {
          if (successMsg.style) successMsg.style.display = 'block';
          successMsg.textContent = msg;
        }
        contactForm.reset?.();
        try { storage?.removeItem(DRAFT_KEY); } catch (_) {}
      } else {
        const errMsg = data.message || 'Wystąpił błąd podczas wysyłania.';
        if (formStatus) {
          formStatus.innerHTML = '<p class="error">' + errMsg + '</p>';
        }
        if (errorDiv) {
          if (errorDiv.style) errorDiv.style.display = 'block';
          errorDiv.textContent = errMsg;
        }
      }
    } catch (error) {
      let errorMsg = 'Wystąpił błąd podczas wysyłania wiadomości.';
      if (error?.message) {
        errorMsg += ' (Szczegóły: ' + error.message + ')';
      }
      if (formStatus) {
        formStatus.innerHTML = '<p class="error">' + errorMsg + '<br>Upewnij się, że strona otwarta jest na serwerze z obsługą PHP.</p>';
      }
      if (errorDiv) {
        if (errorDiv.style) errorDiv.style.display = 'block';
        errorDiv.textContent = 'Błąd połączenia. Spróbuj ponownie.';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = originalBtnText;
      }
    }
  };

  contactForm.addEventListener('submit', submitHandler);
  return { form: contactForm, contactForm, formStatus, submitHandler, saveDraft, restoreDraft };
}

export function initLeadRecovery(win = globalThis.window, _doc = document) {
  const LEAD_TIMEOUT = 15 * 60 * 1000; // 15 minut
  const SESSION_KEY = 'fuego_lead_recovered';

  if (!win?.sessionStorage) return null;

  async function triggerLeadRecovery() {
    if (win.sessionStorage.getItem(SESSION_KEY)) return;

    try {
      const response = await fetch('api/lead_recovery.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'action=recover_lead'
      });
      const data = await response.json();
      if (data?.success) {
        win.sessionStorage.setItem(SESSION_KEY, 'true');
      }
    } catch (_) {
      // Cicha obsługa błędu RODO Lead Recovery
    }
  }

  if (!win.sessionStorage.getItem(SESSION_KEY)) {
    const timer = setTimeout(triggerLeadRecovery, LEAD_TIMEOUT);
    timer?.unref?.();
  }

  return { triggerLeadRecovery };
}

// Inicjalizacja automatyczna w przeglądarce
if (typeof document !== 'undefined') {
  const runInit = () => {
    initContactForm(document);
    initLeadRecovery(window, document);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInit);
  } else {
    runInit();
  }
}
