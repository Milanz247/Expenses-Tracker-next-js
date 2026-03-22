const CACHE_NAME = "expense-tracker-v3";
const API_CACHE = "expense-tracker-api-v1";
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

  // Stale-while-revalidate for API GET requests
  if (url.port === "8081" || url.pathname.startsWith("/api")) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);

        // Always revalidate in the background
        const networkPromise = fetch(event.request)
          .then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => null);

        // Serve stale immediately if available, otherwise wait for network
        if (cached) return cached;
        const networkResponse = await networkPromise;
        if (networkResponse) return networkResponse;
        return new Response(JSON.stringify({ error: "Offline" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
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
