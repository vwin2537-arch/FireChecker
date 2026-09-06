# แจ้งเตือนเข้ามือถือ — Web Push (v37)

> แยกจาก CLAUDE.md เพื่อคุมขนาด context — อ่านไฟล์นี้ก่อนแตะ `app/push.php`, `app/handlers/push.php`, `sw.js` (ก้อน push), `Push` ใน `app.js`

ทำให้ FireCheck เด้งแจ้งเตือนขึ้นหน้าจอเหมือนแอปเนทีฟ **โดยไม่พึ่ง Firebase และไม่ลง composer** — ใช้ VAPID (RFC 8292) + payload เข้ารหัส aes128gcm (RFC 8291/8188) เขียนด้วย `openssl` + `hash_hkdf` ที่มากับ PHP

> 🧰 **จะทำแบบนี้ในโปรเจคอื่น → ใช้ skill `web-push-pwa`** (`~/.claude/skills/web-push-pwa/`) — มีโค้ดแกน + ตัวตรวจ crypto + กับดักทั้งหมดพร้อมใช้

> เกร็ด: บน Android/Chrome ตัว Web Push มาตรฐาน**วิ่งผ่านเซิร์ฟเวอร์ของ Google อยู่แล้ว** (endpoint เป็น `fcm.googleapis.com`) เลยได้ผลเหมือนใช้ FCM โดยไม่ต้องตั้ง Firebase project

## ⚠️ กับดักใหญ่สุด — iPhone

**iOS ส่ง push ให้เฉพาะ PWA ที่ "เพิ่มลงหน้าจอโฮม" แล้วเท่านั้น (iOS 16.4+)** เปิดใน Safari ธรรมดา = ไม่มีทางได้ ไม่ว่าโค้ดจะถูกแค่ไหน
- ต้องเปิดด้วย **Safari** เท่านั้นตอนกด "เพิ่มไปยังหน้าจอโฮม" (Chrome บน iOS ทำไม่ได้)
- โค้ดตรวจให้แล้ว: `Push.rowHtml()` ขึ้นปุ่ม "วิธีทำ" แทนปุ่มเปิด เมื่อเจอ `platform=ios && !standalone`
- Android/Chrome/เดสก์ท็อป ได้เลย ไม่ต้องติดตั้ง
- ตาราง `user_devices` มีไว้ตอบคำถามนี้โดยเฉพาะ — หัวหน้าเปิดหน้าตั้งค่าแล้วเห็นเลยว่าใครยังต้องไปติดตั้ง

## กระแสข้อมูล

```
เปิดแอป → Push.report() → device_report  (บันทึก user_devices + รับ vapid_public กลับมา)
กดปุ่มเปิด → Notification.requestPermission() → pushManager.subscribe() → push_subscribe (เก็บ push_subscriptions)
มีเหตุ    → notify_push()/notify_broadcast() → push_to_user()/push_to_users() → push_send_raw() → curl_multi → push service → sw.js 'push' → showNotification
```

## สิ่งที่เด้ง (ตามที่พี่วินเลือกไว้)

| เหตุ | ถึงใคร | จุดในโค้ด |
|------|--------|-----------|
| 📢 ประกาศจากหัวหน้า | เจ้าหน้าที่ active ทุกคน | `notify_broadcast()` (เสียบใน notify.php) |
| ✅❌ อนุมัติ/ไม่อนุมัติลา | เจ้าตัว | `notify_push()` (เสียบใน notify.php) |
| ⏰ ยังไม่เช็คชื่อ | คนที่ยังไม่เช็ค | `h_cron_push_remind` |
| 🔔 มีคนขอลารออนุมัติ | แอดมินทุกคน | `h_dayoff_add` (push อย่างเดียว ไม่เขียนกล่องข้อความ) |

**เสียบที่ `notify_push`/`notify_broadcast` จุดเดียว** — ได้กฎ "ห้าม hook เข้า `leave_auto_approve()`" ติดมาฟรี และข้อความในกล่องกับที่เด้งตรงกันเสมอ ถ้าจะเพิ่มเหตุใหม่ ให้เรียก `notify_push` ไม่ใช่เรียก `push_to_user` ตรงๆ (ยกเว้นกรณีที่ตั้งใจไม่เก็บเข้ากล่อง เช่น push หาหัวหน้า)

## กับดักที่เจอจริง / ต้องระวัง

- **`openssl_sign` คืน DER ไม่ใช่ r||s** — JWT ES256 ต้องการ 64 ไบต์ดิบ → `ecdsa_der_to_raw()` ต้อง `ltrim("\x00")` แล้ว `str_pad` ซ้ายกลับเป็น 32 ไบต์ (บั๊กนี้โผล่แค่ ~1 ใน 256 ครั้ง จึงต้องเทสต์วนหลายรอบ)
- **`openssl_pkey_get_details()['ec']['x'|'y'|'d']` ตัดเลข 0 นำหน้าออก** — ต้อง `str_pad(..., 32, "\x00", STR_PAD_LEFT)` ทุกจุด ไม่งั้นกุญแจ 64 ไบต์กลายเป็น 63
- **อย่าส่ง `$key_length` ให้ `openssl_pkey_derive`** — deprecated ตั้งแต่ PHP 8.5 (P-256 คืน 32 ไบต์อยู่แล้ว)
- **เก็บ VAPID private เป็น PEM** (ไม่ใช่ scalar ดิบ) จะได้ไม่ต้องประกอบ DER SEC1 กลับตอนเซ็น · ส่วน public เก็บเป็น base64url ของจุด 65 ไบต์เพราะ client ต้องใช้เป็น `applicationServerKey`
- **`p256_pub_pem()` ใช้ prefix คงที่ 26 ไบต์** ของ SubjectPublicKeyInfo (P-256) — ต่อกับจุด 65 ไบต์ = 91 ไบต์ ใช้แปลง `p256dh` ของเบราว์เซอร์เป็น key object ให้ `openssl_pkey_derive`
- **`Notification.requestPermission()` ต้องอยู่ในจังหวะกดสด** ห้ามมี `await` คั่นก่อน — WebKit กินสิทธิ์ transient activation แบบเดียวกับกรณีเปิดกล้อง (PROGRESS lesson 10) จึงต้องโหลด `vapid` ไว้ล่วงหน้าตอน boot
- **เปลี่ยน `vapid_public` = subscription เดิมพังหมด** ทุกคนต้องกดอนุญาตใหม่ → `h_push_vapid_gen` บังคับ `force=1` + ล้าง `push_subscriptions` ทิ้งให้ ไม่ให้ค้างเป็นขยะ
- **404/410 = endpoint ตาย ลบทิ้งได้เลย** (เจ้าหน้าที่ถอนสิทธิ์/ลบแอป) — `push_send_raw` ลบให้อัตโนมัติ · `last_ok_at` อัปเดตเฉพาะตัวที่ได้ 2xx จริง
- **ไม่มีคิว** — จุดที่ส่ง push ทั้งหมดเป็นฝั่งแอดมิน/cron ไม่มีอันไหนอยู่ในเส้นทางเช็คชื่อของเจ้าหน้าที่ จึงยิงด้วย `curl_multi` ตรงๆ (19 คนจบใน ~1 วิ) ไม่ต้องทำ `push_queue` แบบ drive/line — **ถ้าอนาคตมีเหตุที่ push จากเส้นทางเจ้าหน้าที่ ต้องกลับมาคิดเรื่องคิวใหม่**
- **ปุ่ม "ส่งทดสอบหาตัวเอง" ส่งหา user ที่ login อยู่เท่านั้น** — เทสต์ครั้งแรกบน prod (6 ก.ย. 2026) มือถือ logout จากแอดมินไป login เป็น จนท. แล้วกดเปิดแจ้งเตือน ส่วนปุ่มทดสอบกดจากเครื่องแอดมินอีกเครื่อง → **ไม่เคยมี push ถูกยิงไปหามือถือเลย** ดูเหมือนระบบพัง ทั้งที่ทำงานถูก · แก้ด้วย (ก) เด้งยืนยันอัตโนมัติตอนกดเปิด (ข) ปุ่ม "ทดสอบ" รายคนในตารางอุปกรณ์ (`push_test` รับ `user_id`)
- **เด้งยืนยันตอน subscribe ต้องยิงเฉพาะ `welcome=1`** — `Push.report()` เรียก `sync()` เงียบๆ **ทุกครั้งที่เปิดแอป** ถ้ายิงทุกครั้งจะกลายเป็นเด้งใส่เจ้าหน้าที่ทุกคนทุกครั้งที่เปิดแอป (`enable()` → `sync(true)` เท่านั้น)
- **ห้ามใช้ `Notification.permission` ตัดสินว่า "เปิดอยู่"** — กดปิดแล้วสิทธิ์เบราว์เซอร์ยังเป็น `granted` เหมือนเดิม ปุ่มจะค้างเป็น "ปิด" ตลอด กดเท่าไหร่ก็ไม่เปลี่ยน (เจอจริง v39) · ต้องดูจาก `pushManager.getSubscription()` → เก็บใน `Push.subscribed` แล้ววาดแถวซ้ำด้วย `paintRow()` (แถวถูกวาดครั้งแรกแบบ sync ก่อนรู้ผล จึงต้องมี `<div id="pushRow">` ให้วาดทับ)
- **กดปิดต้องจำไว้ใน localStorage (`fc_push_off`)** — ไม่งั้น `report()` จะ `sync()` subscribe กลับเองทุกครั้งที่เปิดแอป = ปิดไม่ได้จริง (บั๊กซ้อนที่เจอพร้อมกัน) · `enable()` ลบธงทิ้ง
- payload มีเพดาน ~4KB ต่อข้อความ — ตอนนี้ส่งแค่ title/body/url/tag ไม่ต้องกังวล

## ตาราง

- `user_devices` — 1 แถว/เบราว์เซอร์ (`device_key` สุ่มฝั่ง client เก็บ localStorage) เก็บ platform/browser/os_version/**standalone**/push_perm · ใช้ตอบว่าใครพร้อมรับ push
- `push_subscriptions` — endpoint + `p256dh` + `auth_secret` · unique ที่ `endpoint_hash` (sha256) เพราะ endpoint ยาวเกิน index ปกติ
- `push_logs` — กัน cron ยิงเตือนซ้ำ unique (log_type, log_date) แนวเดียวกับ `line_logs`

## ตั้งค่า

| setting | ค่าตั้งต้น | หมายเหตุ |
|---------|-----------|----------|
| `push_enabled` | `0` | สวิตช์รวม — ปิดอยู่ = ไม่มี push ออกเลย (กล่องข้อความยังทำงานปกติ) |
| `push_remind_enabled` | `1` | เตือนคนที่ยังไม่เช็คชื่อ (ทำงานต่อเมื่อ `push_enabled=1`) |
| `push_remind_time` | `08:00` | เวลาที่ตั้ง cron ยิง — ควรก่อน `late_cutoff` |
| `vapid_public` / `vapid_private` | ว่าง | กดสร้างจากหน้าตั้งค่า (การ์ด 🔔) ครั้งเดียว |
| `vapid_subject` | `mailto:...` | ตามสเปก VAPID ต้องมี — ไม่อยู่ในหน้าตั้งค่า |

## cron

```
GET /api.php?action=cron_push_remind&key=<CRON_SECRET>     ตั้งเวลาตาม push_remind_time (ตั้งต้น 08:00)
```
ข้ามให้อัตโนมัติ: วันหยุดสถานี · วันที่ทั้งสถานีออกนอกพื้นที่ · คนที่เช็คแล้ว · คนที่ลา · คนที่เมื่อคืนลงเวรกลางคืน · คนไปราชการแบบไม่นับสาย
`force=1` ข้ามการกันส่งซ้ำ (ใช้ตอนทดสอบ)

## วิธีตรวจว่า crypto ยังถูก (ถ้าไปแก้ app/push.php)

สคริปต์ตรวจอยู่ใน scratchpad ของ session 6 ก.ย. 2026 — เขียนใหม่ได้ไม่ยาก แนวคิด:
1. PHP: `vapid_generate()` + สร้างคู่กุญแจ "เบราว์เซอร์" ปลอม → `push_encrypt()` + `vapid_jwt()` พ่นออกมาเป็น JSON
2. Node: ทำหน้าที่ผู้รับ — `crypto.verify(... dsaEncoding:'ieee-p1363')` ตรวจ JWT, แล้ว `createECDH('prime256v1')` + `hkdfSync` + `aes-128-gcm` ถอด payload เทียบต้นฉบับ
3. **วนอย่างน้อย 100 รอบ** (กุญแจสุ่มใหม่ทุกครั้ง) เพื่อจับบั๊กเลข 0 นำหน้า

ทดสอบทั้งเส้นทาง: รัน node http server ปลอมรับ POST (ตอบ 201 / ตอบ 410 ถ้า path ขึ้นต้น `/gone`) แล้วยัด `push_subscriptions` ชี้มาที่นั่น → เรียก `push_test` / `announce_send` / `cron_push_remind` แล้วถอดรหัส body ที่ดักได้
