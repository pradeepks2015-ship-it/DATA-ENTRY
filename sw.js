// Seoni Circle App — cache-first (stale-while-revalidate) service worker (v3.0)
// App ki apni files (JS/CSS/HTML/CSV data) turant cache se milti hain — network
// ka wait nahi karna padta. Background me fresh copy laakar cache update kar
// di jaati hai, taaki agli baar naya version mile. Apps Script/Google Sheets
// jaisi external API calls yahaan chhuti nahi — wo apni jagah (app code me)
// alag se handle hoti hain, isliye humesha live/fresh rehti hain.
const CACHE = "seoni-circle-v3.0";
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

// App-update check/button explicitly {cache:"reload"} fetch karte hain — usse
// SW cache bilkul bypass karke seedhe network se fresh jawab milta hai, taaki
// version check aur "अभी अपडेट करें" hamesha bharosemand rahein.
self.addEventListener("message", (e) => {
  if (e.data?.type !== "FORCE_REFRESH") return;
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.keys().then((keys) => Promise.all(keys.map((req) =>
        fetch(req.url, { cache: "reload" })
          .then((res) => { if (res && res.ok) return c.put(req, res); })
          .catch(() => {})
      ))))
      .then(() => { e.source?.postMessage({ type: "FORCE_REFRESH_DONE" }); })
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // POST (data submit) ko kabhi intercept nahi karte
  if (req.cache === "reload") return; // explicit force-fresh request — SW cache bypass, seedha network

  let url;
  try {
    url = new URL(req.url);
  } catch (_) {
    return;
  }
  if (url.origin !== self.location.origin) return; // external API calls (Apps Script/Sheets) SW ke bahar

  // Query string (jaise cache-busting ?t=...) hata kar normalize karte hain,
  // taaki wahi file baar-baar alag key se cache me duplicate hokar storage na bhare.
  const cacheKey = url.origin + url.pathname;

  e.respondWith(
    caches.match(cacheKey).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(cacheKey, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => null);

      if (cached) {
        // Turant purani (lekin theek-thaak) copy de do, background me refresh chalti rahe.
        e.waitUntil(networkFetch);
        return cached;
      }
      // Pehli baar — cache me kuch nahi, network try karo; wo bhi fail ho to app shell do.
      return networkFetch.then((res) => res || caches.match("./index.html"));
    })
  );
});
