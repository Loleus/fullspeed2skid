const CACHE_NAME = 'fullspeed2skid-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/src/main.js',
  '/src/phaser.js',
  '/src/svgPhaserWorldLoader.js',
  '/assets/style/style.css',
  '/assets/images/car.png',
  '/assets/images/asphalt.jpg',
  '/assets/images/grass.jpg',
  '/assets/images/stone.jpg',
  '/assets/images/water.jpg',
  '/assets/images/cobblestone.jpg',
  '/assets/images/fullspeed2skid.jpg',
  '/assets/levels/scene_1.svg',
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