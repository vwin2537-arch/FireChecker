# PROGRESS_ARCHIVE.md — FireCheck (test logs เก่า)

เก็บ test log รายละเอียดของฟีเจอร์ที่ ship ไปแล้ว ย้ายออกจาก PROGRESS.md เพื่อคุมความยาว

## ทดสอบแล้ว (2 ก.ค. 2026, local: PHP 8.5 + MySQL 9.6)

- API ครบทุก endpoint ผ่าน curl: login/register/approve, checkin (ใกล้=ผ่าน, ไกล=บล็อก, ซ้ำ=บล็อก, ไม่มี GPS=บล็อก), จองวันหยุด (อาทิตย์/อดีต/ซ้ำ=บล็อก, เกินโควต้า=flag), settings, sec checks (401/403)
- E2E ผ่าน Playwright + Chrome จริง: login → เช็คอิน (mock GPS) → ปฏิทิน → dashboard — **0 console error** + screenshot ทุกหน้า
- Auto-setup: DB ว่าง → request แรกสร้างตาราง+แอดมินเอง ✓
- Palette กราฟผ่าน dataviz validator (CVD-safe)

## ทดสอบแล้ว — แบบทดสอบ (3 ก.ค. 2026, local: PHP 8.4 + MySQL 9.6)

- API ครบทุก endpoint ผ่าน curl: quiz_save (สร้าง/แก้ไข แทนที่คำถามทั้งชุด), quiz_get (ไม่หลุด correct_index ไปฝั่ง client), quiz_submit (คิดคะแนนถูกต้อง ทำซ้ำได้), quiz_admin_scores (คะแนนสูงสุด+จำนวนครั้งต่อคน), quiz_delete (ซ่อน/แสดง เก็บประวัติคะแนนไว้), validation (ตัวเลือกไม่ครบ 4 = fail)
- E2E ผ่าน Playwright: แอดมินสร้างชุดคำถาม 2 ข้อ → จนท. ทำ (ตอบทีละข้อ, tap-to-advance) → เห็นคะแนนสรุปท้าย 2/2 → แอดมินดูตารางคะแนน — **0 console/page error**
- เจอบั๊ก UI ระหว่างเทส: ตาราง `.tbl`/`.tbl-wrap` (มี min-width:560px + negative margin trick) ใช้ใน Swal popup ไม่ได้ ต้องทำตาราง inline-style แยกสำหรับ modal — แก้แล้ว ดู lesson 6
- **(3 ก.ค. 2026 รอบ 2)** เปลี่ยน flow เป็นเลือกคำตอบ→ไฮไลท์เขียวค้าง→ปุ่มย้อนกลับ/ถัดไปแก้คำตอบได้→ปุ่ม "ส่งคำตอบ" ที่ข้อสุดท้ายเท่านั้นถึงคิดคะแนน (เดิม tap-to-advance ทันที) — เทส E2E ผ่าน Playwright ครบ

## ทดสอบแล้ว — Google Drive selfie sync (4 ก.ค. 2026, local: PHP + MySQL)

- curl: checkin ไม่มี selfie เมื่อ `selfie_required=1` = fail / มี selfie = ผ่าน + คิวถูกสร้าง; checkin ตอบใน 0.01 วิ แม้ตั้ง gdrive creds ปลอม (พิสูจน์ว่าไม่ block เพราะ Drive) — คิว retry เพิ่ม tries ทุกรอบ kick ตอน error
- E2E Playwright: staff เช็คอินถ่ายเซลฟี่ผ่าน filechooser (ดัก `captureSelfie()`) → เช็คอินสำเร็จ → คิว drive_queue มี row + ไฟล์อยู่ Volume; การ์ด Drive ในหน้าตั้งค่าโชว์สถานะ/คิว/last_error ถูกต้อง; oauth.php state มั่ว = "ลิงก์หมดอายุ", endpoint ไม่มี token = 401
- **verified บน production แล้ว (4 ก.ค. 2026):** เช็คอินจริง → `gdrive_status` โชว์ `done:1, error:0` = รูปเซลฟี่อัปขึ้น Drive สำเร็จ (แต่ต้องแก้ Volume permission ก่อน selfie ถึงจะเซฟได้ → lesson 8)

---

# ย้ายมาจาก PROGRESS.md (26 ส.ค. 2026 — คุมความยาว)

## โหมดเช็คชื่อนอกสถานที่ (8 ก.ค. 2026, v25, commit `b3a6954`)

แอดมินตั้งวันล่วงหน้าที่สั่ง จนท.ไปกิจกรรมนอกสถานี (อบรม/ประชุมนอกพื้นที่) → วันนั้นทุกคนเช็คชื่อจากที่ไหนก็ได้ (ข้าม GPS พิกัดประจำ) เช็คในช่วงเวลาที่ตั้ง = ไม่นับสาย. ตารางใหม่ `offsite_days` + การ์ดจัดการในหน้าตั้งค่าแอดมิน + banner ฝั่ง จนท. **Technical → CLAUDE.md "โหมดเช็คชื่อนอกสถานที่"**.

**Verify:** Backend E2E ผ่าน HTTP **14/14** (เช็คนอกรัศมี 161km ได้ / late จาก end_time / revert ลบวัน→GPS block กลับมา) + **UI browser (Playwright+Chromium) 9/9** (การ์ดแอดมิน add/del ผ่าน UI จริง + banner+ปุ่มเจ้าหน้าที่ render จริง) + live: migration+route+auth guard ผ่าน. ⚠️ prod เต็มเทสไม่ได้ (รหัสแอดมินเปลี่ยน) — พี่วินลอง: ตั้งค่า → การ์ด "📍 วันเช็คชื่อนอกสถานที่" → เพิ่มวัน. **commit `b3a6954` อยู่ local main ยังไม่ push (auto-mode บล็อก — พี่วิน push เอง).**

> lesson นี้: บั๊ก UI ที่ hard-refresh แล้วไม่หาย = โค้ดค้าง/ซ้ำ 2 ที่ ไม่ใช่ cache (`devSegHtml` มีทั้ง app.js+admin.js) · verify UI ต้อง **render จริง** (Playwright) ไม่ใช่แค่ grep/`node --check` — grep เจอโค้ด ≠ หน้าจอทำงาน

## เฟส 6 — เวรกลางคืน + เวรวันอาทิตย์ + เพศ (7 ก.ค. 2026, v18)

**ปัญหาที่แก้ (พี่วิน):** (1) เวรกลางคืนสลับกันเอง จำไม่ได้ อยากทำสถิติ (2) คนอยู่เวรกลางคืนเช้าถัดมามา 10 โมง เลยติดสาย (3) วันอาทิตย์เช็คชื่อไม่ได้เลย แต่มีคนมาทำงาน/ชดเชย

**Requirement ที่สรุปกับพี่วิน (ถามล้อม 6 ข้อ):** เวรกลางคืน = บันทึกคนมาจริงพอ (ไม่กรอกคำสั่งล่วงหน้า), ลงเวรเอง กดตอนเย็น (≥18:00) + เซลฟี่/GPS, เฉพาะชาย (กรองด้วย field เพศ), วันที่อยู่เวรกลางวันทำงานปกติ (ระบบไม่แตะ), เช้าถัดมาเช็คปกติแต่ไม่นับสาย, วันอาทิตย์ = แยกจากเวรกลางคืน reuse `attendance` เปิดเช็คได้ทั้งชาย/หญิงหลายคน, ชดเชยวันอาทิตย์ = แค่บันทึก note (ยังไม่หักโควต้า)

**ที่ทำ:**
- **ตารางใหม่ `night_shifts`** (`user_id, duty_date, time_in, lat/lng/distance_m, selfie_path`, UNIQUE user+duty_date) — แยกจาก `attendance` เพราะ attendance ผูก UNIQUE วันละครั้ง + semantic เช้า
- **คอลัมน์ใหม่:** `users.gender ENUM('male','female') NULL` (กรองเวรกลางคืน), `attendance.note VARCHAR(255)` (หมายเหตุงานวันอาทิตย์)
- **3 settings ใหม่:** `night_shift_enabled`(1), `night_checkin_open`(18:00), `sunday_work_enabled`(1) — สวิตช์+เวลาในหน้าตั้งค่า
- **`h_night_checkin`** — เช็คเพศชาย + สวิตช์ + เวลา≥night_checkin_open + กันซ้ำ + GPS/เซลฟี่ reuse (`distance_m`/`save_photo`/`gdrive_enqueue`). `duty_date` = วันนี้ ถ้ากดก่อน 06:00 = เมื่อวาน (กัน off-by-one หลังเที่ยงคืน) → `tonight_duty_date()`
- **ยกเว้นสายเช้าถัดมา** ใน `h_checkin`: ถ้า late และมี night_shift `duty_date = เมื่อวาน` → late=0 + `exempted=true` (รวมกรณีคืนวันอาทิตย์)
- **ปลดล็อกวันอาทิตย์** ใน `h_checkin`: is_holiday + `sunday_work_enabled` → เช็คได้ (ข้ามเวลาเปิด + บังคับ late=0) + รับ `note`
- **Dashboard วันหยุด** (`h_admin_data`): เดิม roster ว่างวันอาทิตย์ → เพิ่ม `holiday_workers` (คนที่เช็คชื่อวันหยุด) + `night_stats` (จำนวนคืน/คนเดือนนี้). รายงานย้อนหลัง (`report_range`) + `my_history` แนบ night_shifts + CSV
- **Frontend:** ปุ่ม "🌙 ลงเวรกลางคืน" หน้า Home (เฉพาะชาย+เปิดสวิตช์, gate เวลา, `doNightCheckin` ลำดับเซลฟี่→GPS ตาม iOS lesson 10) / วันอาทิตย์โชว์ปุ่มเช็คชื่อ+ช่อง note / ประวัติโชว์เวรกลางคืน / แอดมิน: ช่องเพศในฟอร์มเพิ่ม+dropdown ในตาราง (`user_set_gender`) + สถิติเวรบนแดชบอร์ด/รายงาน → cache-bust v18
- **Migration guarded** (`ensure_admin`): probe `night_shifts` (42S02→run schema.sql, re-add settings) + ALTER `users.gender`/`attendance.note` (probe information_schema) — idempotent

**ทดสอบ (local: PHP 8.5 + MySQL, display_errors=0 เหมือน prod):**
- **API E2E 13/13 pass** — night check-in ชายได้/กันซ้ำ/หญิงบล็อก/ไร้เพศบล็อก, ยกเว้นสาย (มี night_shift เมื่อวาน→late=false+exempted) vs หญิงไม่มีเวร→late=true, night_stats นับ 2 คืน, report/my_history แนบครบ
- **Sunday logic 4/4 pass** (PHP harness เพราะ fake วันที่ไม่ได้) — is_station_holiday(อาทิตย์)=true/(อังคาร)=false, holiday_workers SQL ดึงคน+note ได้, late=0
- **Migration บน DB จำลอง prod เก่า** (ตัด night_shifts+gender+note+settings ทิ้ง) → ยิง API → เติมกลับครบ + ยิงซ้ำ idempotent ไม่ error
- **Playwright + Chrome (headless) 0 console error** — หน้าตั้งค่ามีสวิตช์เวรกลางคืน/วันอาทิตย์+เวลา, หน้าเจ้าหน้าที่มีช่องเพศ, หน้า Home ชายมีปุ่มลงเวร (gate เวลาโชว์ "เปิดลงเวร 18:00 น.")

**⚠️ Rollout:** deploy แล้วแอดมินต้อง **ตั้งเพศให้ จนท.เดิมทุกคนก่อน** (row เก่า gender=NULL → ชายถึงลงเวรได้) — สวิตช์ default เปิดหมด

## Deploy (3 ก.ค. 2026)

- [x] GitHub: push ขึ้น https://github.com/vwin2537-arch/FireChecker.git
- [x] Railway: project "firecheck" (id `0490e262-abfe-49c6-bd47-81cdd12ed7d1`) — service `firecheck-app` + `MySQL` + Volume `/data` + env (CRON_SECRET, UPLOAD_DIR, MySQL refs) ครบ → verify HTTP 200 จริงแล้ว → lesson 4
- [x] Railway CLI skill/MCP ติดตั้งให้ Claude Code แล้ว (`railway setup agent -y`) — deploy รอบต่อไปสั่งตรงได้เลย
- [x] **redeploy รอบ 2** (แก้ UI มือถือ S24 Ultra: ตัวกรองรายงานล้นจอ + เมนูล่างหายบน Samsung + cache bust `?v=2`) → verify asset ใหม่บนเว็บจริงแล้ว → lesson 5 — **รอพี่เทสเมนูล่างบนเครื่องจริง** (บั๊ก Samsung เช็ค headless ไม่ได้)
- [x] **redeploy รอบ 3** (แบบทดสอบ flow ใหม่ + cache bust `?v=5`, ครั้งแรกที่ฟีเจอร์แบบทดสอบขึ้น live) → verify HTTP 200 + asset ใหม่บนเว็บจริงแล้ว — Railway MCP ค้าง `Unauthorized` ตอน deploy รอบนี้ → ใช้ `railway up` (CLI) แทนได้เลย ไม่ต้อง re-login (CLI auth คนละชุดกับ MCP)
- [x] **redeploy รอบ 4** (Google Drive selfie sync + `?v=6`) → verify live: oauth.php ทำงาน, `gdrive_status connected=true` + `root_id` มีค่า (พี่วินเชื่อม Drive จริงสำเร็จ 4 ก.ค.), `selfie_required=1` บน production → lesson 7
- [x] **redeploy รอบ 5** (รื้อแดชบอร์ด: บล็อกวันนี้เป็นพระเอก + โดนัท `drawToday` + รายชื่อแยกกลุ่มตามสถานะ, ตัด `trend14`+`week_compare` ฝั่ง backend ทิ้ง = หน้าโหลดเร็วขึ้น (เลิกวน `roster_for` ~25 รอบ) + `?v=7`) → `railway up` (MCP ยัง Unauthorized ตามเดิม) → verify live: asset ใหม่เสิร์ฟจริง (`admin.js` มี `dash-today`/`drawToday`, ไม่มี `drawTrend` แล้ว; `app.css` มี `.dash-today`) — เทสในเครื่องด้วย Playwright + DB ทดสอบ seed 8 จนท. ครบทุกสถานะ ค่า render ตรง (5/7, 71%, กลุ่มเรียงถูก) 0 error
- [x] **redeploy รอบ 6** (4 ก.ค. 2026 — ปรับ flow ลงทะเบียน: แอดมินเพิ่มแค่ชื่อ-สกุล, เจ้าหน้าที่ตั้ง `username`+`password` เอง, `status=active` ทันทีไม่รออนุมัติ, popup ย้ำ user/pass ให้จด, ช่อง username ใส่ `autocapitalize=off` กันคีย์บอร์ดมือถือขึ้นตัวใหญ่ + `?v=8`) — **schema เปลี่ยน:** `users.username` เป็น nullable + guarded ALTER ใน `ensure_admin` (probe `information_schema.IS_NULLABLE` ก่อน ALTER, idempotent) migrate DB prod เดิมอัตโนมัติ → `railway up` (MCP ยัง Unauthorized) → **verify:** local E2E ผ่าน HTTP ครบ (user_add ไม่ส่ง username → register ตั้ง username → login ได้ทันที, username ซ้ำ/ตัวไทย = บล็อก) + migration test บน DB จำลอง prod เก่า (NOT NULL → flip nullable + insert NULL + register สำเร็จ) + live: index v8 เสิร์ฟจริง, `register_list` 200 JSON (ยืนยัน ALTER รันผ่านบน prod ไม่ crash, เจ้าหน้าที่ 16 คนรอลงทะเบียน) — เก่า user 16 คนมี username เดิมที่แอดมินตั้ง จะถูกทับตอนเจ้าตัว register
- [x] **redeploy (v16→v17)** (5 ก.ค. 2026 — **v16:** ฉากพิกเซล SVG หน้า Home แทน emoji 3 สถานะ (`App.scene(beach/work/rest)` + keyframes `sc-*`+`prefers-reduced-motion`, ไม่มีไฟล์รูป). **v17:** ฉลองเช็คตรงเวลา — `App.celebrate()` โปรย confetti พิกเซล overlay + ฉากเด้ง `.pop` ผ่าน flag `justCheckedIn` (มาสาย/ลดการเคลื่อนไหว = ไม่ฉลอง)) → `railway up` → **verify live:** index v17, live app.js มี `celebrate()`+`scene()`, live app.css มี `confetti-layer`/`sc-fall`/`sc-palm`, sw.js `firecheck-v17` — commit `81f0f36`+`2409a4c` (verify ก่อน deploy ด้วย headless Chrome เรนเดอร์ scene()/celebrate() จริงบน app.css จริง)

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

## Deploy (4 ก.ค. 2026 — bugfix)

- [x] **redeploy รอบ 6-8** แก้ lesson 8+9: (6) worker Drive แทน after_response, (7) Volume chown + display_errors=Off → verify prod: checkin ตอบ JSON สะอาด (content-type application/json, ok=true) + `gdrive_status done:1`, (8) timezone +07:00 → verify row ใหม่เวลาถูก — ทุกรอบ `railway up` (MCP ยัง Unauthorized) + commit+push `main` (`2a49de6`)
- [x] **redeploy รอบ 9 (v10)** แก้บั๊กเช็คอิน iOS ค้าง → ถ่ายเซลฟี่ก่อนหา GPS + surface error.code → lesson 10 — verify: พี่วินเทส iPhone จริง ถ่ายรูป+เช็คชื่อผ่าน (commit `f3e51a5`)
- [x] **redeploy รอบ 10-11 (v11-12)** ปฏิทินวันหยุดแอดมิน heatmap + filter รายคน — verify logic ใน node + พี่วินดูจริงผ่านทั้ง 2 โหมด (commit `df674c4`) — `railway up` ทุกรอบ
- [x] **heartbeat วันหยุดสถานี** (5 ก.ค. 2026) — เดิมวันอาทิตย์ `build_report` คืน null → รายงานเงียบ (cron ยิงแต่ skip) พี่วินนึกว่า trigger พัง จริงๆ ทำงานถูก. เพิ่ม: วันหยุดสถานี **รอบเช้าส่งข้อความ heartbeat** ("ระบบเช็คชื่อทำงานปกติ...") + แนบคำขอลาค้าง / **รอบเย็นยังเงียบ** — ไม่แตะ `sunday_off` (เช็คชื่อวันอาทิตย์ยังปิด) `line_logs` กันส่งซ้ำเหมือนเดิม — `railway up` (deployment `6fd37fd0` SUCCESS) → **verify:** ยิง `cron_report?type=morning&force=1` เข้า prod → LINE ตอบ HTTP 200 + message id `621442374475972813` (เข้ากลุ่มจริง)

## โซนสุขภาพ (เฟส 1 — สมุดบันทึกสุขภาพ) — Deploy 7 ก.ค. 2026 (v19)

- **เมนูใหม่ 🩺 สุขภาพ** ในแถบล่าง (staff 6 แท็บ / admin 7 แท็บ) — segmented sub-tab: ผลตรวจสุขภาพ (เฟส1) / สมรรถภาพ (เฟส2 ยัง disabled)
- **แอดมินกรอกผลตรวจให้ทุกคน** (`health_admin_add/list/del`) — เจ้าหน้าที่ดูของตัวเองอย่างเดียว (`health_my`) หลาย entry ต่อคน (ไม่มี UNIQUE เก็บทุกครั้ง เหมือน `quiz_attempts`)
- **ตาราง `health_records`** (weight/height/waist/bp_sys/bp_dia/pulse/note/checkup_place) + **คอลัมน์ `users.birthdate DATE NULL`** — ทั้งคู่ migrate ผ่าน guarded pattern ใน `ensure_admin()` (probe 42S02 + ALTER information_schema เหมือน gender)
- **จัดระดับอัตโนมัติ (Set 3 ค่าคงที่การแพทย์ไทย ใน `health.php`):** BMI เอเชีย / ความดัน สมาคมความดันฯ 2562 / รอบเอว (ต้องรู้เพศ) / ชีพจร — คืน `{label,level}` (ok/warn/bad/info) หรือ null. **BMI คำนวณสดตอนอ่าน ไม่เก็บ**
- **NULL degrade:** ไม่มีเพศ → รอบเอว = "ยังไม่จัดระดับ" (BMI/ความดัน/ชีพจรยังคำนวณได้) ไม่ error — verify แล้ว
- **แอดมินกรอกวันเกิด+เพศ** ในแท็บเจ้าหน้าที่ (`user_set_birthdate` + `valid_birthdate` 15-80 ปี) — ใช้เตรียมเทียบเกณฑ์ทดสอบเฟส 2
- verify: local API ครบ (grading ถูกทุกค่า + NULL path) + playwright screenshot ทั้ง staff/admin ไม่มี console error — `railway up` (Deploy complete) → prod v19 + `health_admin_list` recognized + login เดิมทำงาน
- **⚠️ Rollout:** แอดมินต้องตั้งเพศ+วันเกิด จนท.เดิมก่อน — เฟส1 ขาดเพศแค่รอบเอวไม่จัดระดับ / **เฟส2 (สมรรถภาพ) ขาดอายุ/เพศ = ไม่จัดเกรด**
- **รอทำเฟส 2:** ทดสอบสมรรถภาพ (`fitness_items`/`fitness_rounds`/`fitness_results` + grading engine higher/lower/cap + seed WCT Pack Test) — เกณฑ์ configurable แอดมินตั้งเอง (ไม่มีมาตรฐานดับไฟป่าไทยเผยแพร่ + ตารางกรมพลศึกษาเต็มติด PDF)

## โซนสุขภาพ (เฟส 2 — ทดสอบสมรรถภาพ + grading engine) — v20 (7 ก.ค. 2026, deployed)

- **3 ตารางใหม่:** `fitness_items` (ท่า+เกณฑ์ criteria_json), `fitness_rounds` (รอบทดสอบ), `fitness_results` (ผลรายคน/รอบ/ท่า หลาย entry) — probe 42S02 ใน `ensure_admin` + FK cascade
- **เกณฑ์ configurable (แอดมินตั้งเอง)** — `seed_fitness_presets()` ใส่ตั้งต้นครั้งแรก (ตารางว่าง): WCT Arduous/Moderate/Light (cap 45/30/16) + ดันพื้น (higher, ThaiSook 5 ช่วงอายุ×เพศ)
- **grading engine (`grade_fitness` ใน health.php) — 3 direction:** `higher`(มากยิ่งดี) · `lower`(น้อย/เร็วยิ่งดี) · `cap`(ผ่าน≤เพดาน). เกณฑ์เป็น band แยกอายุ×เพศ; ระดับเรียง best→worst, tone(ok/warn/bad)คำนวณตามลำดับ. **cap ไม่ใช้อายุ/เพศ (จัดได้ทุกคน)** / higher-lower ต้องมีอายุ(จากbirthdate ณ test_date)+เพศ ไม่งั้น `level=null` "ยังไม่จัดระดับ" — verify ครบทุก direction + NULL
- **แอดมิน:** สร้างรอบ(+LINE notify async) / กรอกผลแบบ roster (ตารางทั้งทีม×ท่า กรอกทีเดียว batch, ค่าว่าง=ลบ, จัดระดับตอนบันทึก) / จัดการท่า+เกณฑ์ (editor แบบตารางวิชาพละ: ระดับ comma-separated + band อายุ×เพศ, `fitSyncCrit` อ่าน DOM ก่อน re-render กันค่าหาย)
- **เจ้าหน้าที่:** แท็บย่อย 🏃 สมรรถภาพ (เดิม disabled) → ผลตัวเองแยกตามรอบ + chip ระดับ (`fitnessChip` by tone)
- verify: local API grading ถูกทุกเคส (ดันพื้น45→ดี, วิ่ง12→พอใช้ ไม่กลับทิศ, WCT50→ไม่ผ่าน, NULL→ยังไม่จัดระดับ, re-save/clear) + playwright 3 จอ (roster/criteria-editor/staff) ไม่มี console error
- **cache-bust v19→v20** (เฟส2 แก้ app.js/admin.js/app.css ซ้ำจาก v19 ที่ deploy ไปแล้ว — ต้องเด้ง v20 ไม่งั้น PWA ค้างเฟส1)
- **v20+21 deployed 7 ก.ค. (`railway up`)** — verify live: index v21 เสิร์ฟจริง + `fitness_rounds_list`/`health_dashboard` ตอบ 401 JSON (route ลง, display_errors ปิด). **ชุดทดสอบที่พี่วินเลือก = กรมพลศึกษา 19-59 + WCT** (ไม่ใช่ดันพื้น/ซิทอัพ=วัยเรียน 7-18) → สคริปต์ตั้ง 3 ท่า `~/setup_fitness.py` (idempotent, พี่วินรันเอง) **ยังไม่รันบน prod**

## การ์ดวัคซีน (โซนสุขภาพ เฟส 3) — v34 (13 ส.ค. 2026, ✅ deployed, commit `e25aec5`)

- **โจทย์พี่วิน:** จดวัคซีนที่ จนท. ไปฉีด (ไข้หวัดใหญ่อายุ ~1 ปี) — ปัญหาจริงคือ **ทั้ง 3 อย่าง**: ไม่มีภาพรวมทั้งทีม + จนท.ไม่รู้ว่าตัวเองฉีดวันไหน + ไม่รู้ว่าใครใกล้หมดอายุ. แอดมินกรอก → เจ้าหน้าที่ดูได้
- **2 ตารางใหม่:** `vaccine_types` (แอดมินเพิ่มชนิด+ตั้งอายุความคุ้มกันเอง, soft delete) / `vaccine_records` (1 แถว/การฉีด) — probe 42S02 ใน `ensure_admin` + `seed_vaccine_presets()` 4 ชนิด
- **สถานะคำนวณสดจากเข็มล่าสุด** (`vaccine_status`) 🟢 ยังคุ้ม / 🟡 ใกล้ครบ (≤ setting `vaccine_warn_days` default 60) / 🔴 เกินกำหนด / ⚪️ ยังไม่มีข้อมูล · `valid_months=NULL` = ตลอดชีพ
- **แอดมิน:** แท็บที่ 4 โซนสุขภาพ → 👥 ภาพรวมทีม / 🧍 รายคน (ฟอร์มบันทึก + ประวัติ + ลบ) / ⚙️ ชนิดวัคซีน (เพิ่ม/แก้/ซ่อน + ตั้งวันเตือนล่วงหน้า)
- **ภาพรวมทีมทำเป็นตารางก่อน แล้วพี่วินสั่งเปลี่ยน** — จอ 430px เห็นแค่ 2 จาก 4 คอลัมน์ ต้องลากขวา (บทเรียนซ้ำกับการ์ดเวรกลางคืน v28) → เปลี่ยนเป็น **บล็อกรายคน** ชื่อ + รายการชนิดพร้อมป้ายสี เรียงคนมีปัญหาขึ้นก่อน (🔴→🟡→ที่เหลือ)
- **เจ้าหน้าที่:** sub-tab 💉 วัคซีน — การ์ดสถานะรายชนิด + ประวัติการฉีดทุกเข็ม (อ่านอย่างเดียว)
- **verify (local, DB `firecheck_vactest` แยกต่างหาก แล้ว drop ทิ้ง):** ครบทั้ง 4 สถานะจากวันจริง (ok 353 วัน / warn 19 วัน / bad เกิน 224 วัน / none) · validate fail ถูก (วันอนาคต, ชนิดไม่มีจริง, ชื่อว่าง, อายุ 5000 เดือน) · setting clamp 400→365 แล้วป้ายเปลี่ยนตาม · ซ่อนชนิดแล้วประวัติ จนท. ไม่หาย · **migration path: drop 2 ตาราง + ลบ setting → ยิง API → สร้างคืนครบ + seed กลับ** · playwright 2 ฝั่ง (แอดมิน 3 sub-view + บันทึกผ่าน UI จริง / staff) **0 console error**
- cache-bust v33→v34 (index.php + sw.js CACHE + ASSETS)
- **verify live หลัง `railway up`:** index.php เสิร์ฟ `app.css/app.js/admin.js?v=34` ครบ · `vaccine_types_admin` + `vaccine_my` ตอบ **401 JSON** (`content-type: application/json` ไม่ใช่ text/html+`<br>`) = route ลง + display_errors ปิด · **ไม่ใช่ 500 "ฐานข้อมูลขัดข้อง" = `ensure_admin` ผ่าน** → probe สร้าง 2 ตาราง + `seed_vaccine_presets()` (ที่ query `vaccine_types`) รันสำเร็จบน prod DB จริง

## แดชบอร์ดภาพรวมสุขภาพ — v21 (7 ก.ค. 2026, deployed)

- **แท็บ 📊 ภาพรวม** แท็บแรก+default โซนสุขภาพ (admin) — `h_health_dashboard` สรุป 🔴ต้องดูแล/🟡เฝ้าระวัง/🟢ปกติ **แยกการ์ดสุขภาพ & สมรรถภาพ**, ผลล่าสุดต่อคน, ซ่อนคนไม่มีข้อมูล, staff active. สุขภาพ=grade bad→🔴/warn→🟡 · สมรรถภาพ=**ตำแหน่งระดับ** ล่างสุด→🔴 รองล่าง→🟡 (ไม่ใช้ tone ดิบ กัน "ดี" false-alarm) · cap=tone bad→🔴. กดชื่อ→หน้ารายคน. → CLAUDE.md "โซนสุขภาพ"
- verify: ทดสอบครบทุก branch บน local server+DB จริง (รวมเคส "ดี"ไม่โดน flag) + prod endpoint 401 JSON
