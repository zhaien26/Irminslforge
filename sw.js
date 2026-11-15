/* ==========================================================================
   Irminsul Forge — offline & fast cache (service worker).

   - HTML pages (navigation): network-first, falling back to cache offline,
     so updates always show on the very next visit.
   - Versioned static assets (?v=VERSION): cache-first (falling back to network
     and caching), making switching between Roster / Team Builder / Tracker
     near-instant without re-parsing or re-downloading 2.2 MB of scripts.
   ========================================================================== */
var VERSION = "20261115";
var CACHE = "irminsul-forge-" + VERSION;
var FILES = [
  "./", "index.html", "builder.html", "tracker.html",
  "app.css", "app.js", "data.js", "img.js", "forge-core.js", "guide.js",
  "page-index.js", "page-builder.js", "page-tracker.js",
  "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "logo-mark.webp"
];

function keyOf(url) {
  var u = new URL(url, self.location.href);
  return u.origin + u.pathname;
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(FILES.map(function (file) {
        return fetch(file, { cache: "no-cache" }).then(function (res) {
          if (res.ok) return cache.put(keyOf(file), res);
        }).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k.indexOf("irminsul-forge-") === 0 && k !== CACHE;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function fromServer(req) {
  if (req.mode !== "navigate") return fetch(req);
  return fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then(function (res) {
    return res.redirected ? fetch(req) : res;
  });
}

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET" || req.url.indexOf(self.location.origin + "/") !== 0) return;

  var isVersionedAsset = req.mode !== "navigate" && req.url.indexOf("?v=" + VERSION) >= 0;
  if (isVersionedAsset) {
    event.respondWith(
      caches.open(CACHE).then(function (cache) {
        return cache.match(keyOf(req.url)).then(function (hit) {
          if (hit) return hit;
          return fetch(req).then(function (res) {
            if (res && res.ok) cache.put(keyOf(req.url), res.clone());
            return res;
          });
        });
      })
    );
    return;
  }

  event.respondWith(
    fromServer(req).catch(function () {
      return caches.open(CACHE).then(function (cache) {
        return cache.match(keyOf(req.url)).then(function (hit) {
          if (hit) return hit;
          if (req.mode === "navigate") return cache.match(keyOf("index.html"));
        });
      }).then(function (res) {
        return res || new Response("You are offline and this file has not been saved on this device yet.",
          { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      });
    })
  );
});
