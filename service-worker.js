const CACHE_NAME = 'fullspeed2skid-v0.1';
const ASSETS = [
  '/fullspeed2skid/',
  '/fullspeed2skid/index.html',
  '/fullspeed2skid/manifest.json',
  '/fullspeed2skid/src/main.js',
  '/fullspeed2skid/src/game.js',
  '/fullspeed2skid/src/MenuScene.js',
  '/fullspeed2skid/src/LoadingScene.js',
  '/fullspeed2skid/src/phaser.js',
  '/fullspeed2skid/src/svgPhaserWorldLoader.js',
  '/fullspeed2skid/src/car.js',
  '/fullspeed2skid/src/world.js',
  '/fullspeed2skid/src/cameras.js',
  '/fullspeed2skid/src/classicCamera.js',
  '/fullspeed2skid/src/fpvCamera.js',
  '/fullspeed2skid/src/skidMarks.js',
  '/fullspeed2skid/assets/style/style.css',
  '/fullspeed2skid/assets/fonts/Stormfaze.otf',
  '/fullspeed2skid/assets/fonts/skid.ttf',
  '/fullspeed2skid/assets/fonts/punk_kid.ttf',
  '/fullspeed2skid/assets/images/car.png',
  '/fullspeed2skid/assets/images/asphalt.jpg',
  '/fullspeed2skid/assets/images/grass.jpg',
  '/fullspeed2skid/assets/images/stone.jpg',
  '/fullspeed2skid/assets/images/water.jpg',
  '/fullspeed2skid/assets/images/cobblestone.jpg',
  '/fullspeed2skid/assets/images/fullspeed2skid.jpg',
  '/fullspeed2skid/assets/levels/scene_1.svg',
  '/fullspeed2skid/assets/levels/scene_2.svg',
  '/fullspeed2skid/assets/levels/scene_3.svg',
  '/fullspeed2skid/assets/levels/scene_4.svg',
  '/fullspeed2skid/assets/levels/scene_5.svg',
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
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interceptowanie żądań sieciowych
self.addEventListener('fetch', event => {
  // Obsługa tylko żądań GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Ignoruj żądania do zewnętrznych API
  if (event.request.url.includes('chrome-extension') || 
      event.request.url.includes('extension') ||
      event.request.url.includes('devtools')) {
    return;
  }

  event.respondWith(
    caches.match(event.request, {ignoreSearch: true})
      .then(response => {
        // Jeśli plik jest w cache, zwróć go
        if (response) {
          console.log('[SW] Serving from cache:', event.request.url);
          return response;
        }

        // Jeśli nie ma w cache, pobierz z sieci
        console.log('[SW] Fetching from network:', event.request.url);
        return fetch(event.request)
          .then(response => {
            // Sprawdź czy odpowiedź jest poprawna
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Klonuj odpowiedź, bo może być użyta tylko raz
            const responseToCache = response.clone();

            // Dodaj do cache dla przyszłych żądań
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
                console.log('[SW] Cached new resource:', event.request.url);
              });

            return response;
          })
          .catch(error => {
            console.error('[SW] Fetch failed:', error);
            // Możesz tu dodać fallback dla offline
            return new Response('Offline - Brak połączenia z internetem', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
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