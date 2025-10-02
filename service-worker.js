const CACHE_NAME = 'fullspeed2skid-v3.1.3';
const ASSETS = [
  // Root and main files
  '/fullspeed2skid/',
  '/fullspeed2skid/index.html',
  '/fullspeed2skid/manifest.json',

  // assets/style
  '/fullspeed2skid/assets/style/style.css',

  // assets/fonts
  '/fullspeed2skid/assets/fonts/Stormfaze.otf',
  '/fullspeed2skid/assets/fonts/skid.ttf',
  '/fullspeed2skid/assets/fonts/punk_kid.ttf',
  '/fullspeed2skid/assets/fonts/Harting.ttf',

  // assets/images
  '/fullspeed2skid/assets/images/car.png',
  '/fullspeed2skid/assets/images/car_X.png',
  '/fullspeed2skid/assets/images/asphalt.jpg',
  '/fullspeed2skid/assets/images/asphalt1.jpg',
  '/fullspeed2skid/assets/images/grass.jpg',
  '/fullspeed2skid/assets/images/stone.jpg',
  '/fullspeed2skid/assets/images/water.jpg',
  '/fullspeed2skid/assets/images/cobblestone.jpg',
  '/fullspeed2skid/assets/images/fullspeed2skid.jpg',

  // assets/levels
  '/fullspeed2skid/assets/levels/scene_1.svg',
  '/fullspeed2skid/assets/levels/scene_2.svg',
  '/fullspeed2skid/assets/levels/scene_3.svg',
  '/fullspeed2skid/assets/levels/scene_4.svg',
  '/fullspeed2skid/assets/levels/tracks.json',
  
  // src/ai
  '/fullspeed2skid/src/ai/AICar.js',
  '/fullspeed2skid/src/ai/aiConfig.js',
  '/fullspeed2skid/src/ai/aiDriving.js',
  '/fullspeed2skid/src/ai/aiRecovery.js',

  // src/app
  '/fullspeed2skid/src/app/main.js',
  '/fullspeed2skid/src/app/startup.js',

  // src/cameras
  '/fullspeed2skid/src/cameras/cameras.js',
  '/fullspeed2skid/src/cameras/classicCamera.js',
  '/fullspeed2skid/src/cameras/fpvCamera.js',

  // src/core
  '/fullspeed2skid/src/core/phaser.js',

  // src/engine
  '/fullspeed2skid/src/engine/countdownManager.js',
  '/fullspeed2skid/src/engine/game.js',
  '/fullspeed2skid/src/engine/lapsTimer.js',
  '/fullspeed2skid/src/engine/skidMarksManager.js',
  '/fullspeed2skid/src/engine/svgPhaserWorldLoader.js',
  '/fullspeed2skid/src/engine/textureManager.js',
  '/fullspeed2skid/src/engine/world.js',

  // src/input
  '/fullspeed2skid/src/input/controlsManager.js',
  '/fullspeed2skid/src/input/gyro-handler.js',
  '/fullspeed2skid/src/input/keyboardManager.js',

  // src/rendering
  '/fullspeed2skid/src/rendering/skidMarks.js',

  // src/scenes
  '/fullspeed2skid/src/scenes/HudScene.js',
  '/fullspeed2skid/src/scenes/LoadingScene.js',
  '/fullspeed2skid/src/scenes/MenuScene.js',
  '/fullspeed2skid/src/scenes/menuUI.js',
  '/fullspeed2skid/src/scenes/hiscoresOverlay.js',

  // src/ui
  '/fullspeed2skid/src/ui/hudManager.js',

  // src/vehicles
  '/fullspeed2skid/src/vehicles/car.js',
  '/fullspeed2skid/src/vehicles/carConfig.js',
  '/fullspeed2skid/src/vehicles/PlayerCar.js',
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
  if (event.request.method !== 'GET') {
    return;
  }

  if (event.request.url.includes('chrome-extension') || 
      event.request.url.includes('extension') ||
      event.request.url.includes('devtools')) {
    return;
  }

  event.respondWith(
    caches.match(event.request, {ignoreSearch: true})
      .then(response => {
        if (response) {
          console.log('[SW] Serving from cache:', event.request.url);
          return response;
        }

        console.log('[SW] Fetching from network:', event.request.url);
        return fetch(event.request)
          .then(response => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
                console.log('[SW] Cached new resource:', event.request.url);
              });

            return response;
          })
          .catch(error => {
            console.error('[SW] Fetch failed:', error);
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
