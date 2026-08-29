// Seoni Circle App — pure cache-first service worker (v3.0)
// App ki apni files (JS/CSS/HTML) ek baar cache hone ke baad seedhe cache se
// milti hain — koi background revalidation nahi (pehle har request par bhi
// ek chupchaap network refetch chalti thi, jisse data cost bewajah badhta
// tha). Naya version aane par App Update Banner (index.html) hi ise pakadta
// hai aur "अभी अपडेट करें" dabane par poora cache ek saath force-refresh
// hota hai (neeche FORCE_REFRESH message handler). Apps Script/Google Sheets
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
      // Cache me mil gaya to seedha wahi de do — koi background refetch nahi
      // (data cost bachane ke liye). Fresh content sirf Update Banner ke
      // FORCE_REFRESH se hi aati hai.
      if (cached) return cached;

      // Cache me nahi mila (pehli baar) — network se laao aur cache kar lo.
      return fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(cacheKey, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
