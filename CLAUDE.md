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

## Deploy

Railway + Dockerfile (ดูขั้นตอนละเอียดใน README.md) — env ที่ต้องมี: ตัวแปร MySQL (reference), `CRON_SECRET`, `UPLOAD_DIR=/data/uploads` + Volume ที่ `/data`

## ห้าม commit

`credentials.json`, `token.pkl`, `*.env`, `config.env`, `*.csv` (อยู่ใน .gitignore แล้ว) — LINE token เก็บใน DB ผ่านหน้าตั้งค่า ไม่อยู่ในโค้ด
