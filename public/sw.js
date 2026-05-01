// Simple service worker to enable PWA features
const CACHE_NAME = 'alfathprint-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Default fetch behavior - let server handle everything
  event.respondWith(fetch(event.request));
});
