const CACHE_NAME = 'fueltek-cache-v1';
const urlsToCache = [
  '/', // Cacha el index.html
  '/index.html',
  '/styles.css',
  '/script.js',
  '/logo-fueltek.png',
  // URLs externas (opcional pero recomendado si quieres offline total)
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap',
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',
  'https://unpkg.com/lucide@latest'
];

// Evento de Instalación: Cacha todos los archivos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento de Fetch: Devuelve los archivos desde la caché
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Devuelve el archivo si está en caché
        if (response) {
          return response;
        }
        // Si no está, lo busca en la red
        return fetch(event.request);
      })
  );
});
