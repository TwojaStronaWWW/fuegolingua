/**
 * Moduł obsługi formularza kontaktowego i odzyskiwania leadów (Lead Recovery)
 * FuegoLingua - Zero-Dependency Vanilla JS
 */

export function initContactForm(doc = document) {
  const contactForm = doc.getElementById('contactForm');
  const formStatus = doc.getElementById('formStatus');

  if (!contactForm) return null;

  const submitHandler = async (e) => {
    e.preventDefault();

    const formData = new FormData(contactForm);
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerText : 'Wyślij';

    // Honeypot bot protection
    const honeypot = formData.get('website_url');
    if (honeypot && String(honeypot).trim() !== '') {
      if (formStatus) {
        formStatus.innerHTML = '<p class="success">¡Gracias! Twoja wiadomość dotarła do nas.</p>';
      }
      contactForm.reset();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Wysyłanie...';
    }
    if (formStatus) {
      formStatus.innerHTML = '';
    }

    try {
      const response = await fetch('assets/php/contact.php', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (formStatus) {
        if (data.success) {
          formStatus.innerHTML = '<p class="success">' + data.message + '</p>';
          contactForm.reset();
        } else {
          formStatus.innerHTML = '<p class="error">' + (data.message || 'Wystąpił błąd podczas wysyłania.') + '</p>';
        }
      }
    } catch (error) {
      console.error('Contact form error:', error);
      if (formStatus) {
        let errorMsg = 'Wystąpił błąd podczas wysyłania wiadomości.';
        if (error?.message) {
          errorMsg += ' (Szczegóły: ' + error.message + ')';
        }
        formStatus.innerHTML = '<p class="error">' + errorMsg + '<br>Upewnij się, że strona otwarta jest na serwerze z obsługą PHP.</p>';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = originalBtnText;
      }
    }
  };

  contactForm.addEventListener('submit', submitHandler);
  return { contactForm, formStatus, submitHandler };
}

export function initLeadRecovery(win = globalThis.window, doc = document) {
  const LEAD_TIMEOUT = 15 * 60 * 1000; // 15 minut
  const SESSION_KEY = 'fuego_lead_recovered';

  if (!win?.sessionStorage) return null;

  async function triggerLeadRecovery() {
    if (win.sessionStorage.getItem(SESSION_KEY)) return;

    try {
      const response = await fetch('assets/php/lead_recovery.php', {
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
    } catch (err) {
      console.error('Lead recovery error:', err);
    }
  }

  if (!win.sessionStorage.getItem(SESSION_KEY)) {
    setTimeout(triggerLeadRecovery, LEAD_TIMEOUT);
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
