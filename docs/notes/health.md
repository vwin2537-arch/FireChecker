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
