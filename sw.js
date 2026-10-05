const CACHE_NAME = 'fueltek-shell-v5';
const FILES = ['./','./index.html','./styles.css','./professional.css','./script.js','./professional.js','./access.js','./settings.js','./settings.css','./receipt.js','./receipt-pdf.js','./vendor/pdf-lib.min.js','./receipt.css','./vendor/firebase-auth-compat.js','./logo-fueltek.png','./stamp-motosierra.png','./manifest.json','./icon-192.png','./vendor/lucide.min.js','./vendor/firebase-app-compat.js','./vendor/firebase-firestore-compat.js','./icon-512.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('fueltek-') && k !== CACHE_NAME).map(k => caches.delete(k))))));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  if (!FILES.some(path => new URL(path, self.registration.scope).pathname === url.pathname)) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) {const copy=response.clone(); event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy)));}
    return response;
  }).catch(async () => (await caches.match(event.request)) || (event.request.mode === 'navigate' ? caches.match(new URL('./index.html',self.registration.scope).href) : Response.error())));
});
