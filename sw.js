/* ============================================================
   COMPASSO · Service Worker
   App shell caching + funcionamento offline basico.
   Sem dependencias externas, sem build step.
   ============================================================ */

// Bump a cada release que altera qualquer arquivo do APP_SHELL abaixo — é o
// único jeito de o cache stale-while-revalidate parar de servir a versão
// antiga no primeiro carregamento após o deploy (ver RC2: "Minha Jornada").
const CACHE_VERSION = 'build-20260724b';
const CACHE_NAME = `compasso-cache-${CACHE_VERSION}`;

const APP_SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/js/config.js',
  '/js/supabase.js',
  '/js/auth.js',
  '/js/database.js',
  '/js/notifications.js',
  '/js/insights.js',
  '/js/timeline.js',
  '/js/actionplan.js',
  '/js/license.js',
  '/manifest.json',
  '/icons/icon-192.png?v=2',
  '/icons/icon-512.png?v=2',
  '/icons/icon-192-maskable.png?v=2',
  '/icons/icon-512-maskable.png?v=2',
  '/icons/apple-touch-icon.png?v=2',
  '/icons/favicon-16.png?v=2',
  '/icons/favicon-32.png?v=2',
  '/favicon.ico?v=2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // navegacao (HTML): network-first, cai para cache quando offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // demais assets same-origin: stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.status === 200) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    )
  );
});

// Clique numa notificação (Sprint K): foca uma aba já aberta do Compasso,
// ou abre uma nova se não houver nenhuma.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
