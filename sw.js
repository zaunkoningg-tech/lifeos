/* Life OS service worker — offline app shell.
   Cache-first for the shell; bump CACHE to ship an update. API calls (/api/…)
   and GitHub requests always go to the network. */
const CACHE = "lifeos-v1";
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
  if (req.method !== "GET" || url.pathname.startsWith("/api/") || url.origin !== self.location.origin) {
    return; // default browser handling
  }
  // App shell: cache-first, fall back to network, then cache the response.
  e.respondWith(
    caches.match(req).then((hit) =>
      hit ||
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match("./index.html"))
    )
  );
});
