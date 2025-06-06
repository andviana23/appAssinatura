const CACHE_NAME = 'trato-de-barbados-v2-rebuild';

// Clear all caches on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      console.log('All caches cleared');
      return self.skipWaiting();
    })
  );
});

// Bypass cache for all requests during this rebuild
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request.clone()).catch(() => {
      // If fetch fails, return a basic response
      if (event.request.destination === 'document') {
        return new Response('Cache cleared - please refresh', {
          headers: { 'Content-Type': 'text/html' }
        });
      }
      return new Response('', { status: 404 });
    })
  );
});

// Claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('Deleting cache during activation:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      console.log('Service worker activated - all caches cleared');
      return self.clients.claim();
    })
  );
});