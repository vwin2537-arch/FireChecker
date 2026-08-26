# เช็คชื่อนอกสถานที่ (ทั้งสถานี + รายคน)

> แยกจาก CLAUDE.md (26 ส.ค. 2026) เพื่อคุมขนาด context — CLAUDE.md เก็บแค่กฎเหล็ก + ดัชนี

## โหมดเช็คชื่อนอกสถานที่ (offsite — `offsite_days` + attendance.php/admin.php, v25)

แอดมินตั้งวันล่วงหน้าที่สั่ง จนท.ไปกิจกรรมนอกสถานี → วันนั้นทุกคนเช็คจากที่ไหนก็ได้ (ข้าม GPS) เช็คในช่วงเวลาที่ตั้ง = ไม่นับสาย

- **ตาราง `offsite_days`** (global รายวัน ไม่ผูก user): `off_date UNIQUE`, `start_time`/`end_time` เก็บ **VARCHAR(5) "HH:MM"** (ให้ตรง pattern เวลาอื่นทั้งระบบ ไหลผ่าน `hm_to_min()` + regex เดียวกัน — ไม่ใช้ TIME เพราะจะได้ ":ss" กลับมา), `reason`. helper `offsite_for($date)` คืน row/null (คล้าย `is_station_holiday`)
- **`h_checkin` แทรก 4 จุดผ่านตัวแปร `$offsite = offsite_for($today)`:** (1) block วันหยุด `&& !$offsite` (offsite ทะลุได้ แม้ตรงวันอาทิตย์) (2) เวลาเปิด → `$offsite['start_time']` แทน `checkin_open` (3) **GPS `if (!$offsite && gps_enforce)`** ข้ามบังคับรัศมี แต่ยังคำนวณ/เก็บ `distance_m` ไว้ดูว่าเช็คจากที่ไหน (4) คิดสาย → `end_time` แทน `late_cutoff` (offsite ไม่ยกเว้นเวรกลางคืน — คนละบริบท)
- **แอดมินจัดการในหน้าตั้งค่า** — การ์ด "📍 วันเช็คชื่อนอกสถานที่", handler แยก `offsite_list/add/del` (**ไม่ผ่าน `settings_save`** เพราะเป็น record รายวันไม่ใช่ key-value). `h_offsite_add` validate วันที่ + start<end (regex `HH:MM`) + กันวันย้อนหลัง, `ON DUPLICATE KEY` แก้วันเดิมทับได้. list โหลด async ท้าย `vSettings` ผ่าน `Admin.offsiteRefresh()` (pattern เดียวกับ `gdriveRefreshStatus`)
- **client:** `h_app_data` ส่ง `today.offsite` (row/null) → `app.js` (1) `doCheckin` ข้าม block ตอน GPS fail ด้วย `&& !this.data.today.offsite` (2) `startClock` คุมปุ่มด้วย `start/end` ของวันนั้น (ไม่งั้นปุ่ม disabled จนถึง `checkin_open`) (3) banner เขียวหน้า Home + clock-note บอกช่วงเวลา
- migration: probe `offsite_days` (42S02→schema.sql) — ตารางใหม่ล้วน ไม่ต้อง ALTER

## อนุญาตเช็คนอกสถานที่รายคน (v30 — `offsite_users` + attendance.php/admin.php)

เจาะรายบุคคล เช่น ได้รับคำสั่งไปประชุม/ราชการ — คนนั้นเช็คจากที่ไหนก็ได้เฉพาะวันที่ตั้ง. **แยกจาก `offsite_days` เดิม (ทั้งสถานี) เก็บคู่กัน**

- **ตาราง `offsite_users`** (`user_id`+`off_date` UNIQUE, `reason`, `no_late`) — แตกช่วงวันเป็น **row ต่อคน/วัน** ตอน insert (ลบ/query ราย row ง่าย). helper `offsite_user_for($uid,$date)` คืน row/null
- **ต่างจาก offsite_days (ทั้งสถานี) ตรง scope เวลา:** per-user = **ข้าม GPS อย่างเดียว** เวลาเปิด+คิดสาย = กฎสถานีปกติ (offsite_days override ทั้ง start/end+late). ใน `h_checkin`: `$offsiteUser` เพิ่มเงื่อนไขข้าม GPS `if (!$offsite && !$offsiteUser && gps_enforce)` เท่านั้น — เวลา/สาย ไหลผ่าน branch ปกติเอง (`!$isHoliday`). **ยังคำนวณ+เก็บ `distance_m`/lat/lng ไว้ดูว่าเช็คจากที่ไหน** (โปร่งใส แม้ข้าม radius)
- **`no_late` (default on ฝั่ง UI):** วันไปราชการไม่นับสาย — `h_checkin` หลังคิดสายปกติแล้ว `if ($offsiteUser && no_late) $late = 0`. กันคนไปประชุมเช้า (เช็คจากที่ประชุม 9-10 โมง) โดนนับสาย + ไม่ให้ไปโผล่สายในรายงานความขยัน v29. **ปุ่ม/clock-note ฝั่ง จนท. (`startClock`) ต้องเช็ค `no_late` ด้วย** ไม่งั้น sub ปุ่มเตือน "จะนับสาย" ทั้งที่ไม่นับ
- **ไม่ยุ่งกฎวันอาทิตย์** (ต่างจาก offsite_days ที่ทะลุวันหยุด) — per-user ใช้วันทำงานปกติ; ถ้าประชุมตรงอาทิตย์ใช้ `sunday_work` แยก (row offsite_user วันอาทิตย์ = inert)
- **แอดมิน:** การ์ด "🧍 อนุญาตเช็คนอกสถานที่ (รายคน)" ในหน้าตั้งค่า — เลือกคนหลายคน (checkbox chips จาก `users_list`) + ช่วงวัน + เหตุผล + checkbox `no_late`. handler `offsite_user_list/add/del` (**ไม่ผ่าน settings_save**). `add` รับ `user_ids[]`+`start_date`+`end_date`+`no_late`, validate staff active + วันไม่ย้อนหลัง + ช่วง ≤62 วัน, **แจ้งเข้ากล่องข้อความ (`notify_push` type announcement) 1 ครั้ง/คน/ช่วง**
- **client:** `h_app_data` ส่ง `today.offsite_user` (row/null) → app.js banner หน้า Home + `doCheckin` ข้าม GPS-fail block ด้วย `&& !offsite_user` + `startClock`/clock-note เช็ค `no_late`. การ์ดแอดมิน `offsiteUserRefresh/Add/Del` (admin.js), style `.osu-*` (app.css)
- migration: probe `offsite_users` (42S02→schema) + guarded ALTER `no_late` (probe information_schema — DB ที่สร้างตารางก่อนมี no_late) — pattern เดียวกับ gender/birthdate
