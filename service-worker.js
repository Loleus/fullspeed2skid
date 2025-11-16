const CACHE_NAME = 'fullspeed2skid-v2.4.3';
const ASSETS = [
  // Root and main files
  '/fullspeed2skid/',
  '/fullspeed2skid/index.html',
  '/fullspeed2skid/manifest.json',
  '/fullspeed2skid/favicon.ico',

  // assets/audio
  '/fullspeed2skid/assets/audio/game_ambience.mp3',
  '/fullspeed2skid/assets/audio/game_applause.mp3',
  '/fullspeed2skid/assets/audio/game_countdown.mp3',
  '/fullspeed2skid/assets/audio/game_idle.mp3',
  '/fullspeed2skid/assets/audio/game_music.mp3',
  '/fullspeed2skid/assets/audio/game_off.mp3',
  '/fullspeed2skid/assets/audio/game_on.mp3',
  '/fullspeed2skid/assets/audio/game_race.wav',
  '/fullspeed2skid/assets/audio/game_slide.mp3',
  '/fullspeed2skid/assets/audio/game_crash.mp3',
  '/fullspeed2skid/assets/audio/menu_button.wav',
  '/fullspeed2skid/assets/audio/menu_music.mp3',

  // assets/fonts
  '/fullspeed2skid/assets/fonts/Stormfaze.otf',
  '/fullspeed2skid/assets/fonts/skid.ttf',
  '/fullspeed2skid/assets/fonts/punk_kid.ttf',
  '/fullspeed2skid/assets/fonts/Harting.ttf',

  // assets/images
  '/fullspeed2skid/assets/images/asphalt.jpg',
  '/fullspeed2skid/assets/images/asphalt1.jpg',
  '/fullspeed2skid/assets/images/bgc.jpg',
  '/fullspeed2skid/assets/images/car_X.png',
  '/fullspeed2skid/assets/images/car.png',
  '/fullspeed2skid/assets/images/cobblestone.jpg',
  '/fullspeed2skid/assets/images/favicon-16x16.png',
  '/fullspeed2skid/assets/images/favicon-32x32.png',
  '/fullspeed2skid/assets/images/fullspeed2skid_icon.jpg',
  '/fullspeed2skid/assets/images/fullspeed2skid.jpg',
  '/fullspeed2skid/assets/images/grass.jpg',
  '/fullspeed2skid/assets/images/grass1.jpg',
  '/fullspeed2skid/assets/images/hiscoreBG.jpg',
  '/fullspeed2skid/assets/images/icon-192x192-maskable.png',
  '/fullspeed2skid/assets/images/icon-192x192.png',
  '/fullspeed2skid/assets/images/icon-512x512.png',
  '/fullspeed2skid/assets/images/stone.jpg',
  '/fullspeed2skid/assets/images/stone1.jpg',
  '/fullspeed2skid/assets/images/stone2.jpg',
  '/fullspeed2skid/assets/images/stone3.jpg',
  '/fullspeed2skid/assets/images/water.jpg',

  // assets/levels
  '/fullspeed2skid/assets/levels/hiscores.json',
  '/fullspeed2skid/assets/levels/scene_1.svg',
  '/fullspeed2skid/assets/levels/scene_2.svg',
  '/fullspeed2skid/assets/levels/scene_3.svg',
  '/fullspeed2skid/assets/levels/scene_4.svg',
  '/fullspeed2skid/assets/levels/tracks.json',

  // assets/style
  '/fullspeed2skid/assets/styles/style.css',

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

  // src/domain/vehicles
  '/fullspeed2skid/src/domain/vehicles/Car.js',
  '/fullspeed2skid/src/domain/vehicles/CarConfig.js',
  '/fullspeed2skid/src/domain/vehicles/PlayerCar.js',
  // src/domain/vehicles/ai
  '/fullspeed2skid/src/domain/vehicles/ai/AICar.js',
  '/fullspeed2skid/src/domain/vehicles/ai/aiConfig.js',
  '/fullspeed2skid/src/domain/vehicles/ai/aiDriving.js',
  '/fullspeed2skid/src/domain/vehicles/ai/CollisionManager.js',
  // src/domain/world
  '/fullspeed2skid/src/domain/world/TextureManager.js',
  '/fullspeed2skid/src/domain/world/World.js',
  '/fullspeed2skid/src/domain/world/WorldLoader.js',

  // src/input
  '/fullspeed2skid/src/input/controlsManager.js',
  '/fullspeed2skid/src/input/gyro-handler.js',
  '/fullspeed2skid/src/input/keyboardManager.js',

  // src/scenes
  '/fullspeed2skid/src/scenes/GameScene.js',
  '/fullspeed2skid/src/scenes/HudScene.js',
  '/fullspeed2skid/src/scenes/LoadingScene.js',
  '/fullspeed2skid/src/scenes/MenuScene.js',

  // src/services
  '/fullspeed2skid/src/services/HiscoreService.js',
  '/fullspeed2skid/src/services/VehicleFactory.js',

  // src/systems
  '/fullspeed2skid/src/systems/CountdownManager.js',
  '/fullspeed2skid/src/systems/hiscoreManager.js',
  '/fullspeed2skid/src/systems/hudManager.js',
  '/fullspeed2skid/src/systems/LapsTimer.js',
  '/fullspeed2skid/src/systems/SkidMarksSystem.js',

  // src/systems/rendering
  '/fullspeed2skid/src/systems/rendering/skidMarks.js',
  '/fullspeed2skid/src/systems/rendering/SkidMarksManager.js',

  // src/ui
  '/fullspeed2skid/src/ui/hiscoresOverlay.js',
  '/fullspeed2skid/src/ui/menu_background.js',
  '/fullspeed2skid/src/ui/menu_buttons.js',
  '/fullspeed2skid/src/ui/menu_drawUtils.js',
  '/fullspeed2skid/src/ui/menu_logo.js',
  '/fullspeed2skid/src/ui/menuView.js',
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
