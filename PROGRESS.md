# PROGRESS.md — FireCheck

## สถานะ: 🚀 Deploy ขึ้น Railway แล้ว — https://sakpra-erawan.up.railway.app

อัปเดตล่าสุด: 4 ก.ค. 2026 — แก้บั๊กเช็คอิน iOS ค้าง (ถ่ายเซลฟี่ก่อน GPS → lesson 10) + ปฏิทินวันหยุดฝั่งแอดมิน (heatmap ทั้งเดือน + filter รายคน) → deploy v12. **กำลังเริ่มเฟส 2 ระบบอนุมัติลา** (requirement ล็อกแล้ว ดู "รอทำต่อ")

## ทำเสร็จแล้ว

- [x] **เฟส 1** โครงโปรเจค + schema (6 ตาราง) + login token + ลงทะเบียน/อนุมัติเจ้าหน้าที่ + auto-setup DB ตอน deploy
- [x] **เฟส 2** เช็คอิน GPS (Haversine + รัศมีตั้งค่าได้) + ตัดสาย + เซลฟี่/เช็คเอาท์แบบปิดสวิตช์รอ + หน้าเจ้าหน้าที่ (PWA มือถือ)
- [x] **เฟส 3** จองวันหยุดล่วงหน้า (ปฏิทินแตะเลือกหลายวัน) + ลาป่วย/ลากิจ + โควต้า 10 วัน/เดือน flag เกิน + แอดมินบันทึกลาแทนได้
- [x] **เฟส 4** Dashboard (KPI 4 ตัว, roster ชิปสี, กราฟ 14 วัน + รายสัปดาห์, ranking + engagement score 2 โหมด, activity feed, เตือนเกินโควต้า) + รายงานย้อนหลัง + export CSV + หน้าตั้งค่าครบทุกค่า
- [x] **เฟส 5** LINE Bot สรุปเช้า/เย็น (กันส่งซ้ำ, ปุ่มทดสอบ, รองรับ cron 2 ทาง) + Dockerfile Railway + README คู่มือ deploy
- [x] **โซนพัฒนาตัวเอง เฟส 1 — คลังความรู้** แอดมินเพิ่มลิงก์เอกสาร/สไลด์/ข่าว — จนท. เปิดดู + กดรับทราบ + badge แจ้งเตือนเอกสารใหม่
- [x] **โซนพัฒนาตัวเอง เฟส 2 — แบบทดสอบ** แอดมินสร้างชุดคำถามหลายตัวเลือก (4 ตัวเลือก) — จนท. ทำได้ไม่จำกัดครั้ง ตอบทีละข้อ เห็นคะแนนสรุปท้าย — แอดมินดูคะแนนสูงสุด/จำนวนครั้งของทุกคนต่อชุด (ยังไม่ผูกกับคลังความรู้, ยังไม่มี badge แจ้งเตือน — ตามที่ตกลงกันไว้)
- [x] **ปฏิทินวันหยุดฝั่งแอดมิน** (4 ก.ค. 2026) แท็บวันหยุดเป็นปฏิทิน grid ทั้งเดือน — ทุกคน: heatmap ไล่สีตามจำนวนคนหยุด / เลือกรายคน: สีตามประเภทลา (🟠ป่วย/🟣กิจ/🔵หยุด) แตะวันดูรายชื่อ+ลบ — reuse ปฏิทิน จนท. ไม่แตะ backend (`dayoff_month`)
- [x] **สำเนารูปเซลฟี่ขึ้น Google Drive** (4 ก.ค. 2026) เช็คอินสำเร็จทันทีไม่รอ Drive → คิว `drive_queue` อัปโหลดเบื้องหลังหลังส่ง response (retry จนสำเร็จ เพดาน 30 ครั้ง) → แยกโฟลเดอร์รายวัน ปี พ.ศ. (`2569-07-04`) ชื่อไฟล์ `เวลา_ชื่อ.jpg` — OAuth scope `drive.file` แอดมินเชื่อมเองครั้งเดียว (คู่มือ `SETUP_GDRIVE.md`) — ย่อรูปเซลฟี่เหลือ 1000px q0.6 ให้ไฟล์เล็ก + เปิดสวิตช์ `selfie_required` บน production แล้ว → lesson 7

## ทดสอบแล้ว (2 ก.ค. 2026, local: PHP 8.5 + MySQL 9.6)

- API ครบทุก endpoint ผ่าน curl: login/register/approve, checkin (ใกล้=ผ่าน, ไกล=บล็อก, ซ้ำ=บล็อก, ไม่มี GPS=บล็อก), จองวันหยุด (อาทิตย์/อดีต/ซ้ำ=บล็อก, เกินโควต้า=flag), settings, sec checks (401/403)
- E2E ผ่าน Playwright + Chrome จริง: login → เช็คอิน (mock GPS) → ปฏิทิน → dashboard — **0 console error** + screenshot ทุกหน้า
- Auto-setup: DB ว่าง → request แรกสร้างตาราง+แอดมินเอง ✓
- Palette กราฟผ่าน dataviz validator (CVD-safe)

## ทดสอบแล้ว — แบบทดสอบ (3 ก.ค. 2026, local: PHP 8.4 + MySQL 9.6)

- API ครบทุก endpoint ผ่าน curl: quiz_save (สร้าง/แก้ไข แทนที่คำถามทั้งชุด), quiz_get (ไม่หลุด correct_index ไปฝั่ง client), quiz_submit (คิดคะแนนถูกต้อง ทำซ้ำได้), quiz_admin_scores (คะแนนสูงสุด+จำนวนครั้งต่อคน), quiz_delete (ซ่อน/แสดง เก็บประวัติคะแนนไว้), validation (ตัวเลือกไม่ครบ 4 = fail)
- E2E ผ่าน Playwright: แอดมินสร้างชุดคำถาม 2 ข้อ → จนท. ทำ (ตอบทีละข้อ, tap-to-advance) → เห็นคะแนนสรุปท้าย 2/2 → แอดมินดูตารางคะแนน — **0 console/page error**
- เจอบั๊ก UI ระหว่างเทส: ตาราง `.tbl`/`.tbl-wrap` (มี min-width:560px + negative margin trick) ใช้ใน Swal popup ไม่ได้ ต้องทำตาราง inline-style แยกสำหรับ modal — แก้แล้ว ดู lesson learned
- **(3 ก.ค. 2026 รอบ 2)** เปลี่ยน flow เป็นเลือกคำตอบ→ไฮไลท์เขียวค้าง→ปุ่มย้อนกลับ/ถัดไปแก้คำตอบได้→ปุ่ม "ส่งคำตอบ" ที่ข้อสุดท้ายเท่านั้นถึงคิดคะแนน (เดิม tap-to-advance ทันที) — เทส E2E ผ่าน Playwright ครบ: ปุ่มถัดไป/ส่งคำตอบ disabled จนกว่าจะเลือก, ย้อนกลับแล้วคำตอบเดิมยังไฮไลท์, แก้คำตอบซ้ำได้ก่อนส่งจริง

## ทดสอบแล้ว — Google Drive selfie sync (4 ก.ค. 2026, local: PHP + MySQL)

- curl: checkin ไม่มี selfie เมื่อ `selfie_required=1` = fail / มี selfie = ผ่าน + คิวถูกสร้าง; checkin ตอบใน 0.01 วิ แม้ตั้ง gdrive creds ปลอม (พิสูจน์ว่าไม่ block เพราะ Drive) — คิว retry เพิ่ม tries ทุกรอบ kick ตอน error
- E2E Playwright: staff เช็คอินถ่ายเซลฟี่ผ่าน filechooser (ดัก `captureSelfie()`) → เช็คอินสำเร็จ → คิว drive_queue มี row + ไฟล์อยู่ Volume; การ์ด Drive ในหน้าตั้งค่าโชว์สถานะ/คิว/last_error ถูกต้อง; oauth.php state มั่ว = "ลิงก์หมดอายุ", endpoint ไม่มี token = 401
- **verified บน production แล้ว (4 ก.ค. 2026):** เช็คอินจริง → `gdrive_status` โชว์ `done:1, error:0` = รูปเซลฟี่อัปขึ้น Drive สำเร็จ (แต่ต้องแก้ Volume permission ก่อน selfie ถึงจะเซฟได้ → lesson 8)

## Deploy (3 ก.ค. 2026)

- [x] GitHub: push ขึ้น https://github.com/vwin2537-arch/FireChecker.git
- [x] Railway: project "firecheck" (id `0490e262-abfe-49c6-bd47-81cdd12ed7d1`) — service `firecheck-app` + `MySQL` + Volume `/data` + env (CRON_SECRET, UPLOAD_DIR, MySQL refs) ครบ → verify HTTP 200 จริงแล้ว → lesson 4
- [x] Railway CLI skill/MCP ติดตั้งให้ Claude Code แล้ว (`railway setup agent -y`) — deploy รอบต่อไปสั่งตรงได้เลย
- [x] **redeploy รอบ 2** (แก้ UI มือถือ S24 Ultra: ตัวกรองรายงานล้นจอ + เมนูล่างหายบน Samsung + cache bust `?v=2`) → verify asset ใหม่บนเว็บจริงแล้ว → lesson 5 — **รอพี่เทสเมนูล่างบนเครื่องจริง** (บั๊ก Samsung เช็ค headless ไม่ได้)
- [x] **redeploy รอบ 3** (แบบทดสอบ flow ใหม่ + cache bust `?v=5`, ครั้งแรกที่ฟีเจอร์แบบทดสอบขึ้น live) → verify HTTP 200 + asset ใหม่บนเว็บจริงแล้ว — Railway MCP ค้าง `Unauthorized` ตอน deploy รอบนี้ → ใช้ `railway up` (CLI) แทนได้เลย ไม่ต้อง re-login (CLI auth คนละชุดกับ MCP)
- [x] **redeploy รอบ 4** (Google Drive selfie sync + `?v=6`) → verify live: oauth.php ทำงาน, `gdrive_status connected=true` + `root_id` มีค่า (พี่วินเชื่อม Drive จริงสำเร็จ 4 ก.ค.), `selfie_required=1` บน production → lesson 7
- [x] **redeploy รอบ 5** (รื้อแดชบอร์ด: บล็อกวันนี้เป็นพระเอก + โดนัท `drawToday` + รายชื่อแยกกลุ่มตามสถานะ, ตัด `trend14`+`week_compare` ฝั่ง backend ทิ้ง = หน้าโหลดเร็วขึ้น (เลิกวน `roster_for` ~25 รอบ) + `?v=7`) → `railway up` (MCP ยัง Unauthorized ตามเดิม) → verify live: asset ใหม่เสิร์ฟจริง (`admin.js` มี `dash-today`/`drawToday`, ไม่มี `drawTrend` แล้ว; `app.css` มี `.dash-today`) — เทสในเครื่องด้วย Playwright + DB ทดสอบ seed 8 จนท. ครบทุกสถานะ ค่า render ตรง (5/7, 71%, กลุ่มเรียงถูก) 0 error
- [x] **redeploy รอบ 6** (4 ก.ค. 2026 — ปรับ flow ลงทะเบียน: แอดมินเพิ่มแค่ชื่อ-สกุล, เจ้าหน้าที่ตั้ง `username`+`password` เอง, `status=active` ทันทีไม่รออนุมัติ, popup ย้ำ user/pass ให้จด, ช่อง username ใส่ `autocapitalize=off` กันคีย์บอร์ดมือถือขึ้นตัวใหญ่ + `?v=8`) — **schema เปลี่ยน:** `users.username` เป็น nullable + guarded ALTER ใน `ensure_admin` (probe `information_schema.IS_NULLABLE` ก่อน ALTER, idempotent) migrate DB prod เดิมอัตโนมัติ → `railway up` (MCP ยัง Unauthorized) → **verify:** local E2E ผ่าน HTTP ครบ (user_add ไม่ส่ง username → register ตั้ง username → login ได้ทันที, username ซ้ำ/ตัวไทย = บล็อก) + migration test บน DB จำลอง prod เก่า (NOT NULL → flip nullable + insert NULL + register สำเร็จ) + live: index v8 เสิร์ฟจริง, `register_list` 200 JSON (ยืนยัน ALTER รันผ่านบน prod ไม่ crash, เจ้าหน้าที่ 16 คนรอลงทะเบียน) — เก่า user 16 คนมี username เดิมที่แอดมินตั้ง จะถูกทับตอนเจ้าตัว register

## รอทำต่อ (พี่วินต้องทำเอง / session หน้า)

- [ ] ⚠️ **เปลี่ยนรหัส admin อีกครั้ง** — รหัสเดิม `admin1234` เปลี่ยนไปแล้ว (login ไม่ผ่าน) แต่รหัสปัจจุบันพี่วินบอกมุกตอน debug 4 ก.ค. → ควรเปลี่ยนใหม่ (ตั้งค่า → 🔑)
- [ ] 🗑 ลบรูป dummy 1 ไฟล์ในโฟลเดอร์ Drive วันที่ 4 ก.ค. (ไฟล์เทสต์ตอน verify — ไม่ใช่รูปจริง)
- [ ] แก้พิกัดสถานีจริงในหน้าตั้งค่า (ค่าตอนนี้เป็นพิกัดอุทยานเอราวัณจากระบบเก่า: 14.37462, 99.14541)
- [ ] ตั้ง LINE Bot (token + group id) + ตั้ง cron 08:30/17:30
- [ ] เพิ่มรายชื่อเจ้าหน้าที่จริง แล้วให้ทุกคนลงทะเบียน
- [ ] ใช้จริง 1-2 สัปดาห์แล้วค่อยตัดสินใจเปิดสวิตช์เช็คเอาท์ (เซลฟี่เปิดแล้ว 4 ก.ค.)
- [ ] เข้าไปสร้างชุดคำถามจริงในหน้าแอดมิน → พัฒนา → แบบทดสอบ (ตอนนี้ยังไม่มีชุดคำถามในระบบจริง — มีแค่ชุดทดสอบที่สร้างไว้ตอนเทส local)
- [ ] โซนพัฒนาตัวเอง เฟส 3 — กายภาพ (ยังไม่คุยรายละเอียด รอคุยแผนตอนถึงคิว)

### เฟส 2 — ระบบอนุมัติลา (requirement ล็อก 4 ก.ค. 2026 — ยังไม่เริ่มโค้ด)
- ขอบเขต: อนุมัติเฉพาะ **ลาป่วย(sick) + ลากิจ(personal)** — `dayoff` (จองวันหยุดนับโควต้า) จองได้เลยเหมือนเดิม ไม่แตะ
- กติกา: ลากิจขอล่วงหน้า **≥2 วัน** / ลาป่วยกดได้ตลอด+ย้อนหลัง
- สถานะ: `pending` = ลาไปก่อน (นับ leave ใน roster ทันที) / reject = **ลบ row ทิ้ง** → กลับเป็นวันทำงาน (ขอใหม่วันเดิมได้ เลี่ยง UNIQUE) / auto-approve @ **00:00 ของวันก่อน off_date** (เลยแล้วแอดมินปฏิเสธไม่ได้)
- ลาป่วยวันนี้/ย้อนหลัง = เลย deadline → **อนุมัติทันที ปฏิเสธไม่ได้** แอดมินแค่รับรู้ (ลาป่วยล่วงหน้ายัง pending)
- schema: เพิ่มคอลัมน์ `status` ใน `day_offs` (dayoff default approved, sick/personal = pending)
- auto-approve: cron รอบเช้าที่มีอยู่ + lazy check ตอน render เป็น backstop (pending นับ leave อยู่แล้ว → auto แค่ล็อกไม่ให้ปฏิเสธ ไม่กระทบตาราง)
- แจ้งแอดมิน: badge ตัวเลขในแอป (ทันที) + **แนบในรายงาน LINE รอบเช้า** (ห้าม push ตอน submit — curl คาใน web request พังตาม lesson 7/8 ต้อง async)
- + หน้าอนุมัติฝั่งแอดมิน (list คำขอ pending + ปุ่มอนุมัติ/ปฏิเสธ) + roster ต้องเช็ค status (rejected ไม่นับลา)

## Lesson learned

- ระบบเดิม (GAS) ช้าเพราะสแกน Google Sheets ทั้งชีตทุก request + ส่งรูป base64 ผ่าน GAS → แก้ด้วย MySQL index + เก็บรูปใน Volume
- ตัดระบบ "แผน 30 วัน + อนุมัติ" ของเดิมทิ้ง เปลี่ยนเป็น "จองวันหยุด" (กลับด้าน) — เบากว่ามาก เพราะ จนท. ไฟป่ามาทุกวัน
- วันที่ +3 ในเทสอาจตรงวันอาทิตย์ — ระบบบล็อกถูกต้อง อย่าตกใจว่าเป็นบั๊ก
- **[4] Railway deploy gotchas** (ดู CLAUDE.md → Deploy section สำหรับรายละเอียดเทคนิค): (a) `railway add --database` เปลี่ยน linked service เป็น DB ทันที — ตาม `railway up` ทันทีเสี่ยง deploy โค้ดทับ DB service ต้องสร้าง app service แยกด้วย `railway add --service` แล้วระบุ `--service` ชัดเจนทุกคำสั่ง (b) `railway volume add --service <name>` panic ในเวอร์ชัน CLI นี้ ต้องใช้ ID จริงแทนชื่อ (c) ไฟล์ที่ลบใน Dockerfile RUN layer (build time) ไม่ persist มาถึง container ที่รันจริงบน Railway — ต้องลบตอน runtime (ใน CMD) แทน
- **[5] Deploy + mobile UI** (ดู CLAUDE.md → Deploy section): (a) โปรเจคนี้ **push GitHub ไม่ auto-deploy** — ต้อง deploy tarball เอง (`railway up` / MCP `deploy path=firecheck/ service=8a5f15ef-...`) ทุก deployment คอลัมน์ commit เป็น `-` เพราะเป็น tarball upload (b) SW เก็บ asset แบบ cache-first → แก้ `public/assets/*` ต้องเด้ง `?v=` ใน index.php **และ** ชื่อ CACHE ใน sw.js พร้อมกัน ไม่งั้นมือถือที่ติดตั้ง PWA แล้วเห็นของเก่า (c) `backdrop-filter:blur()` บน element `position:fixed` = บั๊ก repaint บน Samsung/S24 (หายตอนเลื่อน) — เลี่ยง, ใช้พื้นทึบ + `translateZ(0)` แทน (d) `<input type=date>` ใน grid `1fr` หดไม่ได้ ดันหน้าเกินจอ — ต้อง stack/min-width:0 บนจอแคบ
- **[6] `.tbl`/`.tbl-wrap` ใช้ใน Swal popup ไม่ได้** — คลาสนี้ออกแบบมาสำหรับตารางกว้างที่ bleed ขอบ `.card` (มี `min-width:560px` + negative margin `-18px` อิงกับ padding ของ `.card`) พอเอาไปใส่ใน `Swal.fire({html})` ซึ่งไม่มี padding บริบทเดียวกัน ตารางจะเพี้ยน/ตัดขาด (เจอตอนทำหน้าดูคะแนนแบบทดสอบ) — ถ้าต้องโชว์ตารางใน Swal ให้เขียน inline-style เองแยกจาก `.tbl` เดิม
- **[7] Google Drive selfie sync** (ดู CLAUDE.md → Google Drive section สำหรับรายละเอียดเทคนิค): (a) ใช้ OAuth scope `drive.file` (non-sensitive → ไม่ติดด่าน verification ของ Google) แต่แลกกับที่แอปเห็นเฉพาะไฟล์/โฟลเดอร์ที่ตัวเองสร้าง — เข้าถึงโฟลเดอร์ที่พี่วินมีอยู่แล้วไม่ได้ จึงสร้างโฟลเดอร์รากเองแล้วให้พี่วินลากไปวางในที่ที่ต้องการ (id ไม่เปลี่ยน) (b) งานช้าอย่าง upload อย่ารันคาใน request — ~~ใช้ `after_response()`~~ **(⚠️ 4 ก.ค. เลิกใช้ after_response แล้ว เพราะ `fastcgi_finish_request()` ไม่มีบน Apache mod_php → เปลี่ยนเป็นแตกโปรเซส worker `cron/drive.php` แยก ดู lesson 8)** (c) OAuth setup 3 กับดักที่พี่วินเจอจริงตอน onboard: ต้อง **Publish App** (ไม่งั้น "Access blocked" + refresh token หมดใน 7 วัน), ต้อง **Enable Google Drive API** ในโปรเจค (ไม่งั้น HTTP 403 ตอนสร้างโฟลเดอร์), Client Secret ช่องเป็น password พี่วินมองไม่เห็น → วางสลับ/ไม่ครบง่าย = "invalid client secret" — คู่มือครบใน `SETUP_GDRIVE.md`
- **[8] "การเชื่อมต่อขัดข้อง" ตอนเช็คชื่อ = PHP warning พ่นใส่ JSON** (ดู CLAUDE.md → Deploy gotchas): ต้นเหตุจริง `save_photo()` `mkdir()` บน Volume **Permission denied** (`/data/uploads` เป็นของ root, Apache = www-data) → selfie ไม่เคยเซฟลง prod ได้เลย + `display_errors` เปิดอยู่ → warning HTML ขึ้นหน้า JSON → `res.json()` พัง (HTTP ยัง 200, content-type flip เป็น text/html, body ขึ้นต้น `<br>`). แก้ 2 จุดใน Dockerfile: (a) CMD `chown www-data $UPLOAD_DIR` ตอน runtime (b) `display_errors=Off`+`log_errors=On`. **บทเรียน debug:** รอบแรกเดาผิดว่าเป็น `after_response`/mod_php แล้ว deploy ทั้งที่ยังไม่เห็น response ดิบ → เสีย 1 deploy; ต้อง**ดู raw response body ก่อนแก้เสมอ** (200+text/html+`<br>` = warning corruption)
- **[10] เช็คอิน iOS ค้าง = user-activation หมดตอนเปิดกล้อง** (ดู CLAUDE.md → Logic สำคัญ): iOS/WebKit บังคับ file-input `.click()` (เปิดกล้องเซลฟี่) ต้องอยู่ในจังหวะ transient user-activation ของการกดสด — เดิม `doCheckin` หา GPS ก่อน (await + permission dialog กิน activation) แล้วค่อย `captureSelfie()` → `.click()` no-op เงียบ ไม่มี timeout → ค้างตลอด ปุ่มค้าง disabled. **Chrome iOS เจอเหมือนกัน** (WebKit เดียวกัน ไม่ใช่บั๊ก Safari เฉพาะ). แก้: **สลับถ่ายเซลฟี่ก่อน GPS** (GPS grant แล้วไม่ต้อง activation + มี timeout 12s กันค้าง) + ห่อ try/finally ปลดล็อกปุ่มเสมอ. บทเรียน: อย่ามี `await` คั่นก่อน op ที่ต้อง user-activation (camera/getUserMedia/window.open)
- **[9] เวลาเช็คอินเพี้ยน -7 ชม. = MySQL บน Railway เป็น UTC** (ดู CLAUDE.md → Deploy gotchas): `time_in` เขียนด้วย SQL `NOW()` → เก็บ UTC แสดงดิบ. แก้ด้วย `SET time_zone='+07:00'` ตอนต่อ PDO (db.php) — คอลัมน์ DATETIME ล้วนไม่กระทบของเก่า, row ก่อนแก้ต้อง `+ INTERVAL 7 HOUR` เอง (ทำผ่าน `railway connect MySQL` สำหรับ row 4 ก.ค.)

## Deploy (4 ก.ค. 2026 — bugfix)

- [x] **redeploy รอบ 6-8** แก้ lesson 8+9: (6) worker Drive แทน after_response, (7) Volume chown + display_errors=Off → verify prod: checkin ตอบ JSON สะอาด (content-type application/json, ok=true) + `gdrive_status done:1`, (8) timezone +07:00 → verify row ใหม่เวลาถูก — ทุกรอบ `railway up` (MCP ยัง Unauthorized) + commit+push `main` (`2a49de6`)
- [x] **redeploy รอบ 9 (v10)** แก้บั๊กเช็คอิน iOS ค้าง → ถ่ายเซลฟี่ก่อนหา GPS + surface error.code → lesson 10 — verify: พี่วินเทส iPhone จริง ถ่ายรูป+เช็คชื่อผ่าน (commit `f3e51a5`)
- [x] **redeploy รอบ 10-11 (v11-12)** ปฏิทินวันหยุดแอดมิน heatmap + filter รายคน — verify logic ใน node + พี่วินดูจริงผ่านทั้ง 2 โหมด (commit `df674c4`) — `railway up` ทุกรอบ
