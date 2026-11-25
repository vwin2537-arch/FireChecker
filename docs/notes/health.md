# โซนสุขภาพ — สมุดสุขภาพ / สมรรถภาพ / วัคซีน

> แยกจาก CLAUDE.md (26 ส.ค. 2026) เพื่อคุมขนาด context — CLAUDE.md เก็บแค่กฎเหล็ก + ดัชนี

## โซนสุขภาพ (เฟส 1 สมุดสุขภาพ + เฟส 2 ทดสอบสมรรถภาพ — `app/handlers/health.php`)

- **เมนู 🩺 สุขภาพ แยกต่างหาก** (ไม่อยู่ใต้ "พัฒนาตัวเอง") — staff bottom-nav 6 แท็บ / admin 7 แท็บ. แต่ละฝั่งมี segmented sub-tab `record`(สุขภาพ)/`fitness`(สมรรถภาพ). **แอดมินกรอกทุกอย่าง เจ้าหน้าที่อ่านอย่างเดียว**
- **`users.birthdate DATE NULL`** — guarded ALTER ใน `ensure_admin` (probe information_schema เหมือน gender) + อยู่ใน `public_user()`. แอดมินตั้งผ่านแท็บเจ้าหน้าที่ (`user_set_birthdate` + `valid_birthdate` 15-80 ปี). อายุคำนวณสด (`age_at`/`ageFrom`) ห้ามเก็บ
- **สุขภาพ (`health_records`, หลาย entry/คน ไม่มี UNIQUE):** จัดระดับ BMI/ความดัน/รอบเอว/ชีพจร เป็น**ค่าคงที่มาตรฐานการแพทย์ไทยในโค้ด** (`grade_bmi/grade_bp/grade_waist/grade_pulse` คืน `{label,level}` level=ok/warn/bad/info หรือ null). **BMI คำนวณสดตอนอ่าน (`calc_bmi`) ไม่เก็บ**. รอบเอวต้องรู้เพศ ไม่งั้น null
- **สมรรถภาพ = configurable (แอดมินตั้งเกณฑ์เอง):** 3 ตาราง `fitness_items`(ท่า+`criteria_json`) / `fitness_rounds`(รอบ) / `fitness_results`(ผลรายคน/รอบ/ท่า หลาย entry). preset ใส่ครั้งแรกด้วย `seed_fitness_presets()` (guard count==0) — WCT + ดันพื้น
- **grading engine `grade_fitness($item,$raw,$age,$gender)` — 3 direction (หัวใจ, กันพลาดทิศ):**
  - `higher` มากยิ่งดี / `lower` น้อย-เร็วยิ่งดี → ต้องมี**อายุ+เพศ**; `criteria_json`={levels:[best→worst], bands:[{min_age,max_age,male:[thr...],female:[thr...]}]}; thr เรียงตรงกับ levels; tone(ok/warn/bad) จากลำดับ (`fitness_tone`)
  - `cap` ผ่าน≤เพดาน → `criteria_json`={cap:N}; **ไม่ใช้อายุ/เพศ จัดระดับได้ทุกคน** (WCT)
  - **NULL degrade:** ไม่มีค่า/อายุ/เพศ/เกณฑ์ → คืน null = "ยังไม่จัดระดับ" ห้าม error/เกรดผิด. คำนวณ+เก็บ level+tone ตอนกรอก (ตอน `fitness_result_save`)
- **กรอกผลแบบ roster batch** (`fitness_round_get` → ตารางทั้งทีม×ท่า, `fitness_result_save` รับ array — ค่าว่าง=ลบผลเดิม, แก้ซ้ำได้ด้วย DELETE+INSERT). แจ้ง LINE async ตอนเปิดรอบ (`line_enqueue` ห้าม push คา request)
- **criteria editor ฝั่ง admin (admin.js `fitRenderCrit`/`fitSyncCrit`):** re-render บ่อย → **ต้อง `fitSyncCrit()` อ่านค่าจาก DOM กลับเข้า working copy ก่อน mutate/re-render ทุกครั้ง** ไม่งั้นค่าที่พิมพ์หาย
- helper `healthChip`/`fitnessChip` (app.js global, admin.js เรียกได้เพราะโหลดทีหลัง) — สี tone จาก `HEALTH_LV`
- **แดชบอร์ดภาพรวม `h_health_dashboard` (v21, admin, แท็บ 📊 ภาพรวม = แท็บแรก+default):** สรุปคนต้องดูแล🔴/เฝ้าระวัง🟡/ปกติ🟢 **แยก 2 การ์ด สุขภาพ & สมรรถภาพ** — ผลล่าสุดต่อคน (health = MAX(record_date) / fitness = round test_date ล่าสุด), เฉพาะ staff active, **ซ่อนคนไม่มีข้อมูล**. เกณฑ์: สุขภาพ level bad→🔴 / warn→🟡. สมรรถภาพใช้**ตำแหน่งระดับใน `criteria_json.levels`** (ล่างสุด→🔴, รองล่างสุด→🟡) **ไม่ใช้ `tone` ดิบ** (เพราะ fitness_tone ให้ "ดี"=warn จะ false-alarm) · cap/ไม่มี levels → พึ่ง tone bad→🔴. ลิสต์เฉพาะ 🔴🟡 พร้อม issues, กดชื่อ→`Admin.healthOpen(uid)` ไปแท็บ record รายคน. render `Admin.vHealthOverview`/`ovCard` (admin.js), style `.ov-*` (app.css)
- migration: probe `health_records` + `fitness_items` (42S02→schema.sql) — pattern เดียวกับ night_shifts

## ผลแลบรายค่า + ติดตามพบแพทย์ (v48)

- **`health_labs`** (1 แถว = 1 ค่า, PK record_id+code, CASCADE ตาม `health_records`) — `val` เป็นข้อความ (Negative/Trace/5-10) · `ref`+`abnormal` เก็บ**ตามที่ใบ รพ. พิมพ์** ห้ามคำนวณธงเอง · `lab_dir()` ใช้แค่โชว์ลูกศร ▲▼
- **`HEALTH_LABS`** (health.php) = แม่แบบรายการแลบที่เดียว ทั้งฟอร์มกรอก + การแสดงผลสร้างจากตัวนี้ — เพิ่มรายการใหม่แก้ที่นี่ที่เดียว (code ยาวได้ 12)
- คอลัมน์ใหม่ใน `health_records`: `xray`/`xray_level`(ok|warn|refer)/`doctor_summary`/`follow_status`(wait|booked|done|NULL)/`follow_date`/`follow_note` (guarded ALTER probe `xray` ตัวเดียวคุมทั้งชุด)
- `health_labs_save` = แทนที่แลบทั้งชุด (DELETE+INSERT ใน transaction) · `refer` → `follow_status='wait'` อัตโนมัติ แต่**ไม่ทับสถานะที่ตั้งไว้แล้ว** · `health_follow_save` นัดแล้ว = ต้องมีวัน
- ภาพรวม: 🏥 ต้องไปพบแพทย์ → 🔎 ทีมมีเรื่องไหนเยอะ (top 5) → การ์ดสีเดิม · สี: refer ที่ยังไม่ done = 🔴, xray warn / แลบธงผิดปกติ = 🟡 · แลบดึงจาก**ใบล่าสุดที่มีแลบ** (จดน้ำหนักอย่างเดียวทีหลังต้องไม่บังแลบ)
- **`h_health_my` ห้ามส่ง `follow_*`** (เห็นเฉพาะหัวหน้า) · `healthLabsHtml()` (app.js) ใช้ร่วมทั้งสองฝั่ง
- ค่าที่ผิดปกติเพียงเล็กน้อยก็เป็น 🟡 → เกือบทุกคนเหลือง ใช้การ์ด "ต้องไปพบแพทย์" เป็นตัวบอกความเร่งด่วน ไม่ใช่สี
- **นำเข้าผลตรวจปีถัดไป (ใบ รพ. สแกน, ไม่มี text layer):** 1 คนอาจมีหลายหน้าตามสิทธิ (ประกันสังคม/จ่ายเอง) → รวมเป็นใบเดียว, ถ้าค่าร่างกายไม่ตรงกันให้ถามหัวหน้า · ตรวจไขว้ก่อนลง: MCV=Hct/RBC×10, MCH=Hb/RBC×10, ค่า↔ช่วงปกติ↔ธงต้องตรงกัน · ลายมือหมอต้องให้หัวหน้ายืนยันก่อน · จับคู่ชื่อเต็มตรงเป๊ะ ไม่ตรง = หยุดถาม · `health_admin_add` แทรกเสมอ → เช็ควันที่ซ้ำก่อน แล้วค่อย `health_labs_save` · **ชื่อ/ค่าสุขภาพห้ามเข้า repo** (ทำใน scratchpad แล้วลบ)
- เทสหน้าจอ: แก้ `assets/*` ซ้ำโดยไม่เด้ง `?v=` → SW cache-first โชว์ของเก่า ต้องใช้โปรไฟล์เบราว์เซอร์ใหม่ · copy DB ด้วย `mysqldump --set-gtid-purged=OFF`

## วิ่ง 2 กม. — ท่าแบบ `mode=step` (v45)

เกณฑ์ = การเลือกสรรพนักงานพิทักษ์ป่า 2561 (เอกสารหมายเลข 5, ไฟล์ต้นฉบับใน OneDrive `00_ERW_01_70/`) — 8 ช่วงอายุ × 2 เพศ
- **ทั้งตารางเป็นสูตรเดียว (เช็คครบ 16 คอลัมน์แล้ว):** เวลา ≤ `top_sec` = 100 คะแนน · ช้าลงทุก 5 วิ หัก 1 · แถว 60 คะแนน = `top_sec + 200` · ช้ากว่านั้น = **ไม่ผ่าน** → `criteria_json` เก็บแค่ `{mode:'step', step_sec, top, floor, absent_fail, bands:[{min_age,max_age,male:<sec>,female:<sec>}]}` (sec = ขอบบนของแถว 100) · `grade_fitness_step()` · `direction` ยังเป็น `lower` (ไม่ต้อง ALTER ENUM)
- **raw_value = วินาที, ตัดเศษทิ้ง** (`floor` ทั้ง client `parseMSS` และ server) · client รับ `12.34`/`12:34`/`12:34.5` — ต้องมีวินาที 2 หลัก (`12.3` = รูปแบบผิด กันกำกวม 12:03/12:30) · แสดงผลด้วย `fmtMSS` (app.js global)
- **สี/ระดับ:** `"NN คะแนน"` tone ok (≥80) / warn (60-79) · ไม่ผ่าน = bad · **ยกเว้น = level `ยกเว้น` tone `skip`** (สีเทา, raw NULL)
- **ไม่มีผล = ไม่ผ่าน (`absent_fail`) เฉพาะท่า step + เฉพาะรอบที่ "ทดสอบจริง"** = มีคนกรอกเวลาอย่างน้อย 1 คน — ทั้งทีมว่าง = รอบนั้นไม่ได้วิ่ง ไม่ปรับตก (รอบ WCT ล้วนจะไม่แดงทั้งทีม). ⚠️ กดบันทึกตอนกรอกได้ครึ่งทีม = ที่เหลือเป็นไม่ผ่านชั่วคราว (กรอกต่อแล้วบันทึกใหม่แก้เอง เพราะ DELETE+INSERT)
- **`fitness_results.note`** (v45, guarded ALTER) — หมายเหตุรายคน (บาดเจ็บ / เจ้าหน้าที่คุมการทดสอบ) โชว์ทั้งหน้าแอดมิน + หน้า จนท.
- **แดชบอร์ดภาพรวม:** แถว `skip` ถูกกรองทิ้งก่อนนับ (คนที่ยกเว้นทุกท่า = ซ่อน ไม่นับเป็น 🟢) · ท่าไม่มี `levels` + tone `warn` → 🟡 (เพิ่ม v45 — เดิมดูแค่ bad)
- **เกณฑ์ล็อก:** `h_fitness_item_save` เจอท่า step → อัปเดตแค่ชื่อ · `fitRenderItemEdit` โชว์ตารางเกณฑ์อ่านอย่างเดียว (3 คอลัมน์ `min-width:0` — แตก 4 คอลัมน์แล้วหญิงตกขอบจอ 430px) — **ห้ามเปิดให้แก้ผ่านฟอร์ม levels/bands** ฟอร์มนั้นจะทับ JSON จนพัง
- seed: `seed_fitness_run2k()` ใน db.php — guard ด้วย `criteria_json LIKE '%"mode":"step"%'` (รวมท่าที่ซ่อน — ซ่อนแล้วไม่โผล่ซ้ำ) ใส่ได้ทั้ง DB ใหม่และ DB เดิม
- **รายงานผลทดสอบ (v46) — 1 ฉบับ = 1 ท่า × 1 รอบ:** ปุ่ม "📄 รายงาน <ท่า>" ในหน้ากรอกผล (เฉพาะท่าที่มีผลในรอบ — `items_with_results` จาก `fitness_round_get`) → `h_fitness_report` → overlay `#reportOverlay` (reuse `reportPrint`/`reportSave(fileName)`/`reportClose` ของรายงานรายเดือน) · ใช้ภายใน **ไม่มีช่องลงชื่อ** (พี่วินเลือก) · คอลัมน์ ที่/ชื่อ/เพศ/อายุ/เวลาที่ใช้(หรือค่าที่วัดได้)/คะแนน(หรือผลเทียบเกณฑ์)/สถานะ/หมายเหตุ · **เรียงชื่อ ก-ฮ ทุกคนรวมยกเว้น** ด้วย `Intl.Collator('th')` หลังตัดคำนำหน้า (นาย/นาง/นางสาว/น.ส.) — SQL `ORDER BY name` จะจับกลุ่มตามคำนำหน้า และไม่จัดสระหน้า เ แ โ
- **`fitness_status()` = กฎสถานะจุดเดียว** (pass/watch/fail/skip/none) ใช้ทั้งการ์ดภาพรวม + รายงาน — เพิ่มกฎใหม่แก้ที่นี่ที่เดียว
- **`fitness_rounds.location`** (v46, guarded ALTER) — ฟอร์มสร้างรอบเติมชื่อสถานีให้ (ว่าง = server ใส่ `station_name`) · แก้ได้ทีหลังด้วยปุ่ม ✏️ (`fitness_round_location`)
- **ปริ้น A4 หน้าเดียว:** paper มีคลาส `.rp-fit` → `@media print` บีบ padding/font เฉพาะรายงานนี้ (ไม่กระทบรายงานรายเดือน/ประวัติอบรม) — วัดแล้ว 20 คน = 1 หน้าพอดี (ก่อนบีบ 2 หน้า) ถ้าทีมโตเกิน ~22 คนจะล้นหน้า 2 ซึ่งยอมรับได้
- ⚠️ เทสด้วย playwright `locator('#rptPaper').screenshot()` ส่วนล่างจะขาด (paper อยู่ในกล่อง scroll) — ดูผลจริงจากไฟล์ที่ "บันทึกรูป" (html2canvas) หรือ `page.pdf()` แทน
- **แจ้งผลรายคน (v47) = ปุ่ม "📣 แจ้งผลให้เจ้าหน้าที่" หัวหน้ากดเอง** (`h_fitness_notify`) — **ห้ามย้ายไปยิงอัตโนมัติตอน `fitness_result_save`**: บันทึกครึ่งทีม = คนที่ยังไม่กรอกเป็น "ไม่ผ่าน" ชั่วคราว (absent_fail) จะเด้งบอกเขาว่าไม่ผ่านผิดๆ · 1 คน = 1 ข้อความรวมทุกท่าในรอบ (ค่า → ระดับ (สถานะ) · หมายเหตุ) ผ่าน `notify_push` (type `announcement` + emoji เหมือนประวัติอบรม — ไม่แก้ ENUM) · `fitness_rounds.notified_at` (guarded ALTER) โชว์ "แจ้งไปแล้วเมื่อ…" + กดซ้ำ Swal เตือนว่าทุกคนจะได้ซ้ำ · ส่งเฉพาะ staff active ที่มีผลในรอบ
- ข้อจำกัดที่ยอมรับ: ตัวเลข "ทดสอบแล้ว N คน" ในลิสต์รอบนับรวมแถวยกเว้น/ไม่ผ่าน (รอบ 17 ต.ค. = 20 ไม่ใช่ 13) · บันทึกรอบเก่าซ้ำหลังมี จนท. ใหม่ → คนใหม่โดนไม่ผ่านในรอบที่ไม่ได้อยู่ (ติ๊กยกเว้นให้แทน)
- ทดสอบ (17 ต.ค. 2569): สูตร 346 จุด (ขอบทุกช่วง + เซลล์อ่านจาก PDF + ผลจริง 13 คน) + API บน DB copy (migration) และ DB เปล่า + playwright หน้ากรอก/เกณฑ์/ภาพรวม/หน้า จนท.

## การ์ดวัคซีน (โซนสุขภาพ เฟส 3 — v34, `app/handlers/vaccine.php`)

แอดมินกรอกวันที่ฉีดให้ จนท. → ระบบคิดว่าครบรอบเมื่อไหร่ ขึ้นป้ายสีเตือน · **เจ้าหน้าที่อ่านอย่างเดียว** (pattern เดียวกับ health_records)

- **2 ตาราง:** `vaccine_types` (ชนิด + `valid_months` + soft delete `is_active` — เหมือน `fitness_items`) / `vaccine_records` (1 แถว/การฉีด 1 ครั้ง หลาย entry ต่อคน×ชนิด ไม่มี UNIQUE). `seed_vaccine_presets()` guard count==0 ใส่ 4 ชนิดตั้งต้น (ไข้หวัดใหญ่ 12 / บาดทะยัก 120 / พิษสุนัขบ้า NULL / โควิด 12)
- **`valid_months = NULL` = ตลอดชีพ ไม่เตือนครบรอบ** (พิษสุนัขบ้าฉีดครบคอร์ส) — `vaccine_status()` คืน level `ok` label "ฉีดแล้ว" ไม่คิด due
- **สถานะคำนวณสดตอนอ่าน ไม่เก็บลง DB** (เหมือน BMI) — `vaccine_status($lastDate,$validMonths,$warnDays)` นิยามครั้งเดียวใน vaccine.php ใช้ทั้ง 3 handler: `none`(ยังไม่มีข้อมูล ⚪️) · `ok`(🟢) · `warn`(🟡 เหลือ ≤ `vaccine_warn_days`) · `bad`(🔴 เกินกำหนด)
- **ยึด "เข็มล่าสุด" ของแต่ละคน×ชนิดเท่านั้น** (`vaccine_latest_map()` = `MAX(dose_date) GROUP BY user_id,type_id`) — เข็ม 1-5 จดได้หมดแต่สถานะดูเข็มสุดท้าย
- **`h_vaccine_my` ต้องแสดงชนิดที่ถูกซ่อนด้วยถ้าคนนั้นเคยฉีด** (merge active types + types ที่โผล่ในประวัติ) ไม่งั้นซ่อนชนิดแล้วประวัติของ จนท. หายเงียบ
- **`h_vaccine_overview` โชว์ทุกคน×ทุกชนิด รวมช่องที่ยังไม่มีข้อมูล** — ตั้งใจต่างจากการ์ด 📊 ภาพรวม (ที่ซ่อนคนไม่มีข้อมูล) เพราะหัวหน้าต้องเห็นว่าใครตกหล่น
- **setting `vaccine_warn_days`** (1-365, default 60) อยู่ใน EDITABLE_SETTINGS + clamp ใน `h_settings_save` — **แก้จากแท็บ ⚙️ ชนิดวัคซีน ไม่ได้อยู่ในหน้าตั้งค่า** (เลยไม่ต้องเพิ่มใน array `keys` ของ `saveSettings()`)
- **client:** staff = sub-tab `💉 วัคซีน` (`renderVaccine` ใน app.js) · admin = แท็บที่ 4 โซนสุขภาพ แตกเป็น 3 sub-view `team|person|types` (`Admin.vVaccine`). helper global `vaccineChip`/`VAC_ICON`/`vacShortDate` ใน app.js (admin.js เรียกได้เพราะโหลดทีหลัง) · style `.vc-*`/`.vac-p-*` (app.css)
- **ภาพรวมทีม = บล็อกรายคน (`.vac-p`) ห้ามเปลี่ยนกลับเป็น `<table class="tbl">`** — ลองแล้วบนจอ 430px เห็นแค่ 2 จาก 4 คอลัมน์ ต้องลากขวา (บทเรียนเดียวกับการ์ดเวรกลางคืน v28) และคอลัมน์จะงอกทุกครั้งที่แอดมินเพิ่มชนิดวัคซีน · เรียง **คนที่มีปัญหาขึ้นก่อน** (bad→warn→ที่เหลือ) ด้วย `rank()` ฝั่ง client ไม่งั้นต้องไถหา 🔴 เอง
- **ปุ่ม "แก้" ในแท็บชนิดวัคซีนหยิบค่าจาก `this.vacTypeList`** ไม่ยัดชื่อลง onclick — `esc()` แปลง `'` เป็น `&#39;` แล้ว HTML parser คืนกลับ จะทำ JS string พัง
- ข้อจำกัดที่ยอมรับ: `strtotime('+N months')` ล้นเดือน (31 ม.ค. +1 เดือน = 3 มี.ค.) คลาดได้ 1-3 วัน — ไม่สำคัญกับวันครบรอบวัคซีน
- migration: probe `vaccine_types` (42S02→schema.sql) — ตารางใหม่ล้วน ไม่ต้อง ALTER
