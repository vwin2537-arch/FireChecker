# CLAUDE.md — FireCheck

ระบบเช็คชื่อเจ้าหน้าที่สถานีควบคุมไฟป่าสลักพระ-เอราวัณ ของพี่วิน (หัวหน้าสถานี = แอดมินคนเดียว)
พัฒนาต่อยอดแนวคิดจากระบบเช็คชื่อนักเรียน (GAS) ที่ `../11_ระบบเช็คชื่อนักเรียน 5/` แต่เขียนใหม่หมดเป็น PHP+MySQL เพราะ GAS ช้า

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

## รัน dev

```bash
mysql -uroot -e "CREATE DATABASE IF NOT EXISTS firecheck CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
php -S 127.0.0.1:8123 -t public     # login: admin/admin1234
php cron/report.php morning          # ทดสอบ LINE report (ไม่มี token = โชว์ preview)
```

ทดสอบ E2E ด้วย playwright (สคริปต์อยู่ scratchpad ของ session เก่า — เขียนใหม่ได้: login → checkin mock GPS 14.3747,99.1455 → screenshot)

## Logic สำคัญที่พลาดง่าย

- **สถานะรายวัน** คำนวณสดใน `roster_for()` (admin.php): มี attendance → ontime/late, มี day_off → leave, ไม่มีทั้งคู่ → absent
- **วันอาทิตย์** = วันหยุดสถานี (`is_station_holiday`) — ไม่นับ absent, จอง day_off ไม่ได้, cron ไม่ส่งรายงาน
- **โควต้า** นับเฉพาะ `type='dayoff'` — ลาป่วย/ลากิจไม่นับ; จองเกินได้แต่ flag `over_quota=1` → เด้ง alert หน้าแอดมิน
- **Engagement Score 2 โหมด** ตาม `checkout_enabled`: ปิด = มา60+ตรง40, เปิด = 30/30/20/20 — วันลาถูกตัดออกจากตัวหาร (ไม่หักคะแนน)
- attendance/day_offs มี **UNIQUE (user_id, วันที่)** — insert ซ้ำจะ throw, เช็คก่อน insert แล้ว
- รูปเก็บที่ `UPLOAD_DIR` (Railway = Volume `/data/uploads`) เสิร์ฟผ่าน `photo.php` เท่านั้น (ต้อง login, กัน path traversal ด้วย regex)
- LINE report กันส่งซ้ำด้วยตาราง `line_logs` unique (type, date) — ปุ่มทดสอบในหน้าตั้งค่าใช้ `force=1`

## Google Drive selfie sync (สำเนารูปเช็คอินขึ้น Drive)

- **ไฟล์:** `app/drive.php` (ท่อ Drive + คิว + OAuth handlers `h_gdrive_*`), `public/oauth.php` (OAuth callback — ไม่มี auth header พึ่ง `gdrive_oauth_state` ที่หมดอายุ 10 นาที กัน CSRF)
- **flow:** `h_checkin` เซฟรูปลง Volume แล้วเรียก `gdrive_enqueue()` (insert `drive_queue` + แตกโปรเซส worker `cron/drive.php` ผ่าน `gdrive_spawn_worker()` ไม่แตะ network) → เช็คอินตอบทันที → worker อัปโหลดเบื้องหลัง
- **retry:** `gdrive_process_queue()` อัปโหลดทีละ ≤3 รายการ, fail → `tries+1` (เพดาน 30 → status `error`); worker `cron/drive.php` มี `flock` กันรันซ้อน; `gdrive_kick_if_stale()` ใน `h_app_data`+`h_admin_data` แตก worker ไล่คิวค้างถ้าห่างรอบก่อน >60 วิ (throttle ด้วย `gdrive_last_run`)
- **⚠️ อย่ารัน curl คาใน request** — เดิมใช้ `after_response()` (helpers.php) ปิด connection ด้วย `Content-Length`+`Connection: close`+`fastcgi_finish_request()` แต่ **`fastcgi_finish_request()` ไม่มีบน Apache mod_php** (prod เป็น `php:8.3-apache` prefork) จึง**เลิกใช้ เปลี่ยนเป็นแตกโปรเซส CLI แยก** (`nohup php cron/drive.php &`) — ถ้า server ปิด `exec` → `gdrive_enqueue` fallback อัป inline สั้นๆ (`after_response` ยังอยู่ใน helpers แต่ไม่มีใครเรียกแล้ว)
- **scope `drive.file`** = แอปเห็นเฉพาะไฟล์/โฟลเดอร์ที่ตัวเองสร้าง → สร้างโฟลเดอร์ราก "รูปเช็คชื่อสถานีไฟป่า" เอง (id เก็บใน `gdrive_root_id`) แล้วให้พี่วินลากไปวางเอง — **เข้าถึงโฟลเดอร์ที่ผู้ใช้มีอยู่ก่อนไม่ได้** (ตั้งใจ แลกกับความปลอดภัย + ไม่ติด verification)
- **โฟลเดอร์รายวัน** ชื่อปี พ.ศ. `2569-mm-dd` (cache id วันละครั้งใน `gdrive_day_cache`); ชื่อไฟล์ `Hi_ชื่อจริง.jpg`
- **settings ที่เกี่ยว (ห้าม hardcode):** `gdrive_client_id`/`gdrive_client_secret` (แอดมินกรอก, อยู่ใน EDITABLE_SETTINGS), `gdrive_refresh_token`/`gdrive_access_token`/`gdrive_access_exp`/`gdrive_root_id`/`gdrive_day_cache`/`gdrive_oauth_state`/`gdrive_last_run` (ระบบเซ็ตเอง) — เหมือน LINE token ไม่อยู่ในโค้ด
- **OAuth setup:** แอดมินทำครั้งเดียวตามคู่มือ `SETUP_GDRIVE.md` — ต้อง Publish App + Enable Drive API มิฉะนั้นพัง (ดู PROGRESS lesson 7)

## Deploy

Railway + Dockerfile (ดูขั้นตอนละเอียดใน README.md) — env ที่ต้องมี: ตัวแปร MySQL (reference), `CRON_SECRET`, `UPLOAD_DIR=/data/uploads` + Volume ที่ `/data`

**⚠️ push GitHub ไม่ auto-deploy** — repo เป็น source control อย่างเดียว ไม่ได้ผูก webhook ต้อง deploy tarball เอง: `railway up` หรือ MCP `deploy` (`path=firecheck/`, service `8a5f15ef-d377-4437-80aa-b0fc0775d087`) ทุก deployment คอลัมน์ commit เป็น `-` เพราะเป็น tarball upload ไม่ใช่ GitHub-triggered — verify live ด้วย `curl https://sakpra-erawan.up.railway.app/index.php` ทุกครั้ง — ถ้า MCP `deploy`/`whoami` ค้าง `Unauthorized` (auth คนละชุดกับ CLI) ให้ใช้ `railway up` ตรงๆ ในเทอร์มินัลแทนได้เลย ไม่ต้อง re-login

**⚠️ Cache-bust ตอนแก้ frontend** — `sw.js` เก็บ `assets/*` แบบ cache-first PWA ที่ติดตั้งแล้วจะเห็นของเก่าถ้าไม่เด้ง version ต้องแก้ **พร้อมกัน 2 ที่**: `?v=N` ใน `index.php` (css+js) **และ** `const CACHE = 'firecheck-vN'` + ASSETS `?v=N` ใน `sw.js` (activate จะล้าง cache เก่าให้)

**Live:** https://sakpra-erawan.up.railway.app — Railway project "firecheck" (`0490e262-abfe-49c6-bd47-81cdd12ed7d1`), service `firecheck-app` + `MySQL` + Volume `/data` (domain renamed from the default `firecheck-app-production.up.railway.app` for staff usability; `firecheck.up.railway.app` was already taken by someone else)

**⚠️ Dockerfile CMD ห้ามย้าย `rm -f mpm_event.*` กลับไปเป็น build-time RUN** — เจอบั๊กจริงบน Railway: ไฟล์ที่ลบใน Docker build layer (RUN) ไม่ persist มาถึง container ตอนรันจริง (`mpm_event.load` กลับมาเป็นของ base image เดิมทุกครั้ง แม้ build log ยืนยันว่าลบสำเร็จ) ทำให้ Apache crash loop ด้วย `AH00534: More than one MPM loaded` ทางแก้ที่ใช้ได้จริงคือลบใน `CMD` (runtime, writable fs) เท่านั้น — ดู Dockerfile ปัจจุบัน

**⚠️ Volume ต้อง chown ให้ www-data ใน CMD (runtime)** — `/data/uploads` ตอน Volume mount เป็นของ root แต่ Apache รันเป็น www-data → `save_photo()` mkdir ไม่ได้ = Permission denied → selfie เซฟไม่ได้เลย ต้อง `mkdir -p "$UPLOAD_DIR" && chown -R www-data:www-data "$UPLOAD_DIR"` ใน `CMD` (runtime เพราะ Volume mount ตอน runtime เหมือนบั๊ก mpm) — ดู PROGRESS lesson 8

**⚠️ display_errors ต้อง Off บน prod** — base image เปิด display_errors → PHP warning ใดๆ ถูกพ่นหน้า JSON body → `res.json()` พังฝั่ง client = **"การเชื่อมต่อขัดข้อง"** (สัญญาณ: HTTP ยัง 200 แต่ content-type กลายเป็น `text/html` + body ขึ้นต้น `<br>`) ตั้ง `display_errors=Off`+`log_errors=On` ใน `firecheck.ini` (warning ไปลง Railway deploy log แทน) — ดู PROGRESS lesson 8

**⚠️ MySQL บน Railway เป็น UTC** — SQL `NOW()`/`CURRENT_TIMESTAMP` เก็บเวลา UTC → เวลาเช็คอินเพี้ยน -7 ชม. `db.php` ตั้ง `PDO::MYSQL_ATTR_INIT_COMMAND => "SET time_zone='+07:00'"` ทุกการเชื่อมต่อ (คอลัมน์เวลาเป็น DATETIME ล้วน ไม่มี TIMESTAMP → ตั้ง tz ไม่กระทบค่าที่เก็บไว้แล้ว มีผลเฉพาะ write ใหม่) — ดู PROGRESS lesson 9

## ห้าม commit

`credentials.json`, `token.pkl`, `*.env`, `config.env`, `*.csv` (อยู่ใน .gitignore แล้ว) — LINE token เก็บใน DB ผ่านหน้าตั้งค่า ไม่อยู่ในโค้ด
