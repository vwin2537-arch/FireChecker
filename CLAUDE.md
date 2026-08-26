# CLAUDE.md — FireCheck

ระบบเช็คชื่อเจ้าหน้าที่สถานีควบคุมไฟป่าสลักพระ-เอราวัณ ของพี่วิน (หัวหน้าสถานี = แอดมินคนเดียว)
พัฒนาต่อยอดแนวคิดจากระบบเช็คชื่อนักเรียน (GAS) ที่ `../11_ระบบเช็คชื่อนักเรียน 5/` แต่เขียนใหม่หมดเป็น PHP+MySQL เพราะ GAS ช้า

**Live:** https://sakpra-erawan.up.railway.app · **ไฟล์นี้เก็บแค่กฎเหล็ก + ดัชนี** — รายละเอียดรายฟีเจอร์อยู่ใน `docs/notes/` (อ่านเฉพาะไฟล์ที่ตรงเรื่องที่จะแก้)

## Stack & กฎเหล็ก

- **PHP 8 (ไม่มี framework) + MySQL + Vanilla JS SPA** — อย่าเพิ่ม dependency/framework โดยไม่ถามพี่วิน
- Frontend ไม่มี build step: แก้ `public/assets/*.js` แล้วรีเฟรชได้เลย (จำ cache-bust `?v=` ใน index.php ด้วยถ้าแก้)
- ภาษาใน UI/ข้อความ error = ไทยทั้งหมด, comment ในโค้ด = ไทย
- ทุก endpoint อยู่ใน `public/api.php?action=xxx` → map ไปฟังก์ชัน `h_*` ใน `app/handlers/`
- Auth: token 64 hex ใน header `X-Auth-Token` เก็บ DB (`auth_tokens`) + localStorage ฝั่ง client
- เวลา: `Asia/Bangkok` ทุกที่ (ตั้งใน config.php) — **ห้ามใช้ toISOString()/UTC เทียบวันที่**
- settings ทุกตัวอยู่ในตาราง `settings` แก้ผ่านหน้าตั้งค่า — อย่า hardcode ค่าที่ควรเป็น setting
- ฟีเจอร์มีสวิตช์: `selfie_required`, `checkout_enabled` (ตอนนี้ปิดทั้งคู่ — โค้ดพร้อมแล้วทั้งฝั่ง API และ UI)
- schema สร้างอัตโนมัติตอน request แรก (ensure_admin ใน db.php รัน schema.sql ถ้าไม่เจอตาราง)

## 📇 ดัชนี — รายละเอียดรายฟีเจอร์ (`docs/notes/`)

**อ่านไฟล์ที่ตรงเรื่องก่อนแตะโค้ดส่วนนั้นเสมอ** — ทุกไฟล์มีกับดักที่เคยทำพังจริงบันทึกไว้

| ไฟล์ | เนื้อหา | แตะเมื่อจะแก้ |
|------|---------|----------------|
| [`deploy.md`](docs/notes/deploy.md) | ขั้นตอน deploy Railway + กับดัก (mpm, chown Volume, display_errors, MySQL UTC, cache-bust) | **ก่อน deploy ทุกครั้ง** · แก้ Dockerfile/sw.js/index.php |
| [`leave-approval.md`](docs/notes/leave-approval.md) | ระบบอนุมัติลา + วันหยุดนักขัตฤกษ์ + โควต้าผันแปร | `dayoffs.php`, `line.php`, `is_station_holiday` |
| [`night-sunday.md`](docs/notes/night-sunday.md) | เวรกลางคืน + เช็คชื่อวันอาทิตย์ + `users.gender` | `attendance.php` (`h_night_checkin`, `tonight_duty_date`) |
| [`offsite.md`](docs/notes/offsite.md) | เช็คนอกสถานที่ทั้งสถานี (v25) + รายคน (v30) | `offsite_days`, `offsite_users`, `h_checkin` |
| [`face-verify.md`](docs/notes/face-verify.md) | ยืนยันใบหน้า 1:1 — เกณฑ์ที่วัดมา, ตั๋ว, ธง, ลงทะเบียน | `face.php`, `face-api.js`, `assets/models/` |
| [`gdrive.md`](docs/notes/gdrive.md) | สำเนารูปเช็คอินขึ้น Google Drive (คิว + worker + OAuth) | `drive.php`, `cron/drive.php`, `oauth.php` |
| [`mailbox.md`](docs/notes/mailbox.md) | กล่องข้อความ 📬 + จุดแดง + แดชบอร์ดคืนนี้ใครเข้าเวร | `notify.php`, `notify_push/broadcast` |
| [`health.md`](docs/notes/health.md) | โซนสุขภาพ: สมุดสุขภาพ / ทดสอบสมรรถภาพ / การ์ดวัคซีน | `health.php`, `vaccine.php` |
| [`training.md`](docs/notes/training.md) | ประวัติการฝึกอบรม (v35) | `training.php` |
| [`dashboard-report.md`](docs/notes/dashboard-report.md) | แต่งหน้าแดชบอร์ด/ปฏิทิน + รายงานอันดับความขยัน (ปริ้น/PNG) | `admin.js` `analyticsHtml`, `openReport`, `.rp-*` |

**timeline + สถานะโปรเจค + Lesson learned** → `PROGRESS.md` (log เก่า → `PROGRESS_ARCHIVE.md`)

## รัน dev

```bash
mysql -uroot -e "CREATE DATABASE IF NOT EXISTS firecheck CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
php -S 127.0.0.1:8123 -t public     # login: admin/admin1234
php cron/report.php morning          # ทดสอบ LINE report (ไม่มี token = โชว์ preview)
```

ทดสอบ E2E ด้วย playwright (สคริปต์อยู่ scratchpad ของ session เก่า — เขียนใหม่ได้: login → checkin mock GPS 14.3747,99.1455 → screenshot)

## Logic สำคัญที่พลาดง่าย

- **เช็คอิน iOS (`doCheckin` app.js):** ต้อง `captureSelfie()` (เปิดกล้อง) **ก่อน** `await getPosition()` เสมอ — iOS/WebKit บังคับ file-input `.click()` อยู่ในจังหวะกดสด (transient user-activation) ถ้ามี `await` คั่นก่อน กล้องจะไม่เปิด ค้างเงียบ ไม่มี timeout ปุ่มค้าง disabled (Chrome iOS เจอด้วย = WebKit เดียวกัน) — flow ถูก: เซลฟี่ → GPS → ยืนยัน, ห่อ try/finally ปลดล็อกปุ่มเสมอ → ดู PROGRESS.md → Lesson learned ข้อ 10
- **สถานะรายวัน** คำนวณสดใน `roster_for()` (admin.php): มี attendance → ontime/late, มี day_off → leave, ไม่มีทั้งคู่ → absent
- **วันอาทิตย์** = วันหยุดสถานี (`is_station_holiday`) — ไม่นับ absent, จอง day_off ไม่ได้, cron ไม่ส่งรายงาน
- **โควต้า** นับเฉพาะ `type='dayoff'` — ลาป่วย/ลากิจไม่นับ; **โควต้ารายเดือน = จำนวนวันหยุดสถานีของเดือนนั้น (อาทิตย์ + นักขัตฯวันธรรมดา) คำนวณสดด้วย `station_holidays_in_month()` — ไม่ใช่เลขคงที่แล้ว** (setting `off_quota_month` เลิกใช้). เกินโควต้า = `over_quota=1` + **status pending รอหัวหน้าอนุมัติเสมอ** (ไม่ auto-approve) → เด้ง alert + คิวอนุมัติหน้าแอดมิน
- **Engagement Score 2 โหมด** ตาม `checkout_enabled`: ปิด = มา60+ตรง40, เปิด = 30/30/20/20 — วันลาถูกตัดออกจากตัวหาร (ไม่หักคะแนน)
- attendance/day_offs มี **UNIQUE (user_id, วันที่)** — insert ซ้ำจะ throw, เช็คก่อน insert แล้ว
- รูปเก็บที่ `UPLOAD_DIR` (Railway = Volume `/data/uploads`) เสิร์ฟผ่าน `photo.php` เท่านั้น (ต้อง login, กัน path traversal ด้วย regex)
- LINE report กันส่งซ้ำด้วยตาราง `line_logs` unique (type, date) — ปุ่มทดสอบในหน้าตั้งค่าใช้ `force=1`

## Deploy (ย่อ — รายละเอียด/กับดักครบใน [`docs/notes/deploy.md`](docs/notes/deploy.md))

```bash
railway up --service firecheck-app      # tarball upload
curl -s https://sakpra-erawan.up.railway.app/index.php | grep 'v='   # verify ทุกครั้ง
```

- **⚠️ push GitHub ไม่ auto-deploy** — repo เป็น source control อย่างเดียว ต้อง `railway up` เอง
- **⚠️ แก้ `public/assets/*` ต้องเด้ง version 2 ที่พร้อมกัน:** `?v=N` ใน `index.php` (3 บรรทัด) **และ** `CACHE = 'firecheck-vN'` + ASSETS ใน `sw.js` — ไม่งั้น PWA ที่ติดตั้งแล้วเห็นของเก่า · **ห้ามแตะ `FACE_CACHE`** (เด้งแล้ว จนท.โหลดใหม่ 14MB ทุกคน)
- บั๊ก UI ที่ hard-refresh แล้วไม่หาย มักเป็น **โค้ดซ้ำ 2 ที่** (เช่น `devSegHtml` มีทั้ง app.js + admin.js) ไม่ใช่ cache

## ห้าม commit

`credentials.json`, `token.pkl`, `*.env`, `config.env`, `*.csv` (อยู่ใน .gitignore แล้ว) — LINE token เก็บใน DB ผ่านหน้าตั้งค่า ไม่อยู่ในโค้ด
