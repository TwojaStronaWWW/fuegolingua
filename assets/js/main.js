/**
 * Główny moduł UI i nawigacji (Vanilla JS ES6+) - FuegoLingua
 */

export function initNavigation(doc = document) {
  const menuBtn = doc.querySelector('.hamburger') || doc.getElementById('menu-toggle');
  const navLinks = doc.querySelector('.nav-links') || doc.getElementById('primary-nav');

  if (!menuBtn || !navLinks) return null;

  if (!menuBtn.hasAttribute('aria-expanded')) {
    menuBtn.setAttribute('aria-expanded', 'false');
  }

  const toggleHandler = () => {
    const isExpanded = menuBtn.getAttribute('aria-expanded') === 'true';
    const nextState = !isExpanded;
    menuBtn.setAttribute('aria-expanded', String(nextState));
    navLinks.classList.toggle('active', nextState);
    navLinks.classList.toggle('is-open', nextState);
  };

  const closeMenu = () => {
    menuBtn.setAttribute('aria-expanded', 'false');
    navLinks.classList.remove('active');
    navLinks.classList.remove('is-open');
    menuBtn.focus?.();
  };

  const keyHandler = (e) => {
    if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') {
      closeMenu();
    }
  };

  menuBtn.addEventListener('click', toggleHandler);
  doc.addEventListener('keydown', keyHandler);

  return { menuBtn, navLinks, toggleHandler, keyHandler, closeMenu };
}

export function initSmoothScroll(doc = document) {
  const anchors = doc.querySelectorAll('a[href^="#"]');
  if (!anchors || !anchors.length) return null;

  const navLinks = doc.querySelector('.nav-links') || doc.getElementById('primary-nav');
  const menuBtn = doc.querySelector('.hamburger') || doc.getElementById('menu-toggle');

  anchors.forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#' || targetId === '') return;

      if (navLinks && (navLinks.classList.contains('active') || navLinks.classList.contains('is-open'))) {
        navLinks.classList.remove('active');
        navLinks.classList.remove('is-open');
        if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
      }

      const targetElement = doc.querySelector(targetId);
      if (targetElement && typeof targetElement.scrollIntoView === 'function') {
        e.preventDefault();
        targetElement.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  return anchors;
}

export function initTabs(doc = document) {
  const tabs = Array.from(doc.querySelectorAll('.pricing-tab, [role="tab"]'));
  const contents = Array.from(doc.querySelectorAll('.pricing-content, [role="tabpanel"]'));

  if (!tabs.length || !contents.length) return null;

  const activateTab = (activeTab, setFocus = false) => {
    const targetId = activeTab.getAttribute('data-target') || activeTab.getAttribute('aria-controls');

    tabs.forEach(tab => {
      const isCurrent = (tab === activeTab);
      tab.classList.toggle('active', isCurrent);
      tab.setAttribute('aria-selected', String(isCurrent));
      tab.setAttribute('tabindex', isCurrent ? '0' : '-1');
    });

    contents.forEach(content => {
      const isTarget = content.id === targetId;
      content.classList.toggle('active', isTarget);
      if (isTarget) {
        content.removeAttribute('hidden');
      } else {
        content.setAttribute('hidden', '');
      }
    });

    if (setFocus && typeof activeTab.focus === 'function') {
      activeTab.focus();
    }
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      activateTab(tab, false);
    });

    tab.addEventListener('keydown', (e) => {
      let targetIndex = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        targetIndex = (index + 1) % tabs.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        targetIndex = (index - 1 + tabs.length) % tabs.length;
      } else if (e.key === 'Home') {
        targetIndex = 0;
      } else if (e.key === 'End') {
        targetIndex = tabs.length - 1;
      }

      if (targetIndex !== -1) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        activateTab(tabs[targetIndex], true);
      }
    });
  });

  return { tabs, contents, activateTab };
}


export function initScrollAnimations(doc = document) {
  const orbitRing = doc.querySelector('.orbit-ring');
  if (!orbitRing) return null;

  const orbitContainer = doc.querySelector('.orbit-container') || orbitRing.parentNode || orbitRing;

  if (typeof globalThis.IntersectionObserver === 'function') {
    const observer = new globalThis.IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          orbitContainer.classList?.toggle('is-visible', Boolean(entry.isIntersecting));
        }
      },
      { rootMargin: '100px 0px', threshold: 0.05 }
    );
    observer.observe(orbitContainer);
    return { orbitRing, orbitContainer, observer };
  }

  const handleScrollVisibility = () => {
    const scrollY = globalThis.window?.scrollY || 0;
    const isVisible = scrollY > 150 && scrollY < 1800;
    orbitContainer.classList?.toggle('is-visible', isVisible);
  };

  globalThis.window?.addEventListener('scroll', handleScrollVisibility, { passive: true });
  return { orbitRing, orbitContainer, handleScrollVisibility };
}

export function initLightbox(doc = document) {
  const modal = doc.getElementById('image-lightbox');
  const items = Array.from(doc.querySelectorAll('.pricing-gallery-item, [data-lightbox]'));

  if (!modal || !items.length) return null;

  const imgEl = modal.querySelector('#lightbox-image');
  const captionEl = modal.querySelector('#lightbox-caption');
  const closeBtn = modal.querySelector('#lightbox-close');
  const prevBtn = modal.querySelector('#lightbox-prev');
  const nextBtn = modal.querySelector('#lightbox-next');
  const backdrop = modal.querySelector('#lightbox-backdrop');

  let currentIndex = 0;
  let lastFocusedElement = null;

  const images = items.map(item => {
    const img = item.querySelector?.('img') || item;
    return {
      src: img?.getAttribute?.('src') || '',
      alt: img?.getAttribute?.('alt') || ''
    };
  });

  const updateLightbox = (index) => {
    currentIndex = (index + images.length) % images.length;
    const current = images[currentIndex];
    if (imgEl && current) {
      imgEl.setAttribute('src', current.src);
      imgEl.setAttribute('alt', current.alt);
    }
    if (captionEl && current) {
      captionEl.textContent = current.alt;
    }
  };

  const openLightbox = (index, triggerEl = null) => {
    lastFocusedElement = triggerEl;
    updateLightbox(index);
    modal.removeAttribute('hidden');
    modal.classList.add('is-open');
    if (doc.body) doc.body.classList.add('lightbox-open');
    if (closeBtn && typeof closeBtn.focus === 'function') {
      closeBtn.focus();
    }
  };

  const closeLightbox = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('hidden', '');
    if (doc.body) doc.body.classList.remove('lightbox-open');
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  };

  const showNext = () => updateLightbox(currentIndex + 1);
  const showPrev = () => updateLightbox(currentIndex - 1);

  items.forEach((item, index) => {
    item.addEventListener('click', (e) => {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      openLightbox(index, item);
    });
  });

  closeBtn?.addEventListener('click', closeLightbox);
  backdrop?.addEventListener('click', closeLightbox);
  nextBtn?.addEventListener('click', showNext);
  prevBtn?.addEventListener('click', showPrev);

  const keyHandler = (e) => {
    if (modal.hasAttribute('hidden') || !modal.classList.contains('is-open')) return;

    if (e.key === 'Escape') {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      closeLightbox();
    } else if (e.key === 'ArrowRight') {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      showNext();
    } else if (e.key === 'ArrowLeft') {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      showPrev();
    }
  };

  doc.addEventListener('keydown', keyHandler);

  return { modal, items, openLightbox, closeLightbox, showNext, showPrev, keyHandler, getCurrentIndex: () => currentIndex };
}

// Inicjalizacja w przeglądarce
if (typeof document !== 'undefined') {
  const runInit = () => {
    initNavigation(document);
    initSmoothScroll(document);
    initTabs(document);
    initLightbox(document);
    initScrollAnimations(document);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInit);
  } else {
    runInit();
  }
}
