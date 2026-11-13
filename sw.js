/* ==========================================================================
   Irminsul Forge — offline copy (service worker).

   What it does: the first time someone opens the site it keeps a copy of every
   file below, so the site still opens with no connection and can be installed
   to the home screen like an app.

   What it never does: serve an old file while you are online. Every request
   goes to the server first; the kept copy is used only when the request fails
   because there is no connection. A page itself is always re-checked with the
   server, so an upload shows up on the very next visit instead of up to ten
   minutes later.

   When the site changes, bump VERSION here and the ?v= tag in the three pages
   (same value). The tag makes browsers fetch the new scripts at once; VERSION
   makes every phone refresh its offline copy in one go.
   ========================================================================== */
var VERSION = "20261112";
var CACHE = "irminsul-forge-" + VERSION;
var FILES = [
  "./", "index.html", "builder.html", "tracker.html",
  "app.css", "app.js", "data.js", "img.js", "forge-core.js", "guide.js",
  "page-index.js", "page-builder.js", "page-tracker.js",
  "manifest.webmanifest", "icon-192.png", "icon-512.png"
];

/* one kept copy per file: "app.css?v=1" and "index.html?c=hu-tao" are the same files as without the "?" part */
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
        }).catch(function () { /* a file that cannot be fetched is simply not available offline */ });
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

/* pages: ask the server every time (a cheap "has it changed?" request). Everything else: a normal request —
   the ?v= tag in the page already decides which copy of a script or stylesheet is wanted. */
function fromServer(req) {
  if (req.mode !== "navigate") return fetch(req);
  return fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then(function (res) {
    return res.redirected ? fetch(req) : res;       /* a redirect has to be followed by the browser itself */
  });
}

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET" || req.url.indexOf(self.location.origin + "/") !== 0) return;
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
