// Service Worker for Flour Receipt PWA
const CACHE_NAME = 'ard-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let network handle by default, fall back to cache if offline
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
