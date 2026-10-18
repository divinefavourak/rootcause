/* RootCause service worker: app shell + last diagnosis available offline. */
const VERSION = "rc-v3";
const SHELL = ["/", "/styles.css", "/app.js", "/manifest.webmanifest", "/icons/icon.svg", "/icons/icon-192.png"];
const LAST_DIAGNOSIS = "/__last-diagnosis";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Last diagnosis: keep a copy of the newest successful answer for offline use.
  if (req.method === "POST" && url.pathname === "/api/diagnose") {
    e.respondWith(
      fetch(req.clone()).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(LAST_DIAGNOSIS, copy)); }
        return res;
      }).catch(() => caches.match(LAST_DIAGNOSIS).then((r) => r || Response.error()))
    );
    return;
  }
  if (req.method !== "GET") return;

  // API reads: network first, cached copy when offline.
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then((r) => r || Response.error()))
    );
    return;
  }

  // Pages: network first so deploys show up, shell when offline.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/")));
    return;
  }

  // Static assets: cache first, refresh in the background.
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
