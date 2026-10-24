/**
 * FuegoLingua — Service Worker (PWA Offline Support — Hybrid Strategy)
 * Strategia: Network-First dla kodu (.html, .css, .js, .json) + Stale-While-Revalidate dla mediów.
 */

const CACHE_NAME = 'fuegolingua-v4';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './cennik.html',
  './site.webmanifest',
  './assets/css/style.css',
  './assets/css/media.css',
  './assets/css/cennik.css',
  './assets/js/main.js',
  './assets/js/contact.js',
  './assets/js/ai-widget.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/') || url.pathname.endsWith('.php')) return;

  const isCodeOrData =
    request.mode === 'navigate' ||
    url.pathname === '/' ||
    /\.(html|css|js|mjs|json)$/i.test(url.pathname);

  if (isCodeOrData) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() =>
          caches.match(request).then((cached) => {
            if (cached) return cached;
            if (request.mode === 'navigate') return caches.match('./index.html');
            return new Response('Offline', { status: 503, statusText: 'Offline' });
          })
        )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
