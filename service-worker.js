const CACHE_NAME = 'fullspeed2skid-v2.2.5';
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
  '/fullspeed2skid/assets/images/stone2.jpg',
  '/fullspeed2skid/assets/images/stone3.jpg',
  '/fullspeed2skid/assets/images/water.jpg',
  '/fullspeed2skid/assets/images/cobblestone.jpg',
  '/fullspeed2skid/assets/images/fullspeed2skid.jpg',
  '/fullspeed2skid/assets/images/bgc.jpg',

  // assets/levels
  '/fullspeed2skid/assets/levels/hiscores.json',
  '/fullspeed2skid/assets/levels/scene_1.svg',
  '/fullspeed2skid/assets/levels/scene_2.svg',
  '/fullspeed2skid/assets/levels/scene_3.svg',
  '/fullspeed2skid/assets/levels/scene_4.svg',
  '/fullspeed2skid/assets/levels/tracks.json',

  // src/app
  '/fullspeed2skid/src/app/main.js',
  '/fullspeed2skid/src/app/startup.js',

  // src/cameras
  '/fullspeed2skid/src/cameras/ClassicCamera.js',
  '/fullspeed2skid/src/cameras/FPVCamera.js',
  '/fullspeed2skid/src/cameras/CameraManager.js',

  // src/core
  '/fullspeed2skid/src/core/constants.js',
  '/fullspeed2skid/src/core/phaser.js',

  // src/game
  '/fullspeed2skid/src/game/CountdownManager.js',
  '/fullspeed2skid/src/game/LapsTimer.js',

  // src/input
  '/fullspeed2skid/src/input/controlsManager.js',
  '/fullspeed2skid/src/input/gyro-handler.js',
  '/fullspeed2skid/src/input/keyboardManager.js',

  // src/rendering
  '/fullspeed2skid/src/rendering/skidMarks.js',
  '/fullspeed2skid/src/rendering/SkidMarksManager.js',

  // src/scenes
  '/fullspeed2skid/src/scenes/GameScene.js',
  '/fullspeed2skid/src/scenes/hiscoresManager.js',
  '/fullspeed2skid/src/scenes/hiscoresOverlay.js',
  '/fullspeed2skid/src/scenes/HudScene.js',
  '/fullspeed2skid/src/scenes/LoadingScene.js',
  '/fullspeed2skid/src/scenes/MenuScene.js',
  '/fullspeed2skid/src/scenes/menuUI.js',

  // src/ui
  '/fullspeed2skid/src/ui/hudManager.js',

  // src/vehicles
  '/fullspeed2skid/src/vehicles/Car.js',
  '/fullspeed2skid/src/vehicles/CarConfig.js',
  '/fullspeed2skid/src/vehicles/PlayerCar.js',

  // src/vehicles/ai
  '/fullspeed2skid/src/vehicles/ai/AICar.js',
  '/fullspeed2skid/src/vehicles/ai/aiConfig.js',
  '/fullspeed2skid/src/vehicles/ai/aiDriving.js',
  '/fullspeed2skid/src/vehicles/ai/CollisionManager.js',

  // src/world
  '/fullspeed2skid/src/world/TextureManager.js',
  '/fullspeed2skid/src/world/World.js',
  '/fullspeed2skid/src/world/WorldLoader.js',
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
  self.clients.claim();
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
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'NEW_VERSION_AVAILABLE' });
    });
  });
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
