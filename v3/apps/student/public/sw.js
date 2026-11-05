/*
 * ViBe service worker. Hand-written and deliberately small: it makes the app
 * installable and repeat visits fast, and never serves stale data.
 *
 *  - Pages (navigations): always from the network, so a new deploy shows up on
 *    the next visit. Only when the network is unreachable does it show
 *    /offline.html.
 *  - /assets/*: Vite's content-hashed build files, which never change once
 *    published, so cache-first is safe. Kept across deploys, trimmed to the
 *    newest MAX_ASSETS entries.
 *  - Everything else is left to the browser, including every API call, Firebase
 *    sign-in, other origins (video, fonts, CDNs) and any non-GET request.
 *
 * Bump VERSION when the offline page or the precached files change.
 * To switch this off for everyone, deploy a sw.js that calls
 * self.registration.unregister() in its activate handler.
 */
const VERSION = 'v1';
const SHELL_CACHE = `vibe-shell-${VERSION}`;
const ASSET_CACHE = 'vibe-assets';
const OFFLINE_URL = '/offline.html';
// The offline page is self-contained (icon inlined), so it's all that's precached.
const PRECACHE = [OFFLINE_URL];
const MAX_ASSETS = 80;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      // Safe to take over at once: pages come from the network and assets are hashed.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('vibe-shell-') && key !== SHELL_CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/__/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    await cache.put(request, response.clone());
    void trim(cache);
  }
  return response;
}

/** Drops the oldest entries so old deploys' files don't pile up. */
async function trim(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) await cache.delete(key);
}
