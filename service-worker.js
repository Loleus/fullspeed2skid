const CACHE_NAME = 'fullspeed2skid-v2';
const ASSETS = [
  '/fullspeed2skid/',
  '/fullspeed2skid/index.html',
  '/fullspeed2skid/manifest.json',
  '/fullspeed2skid/src/main.js',
  '/fullspeed2skid/src/phaser.js',
  '/fullspeed2skid/src/svgPhaserWorldLoader.js',
  '/fullspeed2skid/assets/style/style.css',
  '/fullspeed2skid/assets/images/car.png',
  '/fullspeed2skid/assets/images/asphalt.jpg',
  '/fullspeed2skid/assets/images/grass.jpg',
  '/fullspeed2skid/assets/images/stone.jpg',
  '/fullspeed2skid/assets/images/water.jpg',
  '/fullspeed2skid/assets/images/cobblestone.jpg',
  '/fullspeed2skid/assets/images/fullspeed2skid.jpg',
  '/fullspeed2skid/assets/levels/scene_1.svg',
  // Dodaj tu kolejne pliki jeśli będą potrzebne
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request, {ignoreSearch: true}).then(response => {
      return response || fetch(event.request);
    })
  );
}); 