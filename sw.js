/* Compre Diamantino — Service Worker + Push + Badge */
const CACHE_NAME = 'compre-diamantino-v11';
const PRECACHE = [
  './icon-192.png',
  './icon-512.png',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (data.type === 'SET_BADGE' && typeof self.navigator !== 'undefined' && self.navigator.setAppBadge) {
    const n = Number(data.count) || 0;
    if (n > 0) self.navigator.setAppBadge(n).catch(() => {});
    else if (self.navigator.clearAppBadge) self.navigator.clearAppBadge().catch(() => {});
  }
});

// Rede primeiro para HTML/JS/CSS — evita ficar preso na versão antiga
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isDoc = req.mode === 'navigate' ||
    (url.origin === self.location.origin && /\.(html?|js|css)(\?|$)/i.test(url.pathname));

  if (isDoc) {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => cached))
  );
});

/* ---------- Push (Android + iPhone PWA) ---------- */
function parsePushPayload(event) {
  let data = {};
  try {
    if (event.data) {
      data = event.data.json ? event.data.json() : JSON.parse(event.data.text());
    }
  } catch (e) {
    try {
      data = { body: event.data && event.data.text ? event.data.text() : 'Nova notificação' };
    } catch (e2) {
      data = { body: 'Nova notificação' };
    }
  }
  return data || {};
}

self.addEventListener('push', event => {
  const data = parsePushPayload(event);
  const title = data.title || 'Compre Diamantino';
  const body = data.body || data.detalhe || 'Você tem um novo aviso';
  const url = data.url || data.link || './gestor-hub.html';
  const tag = data.tag || data.id || 'cd-notif';
  const badgeCount = data.badge != null ? Number(data.badge) : 1;

  const options = {
    body: body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    image: data.image || undefined,
    tag: tag,
    renotify: true,
    requireInteraction: false,
    data: {
      url: url,
      tipo: data.tipo || '',
      id: data.id || tag
    },
    vibrate: [120, 60, 120],
    actions: data.actions || [
      { action: 'abrir', title: 'Abrir' },
      { action: 'fechar', title: 'Fechar' }
    ]
  };

  event.waitUntil((async () => {
    try {
      if (self.navigator && self.navigator.setAppBadge && badgeCount > 0) {
        await self.navigator.setAppBadge(badgeCount);
      }
    } catch (e) {}
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'fechar') return;

  const target = (event.notification.data && event.notification.data.url) || './gestor-hub.html';
  const abs = new URL(target, self.registration.scope).href;

  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if (client.url.indexOf(self.registration.scope) === 0 && 'focus' in client) {
        await client.focus();
        try {
          client.postMessage({ type: 'CD_NOTIF_CLICK', url: abs, data: event.notification.data });
        } catch (e) {}
        return;
      }
    }
    if (clients.openWindow) {
      await clients.openWindow(abs);
    }
  })());
});
