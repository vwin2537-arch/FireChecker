# PROGRESS.md — FireCheck

## สถานะ: 🚀 Deploy ขึ้น Railway แล้ว — https://sakpra-erawan.up.railway.app

อัปเดตล่าสุด: 5 ก.ค. 2026 — **เฟส 2 ระบบอนุมัติลา เสร็จ + deploy (v15)**: อนุมัติ/ปฏิเสธลาป่วย-ลากิจ, auto-approve @ deadline, LINE เด้ง async ตอนยื่น/ยกเลิก/อนุมัติ, บังคับ note, ป๊อบอัพวันหยุดสวยขึ้น (ดูรายละเอียดใต้ "เฟส 2"). รายละเอียด technical → CLAUDE.md "ระบบอนุมัติลา". (test log เก่า 2-4 ก.ค. ย้ายไป PROGRESS_ARCHIVE.md)

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

> test log เก่า (2-4 ก.ค.: API/checkin, แบบทดสอบ, Google Drive sync) ย้ายไป **PROGRESS_ARCHIVE.md**

## Deploy (3 ก.ค. 2026)

- [x] GitHub: push ขึ้น https://github.com/vwin2537-arch/FireChecker.git
- [x] Railway: project "firecheck" (id `0490e262-abfe-49c6-bd47-81cdd12ed7d1`) — service `firecheck-app` + `MySQL` + Volume `/data` + env (CRON_SECRET, UPLOAD_DIR, MySQL refs) ครบ → verify HTTP 200 จริงแล้ว → lesson 4
- [x] Railway CLI skill/MCP ติดตั้งให้ Claude Code แล้ว (`railway setup agent -y`) — deploy รอบต่อไปสั่งตรงได้เลย
- [x] **redeploy รอบ 2** (แก้ UI มือถือ S24 Ultra: ตัวกรองรายงานล้นจอ + เมนูล่างหายบน Samsung + cache bust `?v=2`) → verify asset ใหม่บนเว็บจริงแล้ว → lesson 5 — **รอพี่เทสเมนูล่างบนเครื่องจริง** (บั๊ก Samsung เช็ค headless ไม่ได้)
- [x] **redeploy รอบ 3** (แบบทดสอบ flow ใหม่ + cache bust `?v=5`, ครั้งแรกที่ฟีเจอร์แบบทดสอบขึ้น live) → verify HTTP 200 + asset ใหม่บนเว็บจริงแล้ว — Railway MCP ค้าง `Unauthorized` ตอน deploy รอบนี้ → ใช้ `railway up` (CLI) แทนได้เลย ไม่ต้อง re-login (CLI auth คนละชุดกับ MCP)
- [x] **redeploy รอบ 4** (Google Drive selfie sync + `?v=6`) → verify live: oauth.php ทำงาน, `gdrive_status connected=true` + `root_id` มีค่า (พี่วินเชื่อม Drive จริงสำเร็จ 4 ก.ค.), `selfie_required=1` บน production → lesson 7
- [x] **redeploy รอบ 5** (รื้อแดชบอร์ด: บล็อกวันนี้เป็นพระเอก + โดนัท `drawToday` + รายชื่อแยกกลุ่มตามสถานะ, ตัด `trend14`+`week_compare` ฝั่ง backend ทิ้ง = หน้าโหลดเร็วขึ้น (เลิกวน `roster_for` ~25 รอบ) + `?v=7`) → `railway up` (MCP ยัง Unauthorized ตามเดิม) → verify live: asset ใหม่เสิร์ฟจริง (`admin.js` มี `dash-today`/`drawToday`, ไม่มี `drawTrend` แล้ว; `app.css` มี `.dash-today`) — เทสในเครื่องด้วย Playwright + DB ทดสอบ seed 8 จนท. ครบทุกสถานะ ค่า render ตรง (5/7, 71%, กลุ่มเรียงถูก) 0 error
- [x] **redeploy รอบ 6** (4 ก.ค. 2026 — ปรับ flow ลงทะเบียน: แอดมินเพิ่มแค่ชื่อ-สกุล, เจ้าหน้าที่ตั้ง `username`+`password` เอง, `status=active` ทันทีไม่รออนุมัติ, popup ย้ำ user/pass ให้จด, ช่อง username ใส่ `autocapitalize=off` กันคีย์บอร์ดมือถือขึ้นตัวใหญ่ + `?v=8`) — **schema เปลี่ยน:** `users.username` เป็น nullable + guarded ALTER ใน `ensure_admin` (probe `information_schema.IS_NULLABLE` ก่อน ALTER, idempotent) migrate DB prod เดิมอัตโนมัติ → `railway up` (MCP ยัง Unauthorized) → **verify:** local E2E ผ่าน HTTP ครบ (user_add ไม่ส่ง username → register ตั้ง username → login ได้ทันที, username ซ้ำ/ตัวไทย = บล็อก) + migration test บน DB จำลอง prod เก่า (NOT NULL → flip nullable + insert NULL + register สำเร็จ) + live: index v8 เสิร์ฟจริง, `register_list` 200 JSON (ยืนยัน ALTER รันผ่านบน prod ไม่ crash, เจ้าหน้าที่ 16 คนรอลงทะเบียน) — เก่า user 16 คนมี username เดิมที่แอดมินตั้ง จะถูกทับตอนเจ้าตัว register

## ทดสอบแล้ว — เฟส 2 ระบบอนุมัติลา (4 ก.ค. 2026, local: PHP 8.5 + MySQL 9.6) → **deploy แล้ว (v13)**

- **deploy รอบ 12 (v13) สำเร็จ 4 ก.ค. 2026** — `railway up --detach` → verify live: v13 เสิร์ฟจริง, `register_list` 200 JSON = **migration `day_offs.status` ALTER + สร้าง `line_queue` รันบน prod DB จริงไม่ crash**, `leave_approve`/`leave_pending` ไม่มี token → auth guard เด้งถูก (route ใหม่ wired) — commit `d5752ac`
- แอดมินบันทึกลาแทน = อนุมัติทันทีทุกกรณี (ตามที่พี่วินสั่ง 4 ก.ค.) / เจ้าหน้าที่ยื่นเอง = ตามกฎ deadline
- Logic เส้นแบ่งอนุมัติ (นิยามครั้งเดียวใน `dayoffs.php`: `leave_still_pending()`/`leave_lock_cutoff()` = off_date ≥ วันนี้+2): ลากิจ T+2 = pending / ลากิจ <2วัน (staff) = บล็อก / ลาป่วยวันนี้+ย้อนหลัง = approved ทันที / ลาป่วยล่วงหน้า ≥2วัน = pending / ลาป่วย T+1 (edge) = approved ตามกฎ "00:00 วันก่อนลา" / dayoff = approved เสมอ — **27/27 pass** (harness `dayoff_insert` + `leave_initial_status` + `leave_auto_approve`)
- auto-approve flip: pending off_date T+1 → approved, T+2 → คง pending ✓ (รันใน `run_line_report` ก่อน Sunday-skip + `h_admin_data` backstop + ต้นทาง approve/reject handlers)
- **Migration prod (จุดเสี่ยงเหมือน lesson username):** เทสบน DB จำลอง schema เก่า (day_offs ไม่มี `status`, ไม่มี `line_queue`) → `ensure_admin` ALTER เพิ่ม `status` (guarded probe information_schema) + backfill row เก่า = approved + สร้าง `line_queue` + รันซ้ำ idempotent ✓
- HTTP e2e (php -S, display_errors=0 เหมือน prod): admin เพิ่มลากิจ T+2 → pending → `leave_pending` เห็น → `leave_approve` = approved + **row เข้า `line_queue`** (async ไม่ push คาใน request, response กลับ <10ms) → `leave_reject` = ลบ row → `admin_data.pending_leaves` นับถูก → **LINE report เช้ามีส่วน "⏳ รออนุมัติลา"** ✓
- **Playwright + Chrome จริง (headless): ALL PASS + 0 console error** — staff เห็น tag "⏳ รออนุมัติ" / admin แดชบอร์ดมีแถบเตือน + แท็บวันหยุดมีการ์ดคำขอ → คลิกอนุมัติ การ์ดอัปเดตเหลือ (1) → คลิกปฏิเสธ Swal ยืนยัน การ์ดหาย (กัน frontend-bug hotspot ตาม lesson 5/6/10)
- ⚠️ local PHP 8.5 เตือน `PDO::MYSQL_ATTR_INIT_COMMAND` deprecated (prod PHP 8.3 ไม่เจอ) — display_errors=Off บน prod ซับไว้อยู่แล้ว ไม่กระทบ แต่ถ้าอนาคตอัป PHP 8.5 ควรเปลี่ยนเป็น `Pdo\Mysql::ATTR_INIT_COMMAND`

## เฟส 2 — ปรับหลัง feedback พี่วิน (5 ก.ค. 2026)

- **หน้าวันหยุด จนท. โฟกัสของตัวเอง (v14):** ปฏิทินตัด badge นับทีม ("หยุด N") เหลือแค่ไฮไลต์วันตัวเอง / ตัดการ์ด "ใครหยุดบ้าง" / "วันหยุดของฉัน" ผูกเดือนที่ดูอยู่ (เปลี่ยนเดือน→ตาม) วันอดีต read-only — Playwright ผ่าน 0 error (commit `5e2e6bb`)
- **LINE เด้งทันทีตอน จนท. ยื่นลาป่วย/ลากิจ (async ผ่าน line_queue):** หัวหน้ารู้ทันทีไม่ต้องรอรายงานเช้า/เย็น — วันหยุด(dayoff) เงียบ, admin บันทึกแทนเงียบ — verify: personal/sick → enqueue ข้อความครบ / dayoff → ไม่ enqueue (commit `74c3fab`, deploy แล้ว)
- **สอบสวน "ปฏิเสธลาทั้งหมด" (พี่วินรายงาน) = ไม่ใช่บั๊ก** — reproduce แล้ว reject ลบเฉพาะ id ที่กด (backend+UI+DB ตรงกัน). ดู prod DB จริง (พี่วินอนุมัติ read-only): day_offs id 1-7 อยู่ครบไม่มีลบ, ทุกแถว approved (เพ็ญนภา 5 รายการสร้างก่อน deploy เฟส 2 → backfill approved / วรุณ sick → auto-approved ตอนข้ามวัน), line_queue ว่าง = ไม่เคยกดอนุมัติสำเร็จ → **ภาพ "ปฏิเสธหมด" คือการ์ด pending ว่างเพราะ auto-approve ย้ายออก ไม่ใช่การลบ** — บทเรียน: auto-approve ทำให้คำขอหลุดจากการ์ดเงียบๆ ทดสอบต้องใช้คำขอใหม่ off_date ≥ วันนี้+2

## เฟส 2 — รอบเสริม feedback พี่วิน (5 ก.ค. 2026, v15 deploy แล้ว)

- **บังคับหมายเหตุเมื่อลาป่วย/ลากิจ** — backend reject note ว่าง (dayoff ไม่บังคับ) + ฟอร์ม จนท. label ขึ้น "เหตุผลการลา *" + placeholder + กันฝั่ง client ก่อนส่ง
- **แจ้ง LINE ตอนยกเลิกลา** — `dayoff_cancel` enqueue ❌ สำหรับลาป่วย/ลากิจ (dayoff เงียบ)
- **ป๊อบอัพวันหยุดสวยขึ้น (ฝั่ง จนท.)** — ยื่นสำเร็จ = การ์ดโชว์ประเภท/จำนวนวัน + "🔔 แจ้งหัวหน้าทาง LINE แล้ว" + รออนุมัติ / ยกเลิก = confirm เตือนว่าจะแจ้ง LINE + toast ยืนยัน (ฝั่งแอดมินคง toast มุมบนแบบไม่บล็อก เหมาะกดหลายรายการ)
- verify: backend 4 เคส (note บังคับ/ไม่บังคับ + cancel enqueue) + Playwright 3 ชุด ALL PASS 0 error (note UX, ฟลว์ยื่น→ป๊อบอัพ→ยกเลิก, admin approve/reject regression) — commit `01eecc1`+`c1b6fe4`

## รอทำต่อ (พี่วินต้องทำเอง / session หน้า)

- [ ] ⚠️ **เปลี่ยนรหัส admin อีกครั้ง** — รหัสเดิม `admin1234` เปลี่ยนไปแล้ว (login ไม่ผ่าน) แต่รหัสปัจจุบันพี่วินบอกมุกตอน debug 4 ก.ค. → ควรเปลี่ยนใหม่ (ตั้งค่า → 🔑)
- [ ] 🗑 ลบรูป dummy 1 ไฟล์ในโฟลเดอร์ Drive วันที่ 4 ก.ค. (ไฟล์เทสต์ตอน verify — ไม่ใช่รูปจริง)
- [ ] แก้พิกัดสถานีจริงในหน้าตั้งค่า (ค่าตอนนี้เป็นพิกัดอุทยานเอราวัณจากระบบเก่า: 14.37462, 99.14541)
- [x] **LINE Bot เชื่อมแล้ว + cron ตั้งแล้ว** (4 ก.ค. 2026) — `line_token`+`line_group_id` set ใน prod DB ผ่าน `railway connect` (ไม่อยู่ในโค้ด) + ทดสอบเด้งเข้ากลุ่มจริง; **cron = Google Apps Script** ยิง `cron_report` endpoint (GET) เช้า 08:30/เย็น 17:30 — GAS time-trigger, ตั้ง project tz = Bangkok, `force=1` เฉพาะตอนทดสอบ (prod ไม่ force เพราะ `line_logs` กันส่งซ้ำ) — เลือก GAS เพราะ Railway MCP prod auth ใช้ไม่ได้ + ฟรี/reliable
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
- แจ้งแอดมิน: badge ตัวเลขในแอป (ทันที) + **แนบคำขอ pending ในรายงาน LINE ทั้งรอบเช้า+เย็น** (ห้าม push ตอน submit — curl คาใน web request พังตาม lesson 7/8 ต้อง async → รายงานเช้า/เย็นรันจาก cron CLI อยู่แล้ว ปลอดภัย)
- **(เพิ่ม 4 ก.ค.) Bot แจ้งเข้ากลุ่ม LINE ตอนแอดมิน approve คำขอ** — ต้องผ่าน pattern async (enqueue/spawn worker เหมือน Drive) ไม่ push คาใน request อนุมัติ
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
- **[11] "ปฏิเสธลาทั้งหมด" = false alarm ไม่ใช่บั๊ก** (5 ก.ค.): reproduce แล้ว reject ลบเฉพาะ id ที่กด + ดู prod DB จริง (id ครบไม่หาย, ทุกแถว approved, line_queue ว่าง). ต้นเหตุ = `leave_auto_approve()` ย้ายคำขอที่เลย deadline (หรือ backfill ข้อมูลเก่า) ออกจากการ์ด pending เงียบๆ → พอกดปฏิเสธอันสุดท้าย การ์ดว่าง = ดูเหมือนปฏิเสธหมด. **ทดสอบระบบลาต้องใช้คำขอใหม่ off_date ≥ วันนี้+2 (ยัง pending จริง)**
- **[12] เทส local timezone/PHP 8.5** (5 ก.ค.): (a) bash `php -r date()` ไม่ตั้ง TZ = system TZ ≠ server (`Asia/Bangkok`) วันคลาด 1 วัน → "+2" กลายเป็น "+1" ถูกบล็อก; ใส่ `date_default_timezone_set('Asia/Bangkok')` ในสคริปต์เทสวันที่เสมอ (b) local PHP 8.5 เตือน `PDO::MYSQL_ATTR_INIT_COMMAND` deprecated + display_errors ON → warning ปน JSON (lesson 8 ซ้ำ); เทสต้องรัน `php -d display_errors=0` (prod 8.3 + firecheck.ini ปิดอยู่แล้ว ไม่กระทบ)

## Deploy (4 ก.ค. 2026 — bugfix)

- [x] **redeploy รอบ 6-8** แก้ lesson 8+9: (6) worker Drive แทน after_response, (7) Volume chown + display_errors=Off → verify prod: checkin ตอบ JSON สะอาด (content-type application/json, ok=true) + `gdrive_status done:1`, (8) timezone +07:00 → verify row ใหม่เวลาถูก — ทุกรอบ `railway up` (MCP ยัง Unauthorized) + commit+push `main` (`2a49de6`)
- [x] **redeploy รอบ 9 (v10)** แก้บั๊กเช็คอิน iOS ค้าง → ถ่ายเซลฟี่ก่อนหา GPS + surface error.code → lesson 10 — verify: พี่วินเทส iPhone จริง ถ่ายรูป+เช็คชื่อผ่าน (commit `f3e51a5`)
- [x] **redeploy รอบ 10-11 (v11-12)** ปฏิทินวันหยุดแอดมิน heatmap + filter รายคน — verify logic ใน node + พี่วินดูจริงผ่านทั้ง 2 โหมด (commit `df674c4`) — `railway up` ทุกรอบ
