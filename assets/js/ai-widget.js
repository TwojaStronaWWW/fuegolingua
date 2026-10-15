/**
 * FuegoLingua - Moduł Asystenta AI (Universal Embeddable AI Agent Widget v2.1)
 *
 * Architektura Platform-First & Zero-Bloat (Vanilla ES6+):
 * - Komunikacja z centralnym routerem AI na VPS (https://ai.twojastronawww.pl/chat-router.php)
 * - Pamięć rozmowy Multi-Turn (do 8 ostatnich wiadomości w sessionStorage)
 * - Bezpieczny mikro-parser Markdown (100% odporny na XSS)
 * - Szybkie podpowiedzi pytań (Quick Prompts)
 * - Lokalny merytoryczny fallback (Zero-Downtime Knowledge Base) na wypadek braku połączenia z VPS
 */

export const QUICK_PROMPTS_MAP = {
  fuegolingua: [
    'Bezpłatna lekcja próbna',
    'Ile kosztuje kurs hiszpańskiego?',
    'Zajęcia indywidualne czy grupowe?',
    'Hiszpański w biznesie / branżowy'
  ],
  katosalsahub: [
    'Ile kosztuje karnet?',
    'Czy akceptujecie Multisport?',
    'Kursy od podstaw (P0)'
  ],
  twojastronawww: [
    'Ile kosztuje strona WWW?',
    'Wdrożenie czatbota AI',
    'Jak wygląda współpraca?'
  ]
};

/**
 * Bezpieczny mikro-parser Markdown (100% odporny na XSS)
 * @param {string} rawText
 * @returns {string}
 */
export function formatMarkdown(rawText) {
  if (!rawText) return '';
  let safe = String(rawText)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // Pogrubienia **tekst**
  safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Klikalne adresy URL (https://...)
  safe = safe.replace(
    /(https?:\/\/[^\s<)]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="tsw-ai-link">$1</a>'
  );

  // Klikalne adresy e-mail
  safe = safe.replace(
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    '<a href="mailto:$1" class="tsw-ai-link">$1</a>'
  );

  const lines = safe.split(/\r?\n/);
  let html = '';
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      if (!inList) {
        html += '<ul class="tsw-ai-list">';
        inList = true;
      }
      html += '<li>' + bulletMatch[1] + '</li>';
    } else {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      if (line !== '') {
        html += (html && !html.endsWith('</ul>') ? '<br>' : '') + line;
      } else if (html && !html.endsWith('<br>')) {
        html += '<br>';
      }
    }
  }
  if (inList) {
    html += '</ul>';
  }
  return html;
}

/**
 * Lokalna odpowiedź awaryjna oparta na oficjalnej bazie wiedzy FuegoLingua
 * (gwarantuje ciągłość obsługi klienta przy chwilowej niedostępności sieci/tunelu VPS)
 * @param {string} question
 * @returns {string}
 */
export function getLocalFallbackAnswer(question) {
  const q = String(question || '').toLowerCase();

  if (q.includes('próbn') || q.includes('probn') || q.includes('darmow') || q.includes('bezpłatn') || q.includes('bezplatn') || q.includes('konsultacj')) {
    return 'Pierwsza **konsultacja wstępna online jest całkowicie bezpłatna**! To krótkie spotkanie, podczas którego poznajemy się, określamy Twój poziom i ustalamy plan nauki.\n- Zapisz się przez formularz na dole strony\n- Napisz na: kontakt@fuegolingua.pl\n- Zadzwoń: **796-868-967**';
  }

  if (q.includes('biznes') || q.includes('firm') || q.includes('stolar') || q.includes('budow') || q.includes('turyst') || q.includes('branż') || q.includes('specjalist')) {
    return 'Prowadzimy dedykowane **kursy specjalistyczne** (cena maleje o **5 zł** za każdą dodatkową osobę, do 6 osób):\n- **Hiszpański w Biznesie**: od **130 zł** (60 min) / **160 zł** (90 min)\n- **Hiszpański w Stolarce i Budownictwie**: od **150 zł** (60 min) / **170 zł** (90 min)\n- **Hiszpański w Turystyce**: od **100 zł** (60 min) / **120 zł** (90 min)\nPełny wykaz znajdziesz w zakładce https://fuegolingua.pl/cennik.html';
  }

  if (q.includes('cen') || q.includes('koszt') || q.includes('ile ') || q.includes('pakiet') || q.includes('płaci')) {
    return 'Oto nasz cennik dla **Ogólnych Poziomów (A1–B2)**:\n- **Lekcje indywidualne (1:1)**: 60 min – **95 zł** | 90 min – **135 zł**\n- **Lekcje w parze (2 osoby)**: 60 min – **85 zł/os.** | 90 min – **115 zł/os.**\n- **Grupy (3–6 osób)**: 60 min – **75 zł/os.** | 90 min – **95 zł/os.**\n- **Poziom Extreme (C1–C2)**: 1:1 od **140 zł** (60 min), w parze **120 zł/os.**, w grupie **100 zł/os.**\nPierwsza konsultacja jest **bezpłatna**!';
  }

  if (q.includes('indywidualn') || q.includes('grupow') || q.includes('parze') || q.includes('form') || q.includes('wygląda')) {
    return 'Zajęcia odbywają się w **100% online na żywo**, a **80% lekcji to żywa rozmowa**:\n- **Indywidualnie (1:1)**: 100% uwagi lektora i tempo dopasowane do Ciebie (**95 zł** / 60 min na poz. A1–B2)\n- **W parze (2 os.)**: wspólna nauka ze znajomym lub partnerem (**85 zł/os.** / 60 min)\n- **Kameralne grupy (3–6 os.)**: duża dawka interakcji i wzajemnej motywacji (**75 zł/os.** / 60 min)';
  }

  if (q.includes('kontakt') || q.includes('telefon') || q.includes('mail') || q.includes('zapis')) {
    return 'Skontaktuj się ze mną wygodnie:\n- E-mail: kontakt@fuegolingua.pl\n- Telefon: **796-868-967**\n- Instagram: **@fuegolingua_sin_limites**\nMożesz też wypełnić formularz kontaktowy na dole strony głównej!';
  }

  return 'W **Fuego Lingua** uczymy żywego języka hiszpańskiego online (poziomy **A1–C2**, przygotowanie do **DELE/matury** oraz kursy specjalistyczne: **Biznes, Budownictwo, Turystyka**).\n- Lekcje 1:1 już od **95 zł / 60 min** (w grupie od **75 zł/os.**)\n- Pierwsza konsultacja wstępna jest **bezpłatna**!\nNapisz na kontakt@fuegolingua.pl lub zadzwoń pod **796-868-967**.';
}

/**
 * Inicjalizuje widget czatu AI w drzewie DOM
 * @param {Document} doc
 * @param {Window} win
 */
export function initAiWidget(doc = document, win = globalThis.window) {
  if (!doc || !doc.body) return null;
  if (doc.getElementById('tsw-ai-widget-root')) return null;

  const scriptEl =
    doc.currentScript ||
    doc.querySelector('script[data-site-id]') ||
    doc.querySelector('script[src*="ai-widget.js"]') ||
    doc.querySelector('script[src*="widget.js"]');

  const siteId = (scriptEl?.getAttribute('data-site-id') || 'fuegolingua').toLowerCase();
  const isLocalhost =
    win?.location?.hostname === 'localhost' || win?.location?.hostname === '127.0.0.1';
  const defaultRouterUrl = isLocalhost
    ? 'http://localhost:8085/chat-router.php'
    : 'https://ai.twojastronawww.pl/chat-router.php';
  const routerUrl = scriptEl?.getAttribute('data-router-url') || defaultRouterUrl;
  const title = scriptEl?.getAttribute('data-title') || 'Asystent Fuego Lingua';
  const storageKey = 'tsw_ai_history_' + siteId;
  const quickPrompts = QUICK_PROMPTS_MAP[siteId] || QUICK_PROMPTS_MAP.fuegolingua;

  const style = doc.createElement('style');
  style.id = 'tsw-ai-widget-styles';
  style.textContent = `
    .tsw-ai-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #c92a2a 0%, #e8590c 100%);
      color: #ffffff;
      box-shadow: 0 8px 24px rgba(201, 42, 42, 0.4);
      border: 2px solid rgba(255, 212, 59, 0.65);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s;
    }
    .tsw-ai-btn:hover,
    .tsw-ai-btn:focus-visible {
      transform: scale(1.08);
      box-shadow: 0 12px 30px rgba(232, 89, 12, 0.55);
      outline: 3px solid #ffd43b;
      outline-offset: 2px;
    }
    .tsw-ai-btn svg {
      width: 28px;
      height: 28px;
      fill: currentColor;
    }
    .tsw-ai-window {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 390px;
      max-width: calc(100vw - 32px);
      height: 550px;
      max-height: calc(100vh - 120px);
      background: #1a1110;
      border: 1px solid rgba(255, 180, 120, 0.2);
      border-radius: 18px;
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.6);
      z-index: 999999;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: 'Raleway', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      transition: opacity 0.25s, transform 0.25s, visibility 0.25s;
      opacity: 0;
      transform: translateY(16px) scale(0.96);
      visibility: hidden;
      pointer-events: none;
    }
    .tsw-ai-window.tsw-open {
      opacity: 1;
      transform: translateY(0) scale(1);
      visibility: visible;
      pointer-events: auto;
    }
    .tsw-ai-header {
      background: linear-gradient(135deg, #2b1614 0%, #3d1c18 100%);
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 180, 120, 0.15);
    }
    .tsw-ai-header-title {
      font-size: 15px;
      font-weight: 700;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .tsw-ai-status-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #2ecc71;
      box-shadow: 0 0 8px #2ecc71;
    }
    .tsw-ai-header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .tsw-ai-icon-btn {
      background: transparent;
      border: none;
      color: #f1f5f9;
      cursor: pointer;
      font-size: 16px;
      padding: 4px 8px;
      border-radius: 6px;
      line-height: 1;
      transition: color 0.15s, background 0.15s;
    }
    .tsw-ai-icon-btn:hover,
    .tsw-ai-icon-btn:focus-visible {
      color: #ffd43b;
      background: rgba(255, 255, 255, 0.12);
    }
    .tsw-ai-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .tsw-ai-msg {
      max-width: 88%;
      padding: 11px 14px;
      border-radius: 14px;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
    }
    .tsw-ai-msg strong {
      color: #ffd43b;
      font-weight: 700;
    }
    .tsw-ai-list {
      margin: 6px 0 4px 18px;
      padding: 0;
      list-style: disc;
    }
    .tsw-ai-list li {
      margin-bottom: 4px;
    }
    .tsw-ai-link {
      color: #ffd43b;
      text-decoration: underline;
      word-break: break-all;
    }
    .tsw-ai-msg-bot {
      background: #2b1d1b;
      color: #f8fafc;
      align-self: flex-start;
      border-bottom-left-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .tsw-ai-msg-user {
      background: linear-gradient(135deg, #c92a2a 0%, #e8590c 100%);
      color: #ffffff;
      align-self: flex-end;
      border-bottom-right-radius: 4px;
    }
    .tsw-ai-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 0 16px 10px;
    }
    .tsw-ai-chip {
      background: rgba(232, 89, 12, 0.18);
      border: 1px solid rgba(255, 212, 59, 0.45);
      color: #fff3bf;
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, transform 0.1s;
    }
    .tsw-ai-chip:hover,
    .tsw-ai-chip:focus-visible {
      background: rgba(232, 89, 12, 0.35);
      border-color: #ffd43b;
      color: #ffffff;
      transform: translateY(-1px);
    }
    .tsw-ai-input-bar {
      padding: 12px;
      background: #261715;
      border-top: 1px solid rgba(255, 180, 120, 0.15);
      display: flex;
      gap: 8px;
    }
    .tsw-ai-input {
      flex: 1;
      background: #140c0b;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 10px;
      padding: 10px 14px;
      color: #ffffff;
      font-size: 14px;
      outline: none;
    }
    .tsw-ai-input::placeholder {
      color: #cbd5e1;
    }
    .tsw-ai-input:focus {
      border-color: #ffd43b;
    }
    .tsw-ai-send {
      background: linear-gradient(135deg, #c92a2a 0%, #e8590c 100%);
      border: 1px solid rgba(255, 212, 59, 0.5);
      border-radius: 10px;
      padding: 0 16px;
      color: #ffffff;
      font-weight: 700;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.15s;
    }
    .tsw-ai-send:hover:not(:disabled) {
      transform: translateY(-1px);
    }
    .tsw-ai-send:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .tsw-ai-typing {
      font-size: 12px;
      color: #e2e8f0;
      font-style: italic;
    }
  `;
  (doc.head || doc.documentElement || doc.body).appendChild(style);

  const root = doc.createElement('div');
  root.id = 'tsw-ai-widget-root';
  root.innerHTML = `
    <button type="button" class="tsw-ai-btn" id="tswAiToggleBtn" aria-label="Otwórz czat z asystentem Fuego Lingua" aria-expanded="false" aria-controls="tswAiWindow">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
    </button>

    <div class="tsw-ai-window" id="tswAiWindow" role="dialog" aria-label="${title}">
      <div class="tsw-ai-header">
        <div class="tsw-ai-header-title">
          <span class="tsw-ai-status-dot" aria-hidden="true"></span>
          <span>${title}</span>
        </div>
        <div class="tsw-ai-header-actions">
          <button type="button" class="tsw-ai-icon-btn" id="tswAiClearBtn" title="Nowa rozmowa" aria-label="Nowa rozmowa">&#x21bb;</button>
          <button type="button" class="tsw-ai-icon-btn" id="tswAiCloseBtn" title="Zamknij czat" aria-label="Zamknij czat">&times;</button>
        </div>
      </div>

      <div class="tsw-ai-messages" id="tswAiMessages" aria-live="polite"></div>
      <div class="tsw-ai-chips" id="tswAiChips"></div>

      <form class="tsw-ai-input-bar" id="tswAiForm">
        <input type="text" class="tsw-ai-input" id="tswAiInput" placeholder="Napisz pytanie o kurs lub cennik..." aria-label="Zadaj pytanie asystentowi" required autocomplete="off" />
        <button type="submit" class="tsw-ai-send" id="tswAiSendBtn">Wyślij</button>
      </form>
    </div>
  `;
  doc.body.appendChild(root);

  const toggleBtn = doc.getElementById('tswAiToggleBtn');
  const closeBtn = doc.getElementById('tswAiCloseBtn');
  const clearBtn = doc.getElementById('tswAiClearBtn');
  const chatWindow = doc.getElementById('tswAiWindow');
  const chatForm = doc.getElementById('tswAiForm');
  const chatInput = doc.getElementById('tswAiInput');
  const messagesContainer = doc.getElementById('tswAiMessages');
  const chipsContainer = doc.getElementById('tswAiChips');
  const sendBtn = doc.getElementById('tswAiSendBtn');

  let conversationHistory = [];
  try {
    const saved = win?.sessionStorage?.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) conversationHistory = parsed.slice(-8);
    }
  } catch (_) {}

  function saveHistory() {
    try {
      win?.sessionStorage?.setItem(storageKey, JSON.stringify(conversationHistory.slice(-8)));
    } catch (_) {}
  }

  function appendMessageElement(role, text) {
    if (!messagesContainer) return null;
    const msg = doc.createElement('div');
    msg.className = 'tsw-ai-msg ' + (role === 'user' ? 'tsw-ai-msg-user' : 'tsw-ai-msg-bot');
    if (role === 'user') {
      msg.textContent = text;
    } else {
      msg.innerHTML = formatMarkdown(text);
    }
    messagesContainer.appendChild(msg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return msg;
  }

  function renderChips() {
    if (!chipsContainer) return;
    chipsContainer.innerHTML = '';
    if (conversationHistory.length > 0) {
      chipsContainer.style.display = 'none';
      return;
    }
    chipsContainer.style.display = 'flex';
    quickPrompts.forEach((promptText) => {
      const chip = doc.createElement('button');
      chip.type = 'button';
      chip.className = 'tsw-ai-chip';
      chip.textContent = promptText;
      chip.addEventListener('click', () => {
        sendQuestion(promptText);
      });
      chipsContainer.appendChild(chip);
    });
  }

  function renderInitialView() {
    if (!messagesContainer) return;
    messagesContainer.innerHTML = '';
    appendMessageElement(
      'model',
      '¡Hola! 💃 Jestem wirtualnym doradcą **Fuego Lingua**. W czym mogę Ci pomóc? Zapytaj o bezpłatną lekcję próbną, cennik lub kursy hiszpańskiego!'
    );
    for (let i = 0; i < conversationHistory.length; i++) {
      appendMessageElement(conversationHistory[i].role, conversationHistory[i].text);
    }
    renderChips();
  }

  function toggleChat() {
    if (!chatWindow || !toggleBtn) return;
    const isOpen = chatWindow.classList.toggle('tsw-open');
    toggleBtn.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) {
      chatInput?.focus?.();
    }
  }

  function closeChat() {
    if (!chatWindow || !toggleBtn) return;
    chatWindow.classList.remove('tsw-open');
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.focus?.();
  }

  toggleBtn?.addEventListener('click', toggleChat);
  closeBtn?.addEventListener('click', closeChat);
  clearBtn?.addEventListener('click', () => {
    conversationHistory = [];
    saveHistory();
    renderInitialView();
  });

  doc.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && chatWindow?.classList.contains('tsw-open')) {
      closeChat();
    }
  });

  async function sendQuestion(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed || sendBtn?.disabled) return;

    if (chipsContainer) chipsContainer.style.display = 'none';
    appendMessageElement('user', trimmed);
    if (chatInput) chatInput.value = '';

    const typingMsg = doc.createElement('div');
    typingMsg.className = 'tsw-ai-msg tsw-ai-msg-bot tsw-ai-typing';
    typingMsg.textContent = 'Asystent pisze...';
    messagesContainer?.appendChild(typingMsg);
    if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;

    if (sendBtn) sendBtn.disabled = true;

    try {
      const fetchFn = win?.fetch || globalThis.fetch;
      const res = await fetchFn(routerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_id: siteId,
          question: trimmed,
          history: conversationHistory.slice(-8)
        })
      });

      const data = await res.json();
      typingMsg.remove?.();

      if (res.ok && data && data.success && data.answer) {
        appendMessageElement('model', data.answer);
        conversationHistory.push({ role: 'user', text: trimmed });
        conversationHistory.push({ role: 'model', text: data.answer });
      } else {
        const fallback = getLocalFallbackAnswer(trimmed);
        appendMessageElement('model', fallback);
        conversationHistory.push({ role: 'user', text: trimmed });
        conversationHistory.push({ role: 'model', text: fallback });
      }
      conversationHistory = conversationHistory.slice(-8);
      saveHistory();
    } catch (_) {
      typingMsg.remove?.();
      const fallback = getLocalFallbackAnswer(trimmed);
      appendMessageElement('model', fallback);
      conversationHistory.push({ role: 'user', text: trimmed });
      conversationHistory.push({ role: 'model', text: fallback });
      conversationHistory = conversationHistory.slice(-8);
      saveHistory();
    } finally {
      if (sendBtn) sendBtn.disabled = false;
      if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  chatForm?.addEventListener('submit', (e) => {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    sendQuestion(chatInput?.value || '');
  });

  renderInitialView();

  return {
    root,
    toggleBtn,
    closeBtn,
    clearBtn,
    chatWindow,
    chatForm,
    chatInput,
    messagesContainer,
    chipsContainer,
    sendBtn,
    toggleChat,
    closeChat,
    sendQuestion,
    getHistory: () => conversationHistory
  };
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAiWidget(document, globalThis.window));
  } else {
    initAiWidget(document, globalThis.window);
  }
}
