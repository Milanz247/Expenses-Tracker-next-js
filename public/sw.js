const CACHE_NAME = "expense-tracker-v4";
const API_CACHE = "expense-tracker-api-v2";
const PRECACHE_URLS = ["/dashboard", "/login", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([CACHE_NAME, API_CACHE]);
  // Also explicitly delete the old API cache so stale data is gone immediately
  caches.delete("expense-tracker-api-v1").catch(() => {});
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((n) => !keep.has(n)).map((n) => caches.delete(n))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Network-first for API GET requests — always fetch fresh data, fall back to cache
  // when offline. This ensures mutations are immediately reflected in the UI.
  if (url.port === "8081" || url.pathname.startsWith("/api")) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        try {
          const response = await fetch(event.request);
          if (response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        } catch {
          // Offline — serve stale data as fallback
          const cached = await cache.match(event.request);
          if (cached) return cached;
          return new Response(JSON.stringify({ error: "Offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }
      })
    );
    return;
  }

  // Network-first for navigation, cache-first for static assets
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          const fallback = await caches.match("/dashboard");
          if (fallback) return fallback;
          return new Response("Offline", { status: 503 });
        })
    );
    return;
  }

  // Cache-first for static assets
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
        return new Response("Offline", { status: 503 });
      }
    })
  );
});
