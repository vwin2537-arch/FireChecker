# PROGRESS.md — FireCheck

## สถานะ: 🚀 Deploy ขึ้น Railway แล้ว — https://sakpra-erawan.up.railway.app

อัปเดตล่าสุด: 3 ก.ค. 2026 (แบบทดสอบเปลี่ยน flow เป็นเลือกคำตอบ → ย้อนกลับแก้ได้ → กดส่งคำตอบทีเดียวตอนข้อสุดท้าย — deploy ขึ้น Railway แล้ว, verify live แล้ว)

## ทำเสร็จแล้ว

- [x] **เฟส 1** โครงโปรเจค + schema (6 ตาราง) + login token + ลงทะเบียน/อนุมัติเจ้าหน้าที่ + auto-setup DB ตอน deploy
- [x] **เฟส 2** เช็คอิน GPS (Haversine + รัศมีตั้งค่าได้) + ตัดสาย + เซลฟี่/เช็คเอาท์แบบปิดสวิตช์รอ + หน้าเจ้าหน้าที่ (PWA มือถือ)
- [x] **เฟส 3** จองวันหยุดล่วงหน้า (ปฏิทินแตะเลือกหลายวัน) + ลาป่วย/ลากิจ + โควต้า 10 วัน/เดือน flag เกิน + แอดมินบันทึกลาแทนได้
- [x] **เฟส 4** Dashboard (KPI 4 ตัว, roster ชิปสี, กราฟ 14 วัน + รายสัปดาห์, ranking + engagement score 2 โหมด, activity feed, เตือนเกินโควต้า) + รายงานย้อนหลัง + export CSV + หน้าตั้งค่าครบทุกค่า
- [x] **เฟส 5** LINE Bot สรุปเช้า/เย็น (กันส่งซ้ำ, ปุ่มทดสอบ, รองรับ cron 2 ทาง) + Dockerfile Railway + README คู่มือ deploy
- [x] **โซนพัฒนาตัวเอง เฟส 1 — คลังความรู้** แอดมินเพิ่มลิงก์เอกสาร/สไลด์/ข่าว — จนท. เปิดดู + กดรับทราบ + badge แจ้งเตือนเอกสารใหม่
- [x] **โซนพัฒนาตัวเอง เฟส 2 — แบบทดสอบ** แอดมินสร้างชุดคำถามหลายตัวเลือก (4 ตัวเลือก) — จนท. ทำได้ไม่จำกัดครั้ง ตอบทีละข้อ เห็นคะแนนสรุปท้าย — แอดมินดูคะแนนสูงสุด/จำนวนครั้งของทุกคนต่อชุด (ยังไม่ผูกกับคลังความรู้, ยังไม่มี badge แจ้งเตือน — ตามที่ตกลงกันไว้)

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

## Deploy (3 ก.ค. 2026)

- [x] GitHub: push ขึ้น https://github.com/vwin2537-arch/FireChecker.git
- [x] Railway: project "firecheck" (id `0490e262-abfe-49c6-bd47-81cdd12ed7d1`) — service `firecheck-app` + `MySQL` + Volume `/data` + env (CRON_SECRET, UPLOAD_DIR, MySQL refs) ครบ → verify HTTP 200 จริงแล้ว → lesson 4
- [x] Railway CLI skill/MCP ติดตั้งให้ Claude Code แล้ว (`railway setup agent -y`) — deploy รอบต่อไปสั่งตรงได้เลย
- [x] **redeploy รอบ 2** (แก้ UI มือถือ S24 Ultra: ตัวกรองรายงานล้นจอ + เมนูล่างหายบน Samsung + cache bust `?v=2`) → verify asset ใหม่บนเว็บจริงแล้ว → lesson 5 — **รอพี่เทสเมนูล่างบนเครื่องจริง** (บั๊ก Samsung เช็ค headless ไม่ได้)
- [x] **redeploy รอบ 3** (แบบทดสอบ flow ใหม่ + cache bust `?v=5`, ครั้งแรกที่ฟีเจอร์แบบทดสอบขึ้น live) → verify HTTP 200 + asset ใหม่บนเว็บจริงแล้ว — Railway MCP ค้าง `Unauthorized` ตอน deploy รอบนี้ → ใช้ `railway up` (CLI) แทนได้เลย ไม่ต้อง re-login (CLI auth คนละชุดกับ MCP)

## รอทำต่อ (พี่วินต้องทำเอง / session หน้า)

- [ ] เปลี่ยนรหัส admin ทันทีหลัง deploy (ตั้งค่า → ทั่วไป) — login เริ่มต้น admin/admin1234
- [ ] แก้พิกัดสถานีจริงในหน้าตั้งค่า (ค่าตอนนี้เป็นพิกัดอุทยานเอราวัณจากระบบเก่า: 14.37462, 99.14541)
- [ ] ตั้ง LINE Bot (token + group id) + ตั้ง cron 08:30/17:30
- [ ] เพิ่มรายชื่อเจ้าหน้าที่จริง แล้วให้ทุกคนลงทะเบียน
- [ ] ใช้จริง 1-2 สัปดาห์แล้วค่อยตัดสินใจเปิดสวิตช์เซลฟี่/เช็คเอาท์
- [ ] เข้าไปสร้างชุดคำถามจริงในหน้าแอดมิน → พัฒนา → แบบทดสอบ (ตอนนี้ยังไม่มีชุดคำถามในระบบจริง — มีแค่ชุดทดสอบที่สร้างไว้ตอนเทส local)
- [ ] โซนพัฒนาตัวเอง เฟส 3 — กายภาพ (ยังไม่คุยรายละเอียด รอคุยแผนตอนถึงคิว)

## Lesson learned

- ระบบเดิม (GAS) ช้าเพราะสแกน Google Sheets ทั้งชีตทุก request + ส่งรูป base64 ผ่าน GAS → แก้ด้วย MySQL index + เก็บรูปใน Volume
- ตัดระบบ "แผน 30 วัน + อนุมัติ" ของเดิมทิ้ง เปลี่ยนเป็น "จองวันหยุด" (กลับด้าน) — เบากว่ามาก เพราะ จนท. ไฟป่ามาทุกวัน
- วันที่ +3 ในเทสอาจตรงวันอาทิตย์ — ระบบบล็อกถูกต้อง อย่าตกใจว่าเป็นบั๊ก
- **[4] Railway deploy gotchas** (ดู CLAUDE.md → Deploy section สำหรับรายละเอียดเทคนิค): (a) `railway add --database` เปลี่ยน linked service เป็น DB ทันที — ตาม `railway up` ทันทีเสี่ยง deploy โค้ดทับ DB service ต้องสร้าง app service แยกด้วย `railway add --service` แล้วระบุ `--service` ชัดเจนทุกคำสั่ง (b) `railway volume add --service <name>` panic ในเวอร์ชัน CLI นี้ ต้องใช้ ID จริงแทนชื่อ (c) ไฟล์ที่ลบใน Dockerfile RUN layer (build time) ไม่ persist มาถึง container ที่รันจริงบน Railway — ต้องลบตอน runtime (ใน CMD) แทน
- **[5] Deploy + mobile UI** (ดู CLAUDE.md → Deploy section): (a) โปรเจคนี้ **push GitHub ไม่ auto-deploy** — ต้อง deploy tarball เอง (`railway up` / MCP `deploy path=firecheck/ service=8a5f15ef-...`) ทุก deployment คอลัมน์ commit เป็น `-` เพราะเป็น tarball upload (b) SW เก็บ asset แบบ cache-first → แก้ `public/assets/*` ต้องเด้ง `?v=` ใน index.php **และ** ชื่อ CACHE ใน sw.js พร้อมกัน ไม่งั้นมือถือที่ติดตั้ง PWA แล้วเห็นของเก่า (c) `backdrop-filter:blur()` บน element `position:fixed` = บั๊ก repaint บน Samsung/S24 (หายตอนเลื่อน) — เลี่ยง, ใช้พื้นทึบ + `translateZ(0)` แทน (d) `<input type=date>` ใน grid `1fr` หดไม่ได้ ดันหน้าเกินจอ — ต้อง stack/min-width:0 บนจอแคบ
- **[6] `.tbl`/`.tbl-wrap` ใช้ใน Swal popup ไม่ได้** — คลาสนี้ออกแบบมาสำหรับตารางกว้างที่ bleed ขอบ `.card` (มี `min-width:560px` + negative margin `-18px` อิงกับ padding ของ `.card`) พอเอาไปใส่ใน `Swal.fire({html})` ซึ่งไม่มี padding บริบทเดียวกัน ตารางจะเพี้ยน/ตัดขาด (เจอตอนทำหน้าดูคะแนนแบบทดสอบ) — ถ้าต้องโชว์ตารางใน Swal ให้เขียน inline-style เองแยกจาก `.tbl` เดิม
