// ImageSizeChanger PWA Service Worker
const CACHE_NAME = "imagesizechanger-v1";
const STATIC_ASSETS = [
  "/",
  "/resize-image/",
  "/compress-image/",
  "/convert-image/",
  "/guides/",
  "/about/",
  "/contact/",
  "/privacy/",
  "/terms/",
  "/site.webmanifest",
  "/manifest.json",
  "/favicon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable.png",
  "/icons/apple-touch-icon.png"
];

// Install Event — Pre-cache App Shell & Core Assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event — Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event — Stale-while-revalidate / Network-first with Cache fallback
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests or third-party analytics/ads
  if (event.request.method !== "GET") return;
  if (url.hostname.includes("google") || url.hostname.includes("analytics") || url.hostname.includes("googlesyndication")) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === "navigate") {
            return caches.match("/");
          }
          return null;
        });
      })
  );
});
