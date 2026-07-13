const CACHE_NAME = "fip-shell-v65";

const SHELL_ASSETS = [
  "./",
  "index.html",
  "styles.css?v=101",
  "app.js?v=116",
  "manifest.webmanifest",
  "assets/compass-mark.png",
  "assets/compass-ring.png",
  "assets/home-hero.png",
  "assets/logo-badge-192.png",
  "assets/logo-badge-512.png",
  "assets/apple-touch-icon.png",
  "assets/fonts/fraunces-variable.woff2",
  "assets/fonts/alex-brush.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Firebase auth/firestore/functions and other cross-origin requests go straight to the network.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("index.html", copy));
          return response;
        })
        .catch(() => caches.match("index.html")),
    );
    return;
  }

  const isStaticAsset = url.pathname.includes("/assets/");
  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  // Network-first for versioned css/js so deploys show up immediately, cache fallback offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })),
  );
});
