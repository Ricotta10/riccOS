const CACHE_NAME = 'riccos-pwa-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/site.webmanifest'
];

// Install event - caching essential shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - Stale-while-revalidate strategy for GET requests
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Ignore API requests or Supabase authentication calls from hard caching
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api') || url.hostname.includes('supabase')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and request is HTML document, return index page or cached match
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/');
          }
        });

      return cachedResponse || fetchPromise;
    })
  );
});
