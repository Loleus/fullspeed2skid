const CACHE_NAME = 'fullspeed2skid-v2.7.0';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
];

// Instalacja service workera
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell');
        return cache.addAll(ASSETS);
      })
      .catch(error => {
        console.error('[SW] Cache addAll failed:', error);
      })
  );
  self.skipWaiting();
});

// Aktywacja service workera
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      // Sprawdź czy są stare cache do usunięcia
      const oldCaches = cacheNames.filter(cacheName => cacheName !== CACHE_NAME);
      const isUpdate = oldCaches.length > 0;

      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      ).then(() => {
        // Powiadom klientów TYLKO jeśli to aktualizacja (były stare cache)
        if (isUpdate) {
          console.log('[SW] Update detected, notifying clients');
          return self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({ type: 'NEW_VERSION_AVAILABLE' });
            });
          });
        } else {
          console.log('[SW] First installation, skipping update notification');
        }
      });
    })
  );
  self.clients.claim();
});

// Interceptowanie żądań sieciowych
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  if (event.request.url.includes('chrome-extension') ||
    event.request.url.includes('extension') ||
    event.request.url.includes('devtools')) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        console.log('[SW] Serving from cache:', event.request.url);
        return cachedResponse;
      }
      console.log('[SW] Fetching from network:', event.request.url);
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
          console.log('[SW] Cached new resource:', event.request.url);
        });
        return networkResponse;
      }).catch(error => {
        console.error('[SW] Fetch failed:', error);
        return new Response('Offline - Brak połączenia z internetem', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      });
    })
  );
});
// Obsługa wiadomości od aplikacji
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
// Obsługa błędów
self.addEventListener('error', event => {
  console.error('[SW] Service worker error:', event.error);
});
// Obsługa nieobsłużonych promise rejections
self.addEventListener('unhandledrejection', event => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
});
