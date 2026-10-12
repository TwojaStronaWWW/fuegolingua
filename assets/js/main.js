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
  const tabs = doc.querySelectorAll('.pricing-tab');
  const contents = doc.querySelectorAll('.pricing-content');

  if (!tabs.length || !contents.length) return null;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      contents.forEach(c => {
        c.style.display = 'none';
        c.classList.remove('active');
      });

      const targetId = tab.getAttribute('data-target');
      const targetContent = doc.getElementById(targetId);
      if (targetContent) {
        targetContent.style.display = 'block';
        setTimeout(() => {
          targetContent.classList.add('active');
        }, 10);
      }
    });
  });

  return { tabs, contents };
}

export function initScrollAnimations(doc = document) {
  const orbitRing = doc.querySelector('.orbit-ring');
  if (!orbitRing) return null;

  const stopOrbitOnScroll = () => {
    if ((globalThis.window?.scrollY || 0) > 200) {
      orbitRing.style.animationIterationCount = '2';
      globalThis.window?.removeEventListener('scroll', stopOrbitOnScroll);
    }
  };

  globalThis.window?.addEventListener('scroll', stopOrbitOnScroll, { passive: true });
  return orbitRing;
}

// Inicjalizacja w przeglądarce
if (typeof document !== 'undefined') {
  const runInit = () => {
    initNavigation(document);
    initSmoothScroll(document);
    initTabs(document);
    initScrollAnimations(document);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInit);
  } else {
    runInit();
  }
}
