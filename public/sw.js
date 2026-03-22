const CACHE_NAME = "expense-tracker-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip API requests — never cache backend calls
  if (url.port === "8081" || url.pathname.startsWith("/api")) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;

      try {
        const response = await fetch(event.request);
        if (response.ok && response.type !== "opaque") {
          cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        // Fallback to login page for navigation requests when offline
        if (event.request.mode === "navigate") {
          const fallback = await caches.match("/login");
          if (fallback) return fallback;
        }
        return new Response("Offline", { status: 503 });
      }
    })
  );
});
