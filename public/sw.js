'use strict';

const VERSION = 'v6';
const SHELL_CACHE = `leadtrack-shell-${VERSION}`;
const ASSET_CACHE = `leadtrack-assets-${VERSION}`;

const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/css/styles.css',
  '/js/ui.js',
  '/js/api.js',
  '/js/auth.js',
  '/js/kanban.js',
  '/js/leads.js',
  '/js/dashboard.js',
  '/js/users.js',
  '/js/settings.js',
    '/js/notifications.js',
    '/js/pwa.js',
    '/js/push.js',
    '/js/app.js',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/icon-maskable-512.png',
  '/assets/icons/apple-touch-icon.png',
  '/assets/icons/favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.all(SHELL_URLS.map(async (url) => {
      try {
        await cache.add(new Request(url, { cache: 'reload' }));
      } catch {
        // Um recurso ausente nao deve impedir a instalacao do service worker.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, ASSET_CACHE]);
    const names = await caches.keys();
    await Promise.all(names.map((name) => (keep.has(name) ? null : caches.delete(name))));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const n = event.data.notification || {};
    event.waitUntil(showAppNotification(n));
  }
});

function notificationUrl(data) {
  if (data && data.url) return data.url;
  if (data && data.leadId) return '/#/leads/' + data.leadId;
  return '/#/notifications';
}

async function showAppNotification(n) {
  const title = n.title || 'LeadTrack';
  const options = {
    body: n.body || '',
    icon: '/assets/icons/icon-192.png',
    badge: '/assets/icons/favicon-32.png',
    tag: n.tag || (n.type ? String(n.type) : 'leadtrack'),
    renotify: true,
    data: {
      url: notificationUrl(n),
      leadId: n.leadId || null,
      notificationId: n.notificationId || null
    }
  };
  return self.registration.showNotification(title, options);
}

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'LeadTrack', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(showAppNotification(payload));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = notificationUrl(event.notification.data || {});
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if ('focus' in client) {
        await client.focus();
        if (client.navigate) await client.navigate(target);
        else client.postMessage({ type: 'OPEN_URL', url: target });
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok && request.method === 'GET') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request).then((response) => {
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || network || fetch(request);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API nunca e cacheada: sao dados privados por usuario.
  if (isApiRequest(url)) {
    event.respondWith(
      fetch(request).catch(() => new Response(
        JSON.stringify({ error: 'Sem conexao. Verifique sua internet e tente novamente.', offline: true }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  // Navegacao: rede primeiro, caindo para o shell em cache quando offline.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(SHELL_CACHE);
          cache.put('/index.html', response.clone());
        }
        return response;
      } catch {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match('/index.html')) || (await cache.match('/')) ||
          new Response('<h1>Voce esta offline</h1><p>Conecte-se a internet para continuar.</p>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  // Estaticos: cache primeiro com revalidacao em segundo plano.
  event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
});
