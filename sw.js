// Define a unique cache name for this version of the app
const CACHE_NAME = 'tuktuk-tracker-cache-v1';
// List of essential files to cache for the app to work offline
const urlsToCache = [
  './',
  './index.html',
  './index.css',
  './icons/logo.png',
  './manifest.json'
];

// Event listener for the 'install' event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto e populado');
        return cache.addAll(urlsToCache);
      })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Event listener for the 'activate' event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('A remover cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  // Take control of all clients immediately
  event.waitUntil(self.clients.claim());
});

// Event listener for the 'fetch' event
self.addEventListener('fetch', event => {
  // Não cachear requisições de API para evitar problemas de sincronização
  if (event.request.url.includes('/rest/v1/') || 
      event.request.url.includes('/auth/v1/')) {
    // Para APIs, sempre buscar da rede e não cachear
    event.respondWith(fetch(event.request));
    return;
  }

  // Para recursos estáticos, usar estratégia cache-first
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retornar do cache se disponível
        if (response) {
          return response;
        }
        // Buscar da rede e adicionar ao cache para próximas requisições
        return fetch(event.request).then(networkResponse => {
          // Só cachear respostas válidas e não-API
          if (networkResponse.ok && 
              !event.request.url.includes('/rest/v1/') &&
              !event.request.url.includes('/auth/v1/')) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
          }
          return networkResponse;
        });
      })
  );
});

// Background sync para tentar enviar dados quando online
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    console.log('Background sync triggered');
    event.waitUntil(doBackgroundSync());
  }
});

// Periodic sync para verificar periodicamente (requer permission)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'periodic-sync') {
    console.log('Periodic sync triggered');
    event.waitUntil(doPeriodicSync());
  }
});

async function doBackgroundSync() {
  // Aqui poderia implementar lógica para tentar enviar dados pendentes
  console.log('Tentando sincronizar em background...');
}

async function doPeriodicSync() {
  // Sincronização periódica
  console.log('Sincronização periódica executada');
}

// Message handler para comunicação com a app
self.addEventListener('message', event => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
