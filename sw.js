// Tadabbur service worker: offline reading and installable app.
//
// - App shell (pages, code, styles, IndoPak font, icons): saved on install, versioned per
//   deploy (CI replaces __BUILD__ with the commit), served cache-first. A new deploy installs
//   a complete new shell, so pages and code never mix versions.
// - Quran data (data/*): saved as it's read (and in bulk via "Save for offline"), served from
//   the cache and refreshed in the background. Kept across deploys; the cache name only
//   changes when the data schema changes (docs/DATA.md).
// - Google Fonts and tafsir you've read: saved for offline. Audio is streamed, not saved.

const VERSION = "__BUILD__";
const SHELL = `tadabbur-shell-${VERSION}`;
const DATA = "tadabbur-data-schema-1";
const RUNTIME = "tadabbur-runtime";

const SHELL_FILES = [
  "./", "index.html", "surah.html", "timeline.html", "stories.html", "search.html", "sources.html",
  "css/style.css",
  "js/common.js", "js/home.js", "js/surah.js", "js/timeline.js", "js/stories.js", "js/search.js", "js/sources.js",
  "js/core/index.js", "js/core/data.js", "js/core/quran.js", "js/core/search.js", "js/core/settings.js", "js/core/report.js",
  "js/i18n/index.js", "js/i18n/en.js",
  "fonts/DigitalKhatt-IndoPak.woff2",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/favicon-32.png",
];
const DATA_FILES = [
  "data/manifest.json", "data/chapters.json", "data/translations.json", "data/tafsirs.json", "data/sources.json",
  "data/hadith-index.json", "data/seerah.json", "data/seerah-by-surah.json", "data/stories.json", "data/stories-by-surah.json",
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    await (await caches.open(SHELL)).addAll(SHELL_FILES);
    await (await caches.open(DATA)).addAll(DATA_FILES);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL, DATA, RUNTIME]);
    for (const name of await caches.keys()) {
      if (name.startsWith("tadabbur-") && !keep.has(name)) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

// ---------------------------------------------------------------- strategies
async function cacheFirst(cacheName, request, { ignoreSearch = false } = {}) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request, { ignoreSearch });
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === "opaque") cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(cacheName, request) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const refresh = fetch(request).then(res => {
    if (res.ok) cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  if (hit) return hit;                                    // the refresh above keeps running
  const res = await refresh;
  return res || new Response(JSON.stringify({ offline: true }), { status: 503, headers: { "Content-Type": "application/json" } });
}

async function networkFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw new Error("offline");
  }
}

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const scope = new URL(self.registration.scope);

  if (url.origin === scope.origin && url.pathname.startsWith(scope.pathname)) {
    const path = url.pathname.slice(scope.pathname.length);
    if (path.startsWith("data/")) {
      event.respondWith(staleWhileRevalidate(DATA, req));
    } else if (req.mode === "navigate" || path === "" || path.endsWith(".html")) {
      // pages: surah.html?n=2 and ?n=3 are the same file
      event.respondWith(cacheFirst(SHELL, req, { ignoreSearch: true }));
    } else {
      event.respondWith(cacheFirst(SHELL, req));
    }
    return;
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(cacheFirst(RUNTIME, req));
    return;
  }
  if (url.hostname === "api.quran.com" && url.pathname.includes("/tafsirs/")) {
    event.respondWith(networkFirst(RUNTIME, req));
  }
  // audio and everything else: straight to the network
});

// ---------------------------------------------------------------- "Save for offline"
// Page sends { type: "save", urls: [...] }; we reply with progress messages.
self.addEventListener("message", event => {
  const msg = event.data || {};
  const reply = data => event.source && event.source.postMessage(data);
  if (msg.type === "save" && Array.isArray(msg.urls)) {
    event.waitUntil((async () => {
      const cache = await caches.open(DATA);
      let done = 0, failed = 0;
      const queue = [...msg.urls];
      const worker = async () => {
        while (queue.length) {
          const u = queue.shift();
          try {
            if (!(await cache.match(u))) {
              const res = await fetch(u);
              if (!res.ok) throw new Error(res.status);
              await cache.put(u, res);
            }
          } catch { failed++; }
          done++;
          if (done % 10 === 0 || done === msg.urls.length) reply({ type: "save-progress", done, failed, total: msg.urls.length });
        }
      };
      await Promise.all(Array.from({ length: 6 }, worker));
    })());
  } else if (msg.type === "status" && Array.isArray(msg.urls)) {
    event.waitUntil((async () => {
      const cache = await caches.open(DATA);
      let saved = 0;
      for (const u of msg.urls) if (await cache.match(u)) saved++;
      reply({ type: "status", saved, total: msg.urls.length, version: VERSION });
    })());
  }
});
