# 🔥 FireCheck — ระบบเช็คชื่อเจ้าหน้าที่สถานีควบคุมไฟป่าสลักพระ-เอราวัณ

Web App (PWA) เช็คชื่อเข้างานด้วย GPS + จองวันหยุดล่วงหน้า + Dashboard หัวหน้าสถานี + LINE Bot สรุปเช้า/เย็น

**Stack:** PHP 8 + MySQL + Vanilla JS SPA (ไม่มี framework) — deploy บน Railway ด้วย Dockerfile

---

## ใช้งานยังไง (ภาพรวม)

| ใคร | ทำอะไร |
|---|---|
| เจ้าหน้าที่ | เปิดเว็บบนมือถือ → กดปุ่มเช็คชื่อ (ระบบเช็ค GPS ให้) → จบ |
| เจ้าหน้าที่ | จองวันหยุดล่วงหน้าในปฏิทิน (โควต้า 10 วัน/เดือน) หรือแจ้งลาป่วย/ลากิจ |
| หัวหน้าสถานี | เห็น dashboard เรียลไทม์: ใครมา/สาย/ลา/ขาด + กราฟ + อันดับความขยัน |
| LINE Bot | สรุปเข้ากลุ่มอัตโนมัติ เช้า 08:30 / เย็น 17:30 |

**กติกา:** ทุกคนมาทำงานทุกวัน ยกเว้นวันอาทิตย์ (วันหยุดสถานี) และวันที่จองหยุด/ลาไว้
ใครไม่เช็คชื่อ + ไม่แจ้งลา = ขาด

---

## 🚀 Deploy บน Railway (ครั้งแรก)

1. **Push โค้ดขึ้น GitHub** (repo นี้)
2. Railway → **New Project → Deploy from GitHub repo** → เลือก repo นี้
   (Railway เห็น `Dockerfile` แล้ว build เอง)
3. **เพิ่ม MySQL:** ในโปรเจคเดียวกัน กด **+ New → Database → MySQL**
4. **ผูก DB กับแอป:** ที่ service แอป → Variables → **Add Variable Reference** เลือกตัวแปรทั้งหมดของ MySQL (`MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`)
5. **ตั้งตัวแปรเพิ่ม 2 ตัว:**
   - `CRON_SECRET` = ตั้งรหัสยาวๆ เอง (ใช้ยิง cron จากภายนอก)
   - `UPLOAD_DIR` = `/data/uploads`
6. **เพิ่ม Volume เก็บรูป:** service แอป → Settings → Volumes → Mount path = `/data`
7. Deploy เสร็จ → เปิด URL → **ระบบสร้างตารางฐานข้อมูล + บัญชีแอดมินให้เองอัตโนมัติ**
8. Login: `admin` / `admin1234` → ⚠️ **เปลี่ยนรหัสผ่านทันที** ที่หน้า ตั้งค่า → ทั่วไป → เปลี่ยนรหัสผ่านแอดมิน

### ตั้งเวลา LINE Bot (เลือก 1 ใน 2 ทาง)

**ทาง A — Railway Cron (แนะนำ):**
สร้าง service ใหม่จาก repo เดิมอีก 2 ตัว → Settings → Cron Schedule (เวลาเป็น UTC):
- สรุปเช้า 08:30 ไทย → `30 1 * * *` → Custom Start Command: `php cron/report.php morning`
- สรุปเย็น 17:30 ไทย → `30 10 * * *` → Custom Start Command: `php cron/report.php evening`
(อย่าลืมผูกตัวแปร MySQL ให้ service พวกนี้ด้วย)

**ทาง B — cron-job.org (ฟรี ง่ายกว่า):**
ตั้ง 2 งานยิง URL:
- `https://<โดเมนแอป>/api.php?action=cron_report&type=morning&key=<CRON_SECRET>` เวลา 08:30
- `https://<โดเมนแอป>/api.php?action=cron_report&type=evening&key=<CRON_SECRET>` เวลา 17:30

### ตั้งค่า LINE Bot

1. สร้าง Messaging API channel ที่ [developers.line.biz](https://developers.line.biz)
2. เอา **Channel Access Token** มาใส่ในหน้า ตั้งค่า → LINE Bot
3. เชิญบอทเข้ากลุ่มสถานี แล้วเอา **Group ID** มาใส่ (ดูจาก webhook event หรือใช้บอทตัวเดิมที่เคยทำ)
4. กด "ทดสอบสรุปเช้า" ในหน้าตั้งค่า — ถ้าข้อความเข้ากลุ่ม = เสร็จ

---

## 🖥 รันในเครื่อง (dev)

```bash
mysql -uroot -e "CREATE DATABASE firecheck CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
php -S 127.0.0.1:8123 -t public
# เปิด http://127.0.0.1:8123  (ตารางสร้างเองอัตโนมัติ, login admin/admin1234)
```

ค่า DB local อ่านจาก env `DB_HOST/DB_USER/DB_PASS/DB_NAME` (default: 127.0.0.1/root/ว่าง/firecheck)

---

## 🗄 โครงสร้าง

```
├── Dockerfile            — deploy Railway (Apache + PHP 8.3)
├── schema.sql            — โครงตาราง + ค่าตั้งต้น (รันอัตโนมัติตอน request แรก)
├── public/
│   ├── index.php         — หน้าเว็บ (SPA shell)
│   ├── api.php           — API ทั้งหมด (?action=...)
│   ├── photo.php         — เสิร์ฟรูปจาก UPLOAD_DIR (ต้อง login)
│   ├── manifest.json/sw.js/icon-*.png — PWA
│   └── assets/app.css, app.js (เจ้าหน้าที่), admin.js (หัวหน้า)
├── app/
│   ├── config.php db.php auth.php helpers.php
│   └── handlers/  auth_handlers, attendance, dayoffs, admin, line
└── cron/report.php       — CLI สรุปเช้า/เย็น
```

**ตาราง:** `users`, `auth_tokens`, `attendance` (unique คน+วัน), `day_offs` (unique คน+วัน), `settings`, `line_logs` (กันส่งซ้ำ)

## 📏 กฎธุรกิจ

- เช็คอินเปิด 08:05 / หลัง 08:15 = สาย / ต้องอยู่ในรัศมี 1,000 ม. — **ทุกค่าแก้ได้ในหน้าตั้งค่า**
- วันอาทิตย์ = วันหยุดสถานี (ปิดได้ในตั้งค่า)
- โควต้าวันหยุด 10 วัน/เดือน — จองเกินได้แต่ระบบ flag ⚠️ แจ้งแอดมิน / ลาป่วย-ลากิจไม่นับโควต้า
- เจ้าหน้าที่จองวันหยุดล่วงหน้า-ยกเลิกเองได้ (เฉพาะวันในอนาคต) / แอดมินบันทึกย้อนหลังแทนได้
- คะแนนความขยัน: มา 60 + ตรงเวลา 40 ต่อวัน (ถ้าเปิดเช็คเอาท์ → มา30+ตรง30+รายงาน20+ตรงเวลา20) วันลาไม่ถูกหักคะแนน
- ฟีเจอร์ปิดสวิตช์ไว้ (เปิดได้ในตั้งค่า): เซลฟี่ตอนเช็คอิน, เช็คเอาท์+รายงานเย็น
- User flow: แอดมินเพิ่มชื่อ → เจ้าตัวลงทะเบียนตั้งรหัสผ่าน → แอดมินอนุมัติ → ใช้งาน
