// Bump this on any change to caching behavior so `activate` purges stale caches.
// v1 cached the app shell + navigations, which could strand a browser on an old
// build whose JS chunks no longer exist on the server (infinite loading spinner).
const CACHE_NAME = 'lumio-v2';

// Only the offline fallback is precached. We deliberately do NOT precache app
// routes like /boards — caching HTML lets a stale shell reference purged JS
// chunks after a deploy, which hangs the app. HTML now always comes from network.
const PRECACHE_URLS = [
  '/offline',
];

// Install: precache offline page (failures are non-fatal — don't block activation)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Web Push ────────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  const payload = event.data?.json() ?? {};
  const title = payload.title || 'Lumio';
  const body = payload.body || 'You have a new notification';
  const notifOptions = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/favicon-32.png',
    data: payload,
    tag: 'lumio-notification',
    renotify: true,
  };

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const visibleClient = clients.find((c) => c.visibilityState === 'visible');
      const hiddenClient = clients.find((c) => c.visibilityState === 'hidden');

      if (visibleClient) {
        // App tab is active — hand off to in-app toast, skip native notification
        visibleClient.postMessage({ type: 'PUSH_RECEIVED', payload });
      } else if (hiddenClient) {
        // App is open but user is on another tab — badge the tab + show native notification
        hiddenClient.postMessage({ type: 'PUSH_BADGE', payload });
        return self.registration.showNotification(title, notifOptions);
      } else {
        // App is closed — show native notification
        return self.registration.showNotification(title, notifOptions);
      }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  let targetUrl = '/boards';
  if (data.board_id && data.card_id) {
    targetUrl = `/boards/${encodeURIComponent(data.board_id)}?card=${encodeURIComponent(data.card_id)}`;
  } else if (data.board_id) {
    targetUrl = `/boards/${encodeURIComponent(data.board_id)}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.startsWith(self.location.origin));
      if (existing) {
        // Tab already open — navigate it and bring to front
        existing.postMessage({ type: 'PUSH_NAVIGATE', url: targetUrl });
        return existing.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────

// Fetch: network-first for navigations, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET and cross-origin
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // Navigations: always network. We never cache the HTML shell — serving a stale
  // shell can point the app at JS chunks that no longer exist on the server, which
  // leaves the user stuck on a loading spinner. Only fall back to the offline page
  // when the network is genuinely unavailable.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline'))
    );
    return;
  }

  // Static assets: cache-first. Safe because Next.js content-hashes these
  // filenames — a new deploy produces new names, so the cache can't go stale.
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return response;
          })
      )
    );
    return;
  }
});
