// FireCheck service worker — cache แค่ asset คงที่ / API วิ่งตรงเสมอ
const CACHE = 'firecheck-v12';
const ASSETS = ['assets/app.css?v=12', 'assets/app.js?v=12', 'assets/admin.js?v=12', 'icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.includes('api.php') || url.pathname.includes('photo.php')) return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
