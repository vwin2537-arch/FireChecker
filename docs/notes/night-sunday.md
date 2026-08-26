# เวรกลางคืน + เวรวันอาทิตย์

> แยกจาก CLAUDE.md (26 ส.ค. 2026) เพื่อคุมขนาด context — CLAUDE.md เก็บแค่กฎเหล็ก + ดัชนี

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
