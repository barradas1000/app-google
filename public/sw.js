// Define a unique cache name for this version of the app
const CACHE_NAME = 'tuktuk-tracker-cache-v1';
// List of essential files to cache for the app to work offline
const urlsToCache = [
  '/',
  '/index.html',
  // CSS and JS are now bundled with hash names by Vite,
  // so caching them by name here is not effective.
  // The service worker can be enhanced with a library like Workbox
  // to automatically handle caching of built assets.
  // For now, it caches the main entry points.
];

// Event listener for the 'install' event
// This is where we populate the cache.
self.addEventListener('install', event => {
  // waitUntil() ensures that the service worker will not install until the code inside has successfully completed.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto');
        // addAll() fetches and caches all the specified URLs.
        return cache.addAll(urlsToCache);
      })
  );
});

// Event listener for the 'fetch' event
// This intercepts network requests and serves cached files if available.
self.addEventListener('fetch', event => {
  event.respondWith(
    // match() looks for a match for the current request in the cache.
    caches.match(event.request)
      .then(response => {
        // If a cached response is found, return it.
        if (response) {
          return response;
        }
        // If the request is not in the cache, fetch it from the network.
        return fetch(event.request);
      })
  );
});