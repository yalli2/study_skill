/* Study Skill Quest — 오프라인용 서비스 워커 */
const CACHE = "ssq-v3";
const ASSETS = ["./", "./index.html", "./css/style.css", "./js/i18n.js", "./js/data.js", "./js/app.js", "./js/lang/ui.ko.js", "./js/lang/ui.en.js", "./js/lang/ui.es.js", "./js/lang/ui.ja.js", "./js/lang/ui.zh.js", "./js/lang/data.en.js", "./js/lang/data.es.js", "./js/lang/data.ja.js", "./js/lang/data.zh.js", "./manifest.webmanifest", "./privacy.html",
  "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  // 네트워크 우선(최신 내용), 실패하면 캐시
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match("./index.html"))));
});
