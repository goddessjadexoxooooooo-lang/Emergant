const CACHE_NAME = "jade-co-pwa-v1";
const APP_BASE_URL = new URL(".", self.registration.scope);
const APP_BASE_PATH = APP_BASE_URL.pathname;
const APP_SHELL = [
  APP_BASE_URL.href,
  new URL("manifest.json", APP_BASE_URL).href,
  new URL("icons/favicon-48.png", APP_BASE_URL).href,
  new URL("icons/touch-icon.png", APP_BASE_URL).href,
  new URL("icons/icon-192.png", APP_BASE_URL).href,
  new URL("icons/icon-512.png", APP_BASE_URL).href,
  new URL("icons/icon-maskable-512.png", APP_BASE_URL).href,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith("jade-co-pwa-") && cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);
  const isNavigation = request.mode === "navigate";
  const isAppAsset =
    APP_SHELL.includes(requestUrl.href) ||
    requestUrl.pathname.startsWith(`${APP_BASE_PATH}static/`);

  if (request.method !== "GET" || requestUrl.origin !== self.location.origin || (!isNavigation && !isAppAsset)) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cacheKey = isNavigation ? APP_BASE_URL.href : request;

      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(cacheKey, response.clone());
        }
        return response;
      } catch {
        return (await cache.match(cacheKey)) || Response.error();
      }
    })(),
  );
});