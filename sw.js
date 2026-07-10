// Seoni Circle App — network-first service worker (v2.2)
const CACHE = "seoni-circle-v2.3";
const CORE = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // POST (data submit) ko kabhi intercept nahi karte
  e.respondWith(
    fetch(req)
      .then((res) => {
        // Network se mila — cache me copy rakh lo (offline ke liye)
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        // Offline — cache se do
        caches.match(req).then((r) => r || caches.match("./index.html"))
      )
  );
});
