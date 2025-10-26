// Service Worker para PWA - Controle de Contas
// TEMPORARIAMENTE DESABILITADO PARA EVITAR CACHE DURANTE DESENVOLVIMENTO

const CACHE_NAME = 'controle-contas-v10-no-cache';

// Install event - pula o cache
self.addEventListener('install', event => {
  console.log('Service Worker instalado - SEM CACHE');
  self.skipWaiting(); // Ativa imediatamente
});

// Fetch event - SEMPRE busca da rede (sem cache)
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        return response;
      })
      .catch(error => {
        console.log('Erro ao buscar:', error);
        throw error;
      })
  );
});

// Activate event - limpa TODOS os caches
self.addEventListener('activate', event => {
  console.log('Service Worker ativado - Limpando caches');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          console.log('Deletando cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      return self.clients.claim(); // Assume controle imediatamente
    })
  );
});

