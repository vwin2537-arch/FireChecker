// FireCheck service worker — cache แค่ asset คงที่ / API วิ่งตรงเสมอ
const CACHE = 'firecheck-v34';
const ASSETS = ['assets/app.css?v=34', 'assets/app.js?v=34', 'assets/admin.js?v=34', 'icon-192.png'];
// ไฟล์ยืนยันใบหน้า (~14MB) แยก cache ต่างหาก — ไม่ precache (install จะช้า/พัง)
// และไม่ล้างตอนเด้ง version ไม่งั้นทุกรีลีสเจ้าหน้าที่ต้องโหลดใหม่ 14MB
const FACE_CACHE = 'firecheck-face-v1';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FACE_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.includes('api.php') || url.pathname.includes('photo.php')) return;
  // โมเดล/ไลบรารีใบหน้า: cache ตอนโหลดครั้งแรก แล้วใช้ของเดิมตลอด (เช็คชื่อ 8 โมงต้องไม่รอเน็ต)
  if (url.pathname.includes('/assets/models/') || url.pathname.includes('/assets/face-api.js')) {
    e.respondWith(caches.open(FACE_CACHE).then(c => c.match(e.request).then(hit =>
      hit || fetch(e.request).then(res => { if (res.ok) c.put(e.request, res.clone()); return res; }))));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
