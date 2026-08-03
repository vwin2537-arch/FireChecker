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

- **เช็คอิน iOS (`doCheckin` app.js):** ต้อง `captureSelfie()` (เปิดกล้อง) **ก่อน** `await getPosition()` เสมอ — iOS/WebKit บังคับ file-input `.click()` อยู่ในจังหวะกดสด (transient user-activation) ถ้ามี `await` คั่นก่อน กล้องจะไม่เปิด ค้างเงียบ ไม่มี timeout ปุ่มค้าง disabled (Chrome iOS เจอด้วย = WebKit เดียวกัน) — flow ถูก: เซลฟี่ → GPS → ยืนยัน, ห่อ try/finally ปลดล็อกปุ่มเสมอ → ดู PROGRESS lesson 10
- **สถานะรายวัน** คำนวณสดใน `roster_for()` (admin.php): มี attendance → ontime/late, มี day_off → leave, ไม่มีทั้งคู่ → absent
- **วันอาทิตย์** = วันหยุดสถานี (`is_station_holiday`) — ไม่นับ absent, จอง day_off ไม่ได้, cron ไม่ส่งรายงาน
- **โควต้า** นับเฉพาะ `type='dayoff'` — ลาป่วย/ลากิจไม่นับ; **โควต้ารายเดือน = จำนวนวันหยุดสถานีของเดือนนั้น (อาทิตย์ + นักขัตฯวันธรรมดา) คำนวณสดด้วย `station_holidays_in_month()` — ไม่ใช่เลขคงที่แล้ว** (setting `off_quota_month` เลิกใช้). เกินโควต้า = `over_quota=1` + **status pending รอหัวหน้าอนุมัติเสมอ** (ไม่ auto-approve) → เด้ง alert + คิวอนุมัติหน้าแอดมิน
- **Engagement Score 2 โหมด** ตาม `checkout_enabled`: ปิด = มา60+ตรง40, เปิด = 30/30/20/20 — วันลาถูกตัดออกจากตัวหาร (ไม่หักคะแนน)
- attendance/day_offs มี **UNIQUE (user_id, วันที่)** — insert ซ้ำจะ throw, เช็คก่อน insert แล้ว
- รูปเก็บที่ `UPLOAD_DIR` (Railway = Volume `/data/uploads`) เสิร์ฟผ่าน `photo.php` เท่านั้น (ต้อง login, กัน path traversal ด้วย regex)
- LINE report กันส่งซ้ำด้วยตาราง `line_logs` unique (type, date) — ปุ่มทดสอบในหน้าตั้งค่าใช้ `force=1`

## ระบบอนุมัติลา (เฟส 2 — dayoffs.php + line.php)

- **วันหยุดนักขัตฤกษ์ (`public_holidays` — v32):** แอดมินกรอกเองในหน้าตั้งค่า (การ์ด 🎌 handler `holiday_list/add/del` แยกจาก settings_save). `is_station_holiday()` (helpers.php) เช็ค **อาทิตย์ OR อยู่ใน `holiday_set()`** (cache ต่อ request) → วันนักขัตฯ = หยุดสถานีทุกที่อัตโนมัติ (ไม่นับขาด/ไม่ส่งรายงาน/เช็คชื่อไม่ได้/ตัดจากตัวหารคะแนน). โควต้าเดือน = `station_holidays_in_month($ym)` (loop นับ is_station_holiday, memoized). seed `seed_public_holidays()` guarded (count==0, future-only). **แก้ที่ `is_station_holiday` ที่เดียว propagate ทุกที่** — อย่าใส่ DB query ในลูปรายวัน (ใช้ holiday_set cache)
- **`day_offs.status`** ENUM('pending','approved') default approved — เพิ่มภายหลังผ่าน guarded ALTER ใน `ensure_admin` (probe information_schema; prod DB เก่า backfill row เดิม = approved). `line_queue` ก็ ensure แบบเดียวกัน
- **เส้นแบ่งอนุมัติ นิยามครั้งเดียวใน dayoffs.php (ห้าม hardcode ที่อื่น):** `leave_still_pending($off)` = `$off >= วันนี้+2` → pending (ปฏิเสธได้) / ต่ำกว่า = อนุมัติอัตโนมัติ ("00:00 ของวันก่อนวันลา") ปฏิเสธไม่ได้ — ใช้ทั้ง insert-status, `leave_auto_approve()`, reject-guard
- **กฎยื่น (staff, h_dayoff_add):** ลากิจต้องล่วงหน้า ≥2 วัน / ลาป่วยวันนี้+ย้อนหลัง = approved ทันที, ล่วงหน้า ≥2 วัน = pending / **dayoff ในโควต้า = approved ทันที, เกินโควต้า = pending รออนุมัติเสมอ** (ตั้ง `$status='pending'` ตอน `$isOver`; `leave_auto_approve` มี `AND over_quota=0` กันไม่ให้ flip; reject guard ยกเว้น over_quota = ปฏิเสธได้ทุกวันไม่ติด deadline) / **ลาป่วย+ลากิจ บังคับใส่ note** (dayoff ไม่บังคับ). **แอดมินบันทึกลาแทน (dayoff_admin_add) = approved เสมอ แม้เกินโควต้า**
- **reject = ลบ row ทิ้ง** (ขอใหม่วันเดิมได้ เลี่ยง UNIQUE) ไม่มีสถานะ rejected — **roster ไม่ต้องเช็ค status** (pending+approved นับ leave เหมือนกัน)
- **`leave_auto_approve()`** flip pending→approved เมื่อเลย deadline — เรียกใน `run_line_report` (ก่อน Sunday-skip), `h_admin_data`, ต้นทาง approve/reject handlers
- **แจ้ง LINE แบบ async ผ่าน `line_queue` + `cron/line_worker.php`** (pattern เดียวกับ drive — `line_enqueue()` insert แล้วแตก worker, ห้าม push คาใน request): จนท.ยื่น sick/personal / จนท.ยกเลิก sick/personal / แอดมิน approve — **dayoff เงียบ เว้นเกินโควต้า** (over_quota dayoff แจ้ง LINE "ขอใช้วันหยุดเกินโควต้า" เพราะต้องรออนุมัติ; dayoff ในโควต้ายังเงียบ). รายงานเช้า/เย็นแนบ pending อัตโนมัติ (`report_pending_leaves`)
- badge/หน้าอนุมัติ: `admin_data.pending_leaves` (แดชบอร์ด alert) + การ์ดในแท็บวันหยุดแอดมิน (`leave_pending` → `Admin.leaveAct`)

## ระบบเวรกลางคืน + เวรวันอาทิตย์ (เฟส 6 — attendance.php)

- **เวรกลางคืน = ตาราง `night_shifts` แยกต่างหาก** (ไม่ยัดใน `attendance` เพราะ attendance UNIQUE วันละครั้ง + semantic เข้าแถวเช้า) — `h_night_checkin` เฉพาะ `gender='male'` + สวิตช์ `night_shift_enabled` + เวลา ≥ `night_checkin_open`(18:00) + กันซ้ำ (UNIQUE user+duty_date) + reuse GPS/เซลฟี่/`gdrive_enqueue` จาก h_checkin
- **`tonight_duty_date()` (นิยามครั้งเดียวใน attendance.php):** duty_date = วันนี้ ปกติ / **ถ้าเวลา < 06:00 = เมื่อวาน** (คนกดหลังเที่ยงคืนถือเป็นเวรคืนที่แล้ว) — ใช้ทั้งตอนลงเวรและ `h_app_data.today.night`
- **ยกเว้นสายเช้าถัดมา:** `h_checkin` ถ้า late แล้วมี `night_shifts` `duty_date = เมื่อวาน (today-1)` → late=0 + `exempted=true` (ครอบคลุมคืนวันอาทิตย์ด้วย เพราะ key ที่ duty_date). **ไม่ persist flag exempted** — attendance เก็บแค่ late=0, ข้อความแจ้งตอน response เท่านั้น
- **วันที่อยู่เวร กลางวันทำงานปกติ** (เช็คชื่อ 8 โมง) — ระบบไม่แตะสถานะกลางวัน (เวร = ของแถมตอนเย็น)
- **วันอาทิตย์ reuse `attendance`** (ไม่ใช่ตารางใหม่): `h_checkin` ถ้า `is_station_holiday` + `sunday_work_enabled` → เช็คได้ (ข้ามเวลาเปิด, บังคับ late=0, รับ `note`). ทั้งชาย/หญิง หลายคน — `sunday_off` ยังคุมว่าวันอาทิตย์เป็นวันหยุด (ไม่นับขาด/จองลาไม่ได้) เหมือนเดิม
- **แดชบอร์ดวันอาทิตย์:** `h_admin_data` เดิม roster ว่าง (`$isHoliday ? []`) → เพิ่ม `today.holiday_workers` (คนเช็คชื่อวันหยุด) + `night_stats` (COUNT ต่อคนเดือนนี้ — ดูความเป็นธรรมหมุนเวร) แสดงทั้งวันปกติ/วันหยุด
- **เพศ `users.gender ENUM('male','female') NULL`** — NULL = ยังไม่ระบุ (row เก่าหลัง migrate). ปุ่มลงเวรกลางคืนโชว์เฉพาะ `user.gender==='male'` ฝั่ง client + backend กันซ้ำ (หญิง/NULL = fail คนละข้อความ). **Rollout: แอดมินต้องตั้งเพศ จนท.เดิมก่อน** ไม่งั้นไม่มีใครลงเวรได้
- **Migration guarded (ensure_admin):** probe `night_shifts` (42S02→schema.sql, พ่วง re-add 3 settings ใหม่) + ALTER `users.gender`/`attendance.note` (probe information_schema) — pattern เดียวกับ `day_offs.status`
- **3 settings:** `night_shift_enabled`/`sunday_work_enabled` (bool) + `night_checkin_open` (time) — อยู่ใน EDITABLE_SETTINGS + validation h_settings_save + client_settings

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

## Google Drive selfie sync (สำเนารูปเช็คอินขึ้น Drive)

- **ไฟล์:** `app/drive.php` (ท่อ Drive + คิว + OAuth handlers `h_gdrive_*`), `public/oauth.php` (OAuth callback — ไม่มี auth header พึ่ง `gdrive_oauth_state` ที่หมดอายุ 10 นาที กัน CSRF)
- **flow:** `h_checkin` เซฟรูปลง Volume แล้วเรียก `gdrive_enqueue()` (insert `drive_queue` + แตกโปรเซส worker `cron/drive.php` ผ่าน `gdrive_spawn_worker()` ไม่แตะ network) → เช็คอินตอบทันที → worker อัปโหลดเบื้องหลัง
- **retry:** `gdrive_process_queue()` อัปโหลดทีละ ≤3 รายการ, fail → `tries+1` (เพดาน 30 → status `error`); worker `cron/drive.php` มี `flock` กันรันซ้อน; `gdrive_kick_if_stale()` ใน `h_app_data`+`h_admin_data` แตก worker ไล่คิวค้างถ้าห่างรอบก่อน >60 วิ (throttle ด้วย `gdrive_last_run`)
- **⚠️ อย่ารัน curl คาใน request** — เดิมใช้ `after_response()` (helpers.php) ปิด connection ด้วย `Content-Length`+`Connection: close`+`fastcgi_finish_request()` แต่ **`fastcgi_finish_request()` ไม่มีบน Apache mod_php** (prod เป็น `php:8.3-apache` prefork) จึง**เลิกใช้ เปลี่ยนเป็นแตกโปรเซส CLI แยก** (`nohup php cron/drive.php &`) — ถ้า server ปิด `exec` → `gdrive_enqueue` fallback อัป inline สั้นๆ (`after_response` ยังอยู่ใน helpers แต่ไม่มีใครเรียกแล้ว)
- **scope `drive.file`** = แอปเห็นเฉพาะไฟล์/โฟลเดอร์ที่ตัวเองสร้าง → สร้างโฟลเดอร์ราก "รูปเช็คชื่อสถานีไฟป่า" เอง (id เก็บใน `gdrive_root_id`) แล้วให้พี่วินลากไปวางเอง — **เข้าถึงโฟลเดอร์ที่ผู้ใช้มีอยู่ก่อนไม่ได้** (ตั้งใจ แลกกับความปลอดภัย + ไม่ติด verification)
- **โฟลเดอร์รายวัน** ชื่อปี พ.ศ. `2569-mm-dd` (cache id วันละครั้งใน `gdrive_day_cache`); ชื่อไฟล์ `Hi_ชื่อจริง.jpg`
- **settings ที่เกี่ยว (ห้าม hardcode):** `gdrive_client_id`/`gdrive_client_secret` (แอดมินกรอก, อยู่ใน EDITABLE_SETTINGS), `gdrive_refresh_token`/`gdrive_access_token`/`gdrive_access_exp`/`gdrive_root_id`/`gdrive_day_cache`/`gdrive_oauth_state`/`gdrive_last_run` (ระบบเซ็ตเอง) — เหมือน LINE token ไม่อยู่ในโค้ด
- **OAuth setup:** แอดมินทำครั้งเดียวตามคู่มือ `SETUP_GDRIVE.md` — ต้อง Publish App + Enable Drive API มิฉะนั้นพัง (ดู PROGRESS lesson 7)

## โหมดเช็คชื่อนอกสถานที่ (offsite — `offsite_days` + attendance.php/admin.php, v25)

แอดมินตั้งวันล่วงหน้าที่สั่ง จนท.ไปกิจกรรมนอกสถานี → วันนั้นทุกคนเช็คจากที่ไหนก็ได้ (ข้าม GPS) เช็คในช่วงเวลาที่ตั้ง = ไม่นับสาย

- **ตาราง `offsite_days`** (global รายวัน ไม่ผูก user): `off_date UNIQUE`, `start_time`/`end_time` เก็บ **VARCHAR(5) "HH:MM"** (ให้ตรง pattern เวลาอื่นทั้งระบบ ไหลผ่าน `hm_to_min()` + regex เดียวกัน — ไม่ใช้ TIME เพราะจะได้ ":ss" กลับมา), `reason`. helper `offsite_for($date)` คืน row/null (คล้าย `is_station_holiday`)
- **`h_checkin` แทรก 4 จุดผ่านตัวแปร `$offsite = offsite_for($today)`:** (1) block วันหยุด `&& !$offsite` (offsite ทะลุได้ แม้ตรงวันอาทิตย์) (2) เวลาเปิด → `$offsite['start_time']` แทน `checkin_open` (3) **GPS `if (!$offsite && gps_enforce)`** ข้ามบังคับรัศมี แต่ยังคำนวณ/เก็บ `distance_m` ไว้ดูว่าเช็คจากที่ไหน (4) คิดสาย → `end_time` แทน `late_cutoff` (offsite ไม่ยกเว้นเวรกลางคืน — คนละบริบท)
- **แอดมินจัดการในหน้าตั้งค่า** — การ์ด "📍 วันเช็คชื่อนอกสถานที่", handler แยก `offsite_list/add/del` (**ไม่ผ่าน `settings_save`** เพราะเป็น record รายวันไม่ใช่ key-value). `h_offsite_add` validate วันที่ + start<end (regex `HH:MM`) + กันวันย้อนหลัง, `ON DUPLICATE KEY` แก้วันเดิมทับได้. list โหลด async ท้าย `vSettings` ผ่าน `Admin.offsiteRefresh()` (pattern เดียวกับ `gdriveRefreshStatus`)
- **client:** `h_app_data` ส่ง `today.offsite` (row/null) → `app.js` (1) `doCheckin` ข้าม block ตอน GPS fail ด้วย `&& !this.data.today.offsite` (2) `startClock` คุมปุ่มด้วย `start/end` ของวันนั้น (ไม่งั้นปุ่ม disabled จนถึง `checkin_open`) (3) banner เขียวหน้า Home + clock-note บอกช่วงเวลา
- migration: probe `offsite_days` (42S02→schema.sql) — ตารางใหม่ล้วน ไม่ต้อง ALTER

## กล่องข้อความ / Mailbox (v26 — `app/handlers/notify.php`)

กล่องข้อความฝั่งเจ้าหน้าที่ — จุดแดงเตือนข้อความใหม่ เปิดอ่านแล้วจุดหาย + แดชบอร์ดแอดมิน "คืนนี้ใครเข้าเวร"

- **ตาราง `notifications` = 1 แถว/คน/ข้อความ** (`user_id`, `type` ENUM announcement/leave_approved/leave_rejected, `title`, `body`, `read_at` NULL=ยังไม่อ่าน). broadcast = fan-out insert หลายแถว (ไม่ใช้ join-table แบบ library เพราะต้องรองรับข้อความเจาะจงคน). `notify_push()` คนเดียว / `notify_broadcast()` staff active ทุกคน / `notify_unread_count()` นับจุดแดง
- **จุดแดง = `notif_unread` ใน `h_app_data`** (COUNT read_at IS NULL). **เปิดกล่อง `h_notify_list` อ่าน is_new (read_at===null) ก่อน แล้วค่อย UPDATE read_at=NOW() ทั้งหมด** (ลำดับสำคัญ ไม่งั้น is_new เพี้ยน) → จุดหายจนกว่ามีข้อความใหม่. client เซ็ต `notif_unread=0` + `paintMailDot()` ทันทีหลังเปิด
- **3 อย่างที่เด้งเข้ากล่อง:** (ก) **ประกาศ** หัวหน้าโพสต์ผ่านการ์ด "📢 ประกาศถึงเจ้าหน้าที่" **บนสุดของเมนูตั้งค่า** (`h_announce_send` → broadcast) — annTitle/annBody ไม่ใช่ `st_` prefix เลยไม่โดน settings_save กวาด (ข) **อนุมัติลา** `notify_push` ใน `h_leave_approve` **เท่านั้น** (ค) **ไม่อนุมัติลา** `notify_push` ใน `h_leave_reject` **ก่อน DELETE row** (snapshot วันที่+ประเภทลง body เพราะ ref จะ dangle)
- **⚠️ ห้าม hook `notify_push` เข้า `leave_auto_approve()`** — ฟังก์ชันนั้นถูกเรียกจาก h_admin_data/cron/report/insert = จะ spam ทุกที่. แจ้งเฉพาะตอนหัวหน้ากดเอง (ลาที่อนุมัติอัตโนมัติตอนเลย deadline **ไม่เด้ง** ตั้งใจ)
- **ลำดับการ์ดแดชบอร์ด (v27):** การ์ดเวรกลางคืน (คืนนี้ + เดือนนี้) อยู่**เหนือ**ตารางคะแนน (อันดับความขยัน) ใน `analyticsHtml`. การ์ดประกาศย้ายออกไปเมนูตั้งค่าแล้ว (ไม่อยู่แดชบอร์ด)
- **แดชบอร์ด "🌙 เข้าเวรกลางคืน (คืนนี้)":** `h_admin_data` ส่ง `night_tonight` (รายชื่อ+เวลา ของ `tonight_duty_date()`) + `night_tonight_date`. มี date picker เลือกย้อนวันได้ → `h_night_roster` (param `date`, default คืนนี้) — คู่กับการ์ด night_stats (จำนวนคืน/คน) เดิม
- **client:** ไอคอน 📬 ใน `.t-right` topbar staff (`App.openMailbox()` + `.mail-dot`), popup ผ่าน Swal. admin.js `announceHtml`/`nightTonightHtml`/`nightRosterLoad` อยู่ใน `analyticsHtml` (โชว์ทั้งวันปกติ/วันหยุด). style `.mbox*`/`.mail-*`/`.nr-date` (app.css)
- migration: probe `notifications` (42S02→schema.sql) — ตารางใหม่ล้วน ไม่ต้อง ALTER

## แต่งหน้าแดชบอร์ด/ปฏิทิน (v28 — admin.js/admin.php/app.css)

- **การ์ด "🌙 เวรกลางคืนเดือนนี้":** `night_stats` query เพิ่ม `GROUP_CONCAT(DAY(duty_date) ORDER BY duty_date) days` → client เปลี่ยนจาก `<table>` เป็น `.list-row` (ตัด position ออก, ชื่อ + `(days)` ซ้าย, `.night-count` `N คืน` ขวา flex-shrink) — **เลิกใช้ tbl-wrap** เพราะเลื่อนขวาหาคอลัมน์
- **ตารางอันดับความขยัน:** `engagement_ranking` SELECT+ส่ง `birthdate` ต่อคน → client `ageFrom(r.birthdate)` ต่อท้ายชื่อ `(อายุ)` (null=ไม่โชว์). `ageFrom` เป็น global app.js เรียกจาก admin.js ได้
- **ป๊อบอัพวันหยุด (`dayDetail`):** `dayoff_month` ส่ง `note` อยู่แล้ว → แสดง `📝 เหตุผล` ใต้ชื่อ (align-items:flex-start)
- **เค้กวันเกิดในปฏิทินวันหยุด:** `vDayoff` สร้าง `this.aBday` map `MM-DD→[ชื่อ]` จาก `users_list` (scope ตาม "ดูของ" — รายคน/ทุกคน). `heatCells` วาง `.cd-cake` 🎂 มุมซ้ายบน (absolute) + cell คลิกได้ถ้า `n||hasBday`. `dayDetail` prepend รายชื่อวันเกิด (รองรับวันที่มีแต่เกิดไม่มีลา). style `.cd-cake`/`.night-count` (app.css)

## รายงานอันดับความขยันรายเดือน (v29 — admin.php/admin.js/app.css, สำหรับปริ้น/ส่ง LINE)

หัวหน้ากดออกรายงานรายเดือนเป็น**โปสเตอร์** → บันทึกเป็นรูป PNG (ส่ง LINE) หรือปริ้น/บันทึก PDF (แปะบอร์ด)

- **Backend `h_report_month` (admin.php):** reuse `engagement_ranking($ym)` ตรงๆ **ไม่แตะสูตรคะแนน** — เดือนที่ผ่านมาได้ข้อมูลครบทั้งเดือน (`$end = min(today, สิ้นเดือน)` อยู่ในฟังก์ชันเดิม). param `month` "YYYY-MM" default = **เดือนที่แล้ว** (`strtotime('first day of last month')`), กันเดือนอนาคต. คืน `month_label` (ชื่อเดือนไทย+พ.ศ. จาก `thai_month_label()`), `workdays` (นับ `is_station_holiday`), `summary` (รวมทีม: present/ontime/late/absent/leave + `ontime_pct` + `avg_score`). action `report_month` ใน api.php
- **Frontend = overlay ในแอป (ไม่ใช่หน้าแยก)** — เลือกทำแบบ overlay เพราะพี่วินใช้**ทั้งมือถือ+คอม**: หน้าแยก/แท็บใหม่บน iOS PWA อ่าน `fc_token` จาก localStorage ไม่เจอ (คนละ storage jar) → รายงานโหลดไม่ขึ้น. overlay อยู่ใน SPA เดิม token พร้อมเสมอ. `Admin.openReport/reportLoad/reportPaperHtml/reportSave/reportPrint/reportClose` + helper module-level `rpMonthLabel(ym)` (`TH_MONTHS`)
- **บันทึกรูป = html2canvas** (CDN ใน index.php เหมือน chart.js/sweetalert2) — **เลือกแทน html-to-image** เพราะ html-to-image พ่น console `SecurityError` อ่าน CSS ฟอนต์ข้าม origin (Google Fonts) แม้ผลออกมาได้; html2canvas เรนเดอร์สะอาดไม่มี error. **พิสูจน์แล้วเรนเดอร์ไทย(สระ/วรรณยุกต์ ษ์ ั่)+เหรียญ emoji สีถูกทั้ง Chromium และ WebKit(=iPhone)** — `scale:2.5`, `await document.fonts.ready` ก่อน capture, `canvas.toBlob → a[download]`
- **ปริ้น = `@media print` + คลาส `body.rpt-printing`** (toggle ตอน `reportPrint()`): ซ่อน `#app` (`body.rpt-printing > *:not(#reportOverlay)`) + ซ่อนทูลบาร์ → เหลือแต่ `.rpt-paper` เต็มหน้า A4. paper กว้างคงที่ 800px (`-webkit-print-color-adjust:exact` กันพื้นเขียวหาย). style `.rpt-*`/`.rp-*` (app.css)
- **โทนบวก** — ไม่มีแถบแดงประจานคนสาย/ขาด (ตามที่พี่วินเลือก). คนที่ไม่เคยเช็คชื่อ (score=null/0) จมท้ายตาราง อันดับโชว์ `—` ถ้า score null
- migration: ไม่มี (ใช้ตาราง/คอลัมน์เดิมล้วน)

## อนุญาตเช็คนอกสถานที่รายคน (v30 — `offsite_users` + attendance.php/admin.php)

เจาะรายบุคคล เช่น ได้รับคำสั่งไปประชุม/ราชการ — คนนั้นเช็คจากที่ไหนก็ได้เฉพาะวันที่ตั้ง. **แยกจาก `offsite_days` เดิม (ทั้งสถานี) เก็บคู่กัน**

- **ตาราง `offsite_users`** (`user_id`+`off_date` UNIQUE, `reason`, `no_late`) — แตกช่วงวันเป็น **row ต่อคน/วัน** ตอน insert (ลบ/query ราย row ง่าย). helper `offsite_user_for($uid,$date)` คืน row/null
- **ต่างจาก offsite_days (ทั้งสถานี) ตรง scope เวลา:** per-user = **ข้าม GPS อย่างเดียว** เวลาเปิด+คิดสาย = กฎสถานีปกติ (offsite_days override ทั้ง start/end+late). ใน `h_checkin`: `$offsiteUser` เพิ่มเงื่อนไขข้าม GPS `if (!$offsite && !$offsiteUser && gps_enforce)` เท่านั้น — เวลา/สาย ไหลผ่าน branch ปกติเอง (`!$isHoliday`). **ยังคำนวณ+เก็บ `distance_m`/lat/lng ไว้ดูว่าเช็คจากที่ไหน** (โปร่งใส แม้ข้าม radius)
- **`no_late` (default on ฝั่ง UI):** วันไปราชการไม่นับสาย — `h_checkin` หลังคิดสายปกติแล้ว `if ($offsiteUser && no_late) $late = 0`. กันคนไปประชุมเช้า (เช็คจากที่ประชุม 9-10 โมง) โดนนับสาย + ไม่ให้ไปโผล่สายในรายงานความขยัน v29. **ปุ่ม/clock-note ฝั่ง จนท. (`startClock`) ต้องเช็ค `no_late` ด้วย** ไม่งั้น sub ปุ่มเตือน "จะนับสาย" ทั้งที่ไม่นับ
- **ไม่ยุ่งกฎวันอาทิตย์** (ต่างจาก offsite_days ที่ทะลุวันหยุด) — per-user ใช้วันทำงานปกติ; ถ้าประชุมตรงอาทิตย์ใช้ `sunday_work` แยก (row offsite_user วันอาทิตย์ = inert)
- **แอดมิน:** การ์ด "🧍 อนุญาตเช็คนอกสถานที่ (รายคน)" ในหน้าตั้งค่า — เลือกคนหลายคน (checkbox chips จาก `users_list`) + ช่วงวัน + เหตุผล + checkbox `no_late`. handler `offsite_user_list/add/del` (**ไม่ผ่าน settings_save**). `add` รับ `user_ids[]`+`start_date`+`end_date`+`no_late`, validate staff active + วันไม่ย้อนหลัง + ช่วง ≤62 วัน, **แจ้งเข้ากล่องข้อความ (`notify_push` type announcement) 1 ครั้ง/คน/ช่วง**
- **client:** `h_app_data` ส่ง `today.offsite_user` (row/null) → app.js banner หน้า Home + `doCheckin` ข้าม GPS-fail block ด้วย `&& !offsite_user` + `startClock`/clock-note เช็ค `no_late`. การ์ดแอดมิน `offsiteUserRefresh/Add/Del` (admin.js), style `.osu-*` (app.css)
- migration: probe `offsite_users` (42S02→schema) + guarded ALTER `no_late` (probe information_schema — DB ที่สร้างตารางก่อนมี no_late) — pattern เดียวกับ gender/birthdate

## Deploy

Railway + Dockerfile (ดูขั้นตอนละเอียดใน README.md) — env ที่ต้องมี: ตัวแปร MySQL (reference), `CRON_SECRET`, `UPLOAD_DIR=/data/uploads` + Volume ที่ `/data`

**⚠️ push GitHub ไม่ auto-deploy** — repo เป็น source control อย่างเดียว ไม่ได้ผูก webhook ต้อง deploy tarball เอง: `railway up` หรือ MCP `deploy` (`path=firecheck/`, service `8a5f15ef-d377-4437-80aa-b0fc0775d087`) ทุก deployment คอลัมน์ commit เป็น `-` เพราะเป็น tarball upload ไม่ใช่ GitHub-triggered — verify live ด้วย `curl https://sakpra-erawan.up.railway.app/index.php` ทุกครั้ง — ถ้า MCP `deploy`/`whoami` ค้าง `Unauthorized` (auth คนละชุดกับ CLI) ให้ใช้ `railway up` ตรงๆ ในเทอร์มินัลแทนได้เลย ไม่ต้อง re-login

**⚠️ Cache-bust ตอนแก้ frontend** — `sw.js` เก็บ `assets/*` แบบ cache-first PWA ที่ติดตั้งแล้วจะเห็นของเก่าถ้าไม่เด้ง version ต้องแก้ **พร้อมกัน 2 ที่**: `?v=N` ใน `index.php` (css+js+admin.js) **และ** `const CACHE = 'firecheck-vN'` + ASSETS `?v=N` ใน `sw.js` (activate จะล้าง cache เก่าให้). **`index.php` มี PHP `header('Cache-Control: no-cache')` ต้นไฟล์** (เพิ่ม v23) กัน iOS PWA standalone ค้าง HTML shell เก่าที่ยังชี้ไป asset เก่า → วนงูกินหาง (เจอจริง: บั๊ก UI ที่ hard-refresh แล้วไม่หาย มักเป็น**โค้ดค้าง/โค้ดซ้ำ 2 ที่** ไม่ใช่ cache — เช่น `devSegHtml` มีทั้งใน app.js (staff) และ admin.js (admin) แก้ที่เดียวไม่พอ)

**Live:** https://sakpra-erawan.up.railway.app — Railway project "firecheck" (`0490e262-abfe-49c6-bd47-81cdd12ed7d1`), service `firecheck-app` + `MySQL` + Volume `/data` (domain renamed from the default `firecheck-app-production.up.railway.app` for staff usability; `firecheck.up.railway.app` was already taken by someone else)

**⚠️ Dockerfile CMD ห้ามย้าย `rm -f mpm_event.*` กลับไปเป็น build-time RUN** — เจอบั๊กจริงบน Railway: ไฟล์ที่ลบใน Docker build layer (RUN) ไม่ persist มาถึง container ตอนรันจริง (`mpm_event.load` กลับมาเป็นของ base image เดิมทุกครั้ง แม้ build log ยืนยันว่าลบสำเร็จ) ทำให้ Apache crash loop ด้วย `AH00534: More than one MPM loaded` ทางแก้ที่ใช้ได้จริงคือลบใน `CMD` (runtime, writable fs) เท่านั้น — ดู Dockerfile ปัจจุบัน

**⚠️ Volume ต้อง chown ให้ www-data ใน CMD (runtime)** — `/data/uploads` ตอน Volume mount เป็นของ root แต่ Apache รันเป็น www-data → `save_photo()` mkdir ไม่ได้ = Permission denied → selfie เซฟไม่ได้เลย ต้อง `mkdir -p "$UPLOAD_DIR" && chown -R www-data:www-data "$UPLOAD_DIR"` ใน `CMD` (runtime เพราะ Volume mount ตอน runtime เหมือนบั๊ก mpm) — ดู PROGRESS lesson 8

**⚠️ display_errors ต้อง Off บน prod** — base image เปิด display_errors → PHP warning ใดๆ ถูกพ่นหน้า JSON body → `res.json()` พังฝั่ง client = **"การเชื่อมต่อขัดข้อง"** (สัญญาณ: HTTP ยัง 200 แต่ content-type กลายเป็น `text/html` + body ขึ้นต้น `<br>`) ตั้ง `display_errors=Off`+`log_errors=On` ใน `firecheck.ini` (warning ไปลง Railway deploy log แทน) — ดู PROGRESS lesson 8

**⚠️ MySQL บน Railway เป็น UTC** — SQL `NOW()`/`CURRENT_TIMESTAMP` เก็บเวลา UTC → เวลาเช็คอินเพี้ยน -7 ชม. `db.php` ตั้ง `PDO::MYSQL_ATTR_INIT_COMMAND => "SET time_zone='+07:00'"` ทุกการเชื่อมต่อ (คอลัมน์เวลาเป็น DATETIME ล้วน ไม่มี TIMESTAMP → ตั้ง tz ไม่กระทบค่าที่เก็บไว้แล้ว มีผลเฉพาะ write ใหม่) — ดู PROGRESS lesson 9

## ห้าม commit

`credentials.json`, `token.pkl`, `*.env`, `config.env`, `*.csv` (อยู่ใน .gitignore แล้ว) — LINE token เก็บใน DB ผ่านหน้าตั้งค่า ไม่อยู่ในโค้ด
