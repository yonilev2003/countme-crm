// Minimal service worker: exists only to satisfy PWA installability
// (Chrome/Edge require a registered SW with a fetch handler) and to give
// navigations a friendly fallback when fully offline. Deliberately does
// NOT cache hashed Next.js build assets — those change on every deploy,
// and caching them risks serving a stale JS chunk for an old build.

const OFFLINE_URL = "/offline.html";
const SHELL_CACHE = "countme-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.add(OFFLINE_URL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.open(SHELL_CACHE).then((cache) => cache.match(OFFLINE_URL)),
    ),
  );
});
