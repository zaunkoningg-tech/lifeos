/* Life OS service worker — offline support without stale updates.
   The HTML document is network-first (so re-uploads reach the device on the
   next online launch); icons/manifest are cache-first. API + GitHub calls
   always go to the network. Bump CACHE to force a clean refresh. */
const CACHE = "lifeos-v3";
const SHELL = [
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Never cache API or cross-origin (GitHub) calls — always hit the network.
  if (req.method !== "GET" || url.pathname.startsWith("/api/") || url.origin !== self.location.origin) return;

  const isDoc = req.mode === "navigate" || req.destination === "document" ||
                url.pathname.endsWith("/") || url.pathname.endsWith("index.html");

  if (isDoc) {
    // Network-first: get the freshest app HTML; fall back to cache when offline.
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put("./index.html", copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then((h) => h || caches.match("./index.html")))
    );
    return;
  }
  // Static assets: cache-first, then network (and cache it).
  e.respondWith(
    caches.match(req).then((hit) =>
      hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
    )
  );
});
