# ระบบอนุมัติลา + วันหยุดนักขัตฤกษ์

> แยกจาก CLAUDE.md (26 ส.ค. 2026) เพื่อคุมขนาด context — CLAUDE.md เก็บแค่กฎเหล็ก + ดัชนี

## ระบบอนุมัติลา (เฟส 2 — dayoffs.php + line.php)

- **วันหยุดนักขัตฤกษ์ (`public_holidays` — v32):** แอดมินกรอกเองในหน้าตั้งค่า (การ์ด 🎌 handler `holiday_list/add/del` แยกจาก settings_save). `is_station_holiday()` (helpers.php) เช็ค **อาทิตย์ OR อยู่ใน `holiday_set()`** (cache ต่อ request) → วันนักขัตฯ = หยุดสถานีทุกที่อัตโนมัติ (ไม่นับขาด/ไม่ส่งรายงาน/เช็คชื่อไม่ได้/ตัดจากตัวหารคะแนน). โควต้าเดือน = `station_holidays_in_month($ym)` (loop นับ is_station_holiday, memoized). seed `seed_public_holidays()` guarded (count==0, future-only). **แก้ที่ `is_station_holiday` ที่เดียว propagate ทุกที่** — อย่าใส่ DB query ในลูปรายวัน (ใช้ holiday_set cache)
- **`day_offs.status`** ENUM('pending','approved') default approved — เพิ่มภายหลังผ่าน guarded ALTER ใน `ensure_admin` (probe information_schema; prod DB เก่า backfill row เดิม = approved). `line_queue` ก็ ensure แบบเดียวกัน
- **เส้นแบ่งอนุมัติ นิยามครั้งเดียวใน dayoffs.php (ห้าม hardcode ที่อื่น):** `leave_still_pending($off)` = `$off >= วันนี้+2` → pending (ปฏิเสธได้) / ต่ำกว่า = อนุมัติอัตโนมัติ ("00:00 ของวันก่อนวันลา") ปฏิเสธไม่ได้ — ใช้ทั้ง insert-status, `leave_auto_approve()`, reject-guard
- **กฎยื่น (staff, h_dayoff_add):** ลากิจต้องล่วงหน้า ≥2 วัน / ลาป่วยวันนี้+ย้อนหลัง = approved ทันที, ล่วงหน้า ≥2 วัน = pending / **dayoff ในโควต้า = approved ทันที, เกินโควต้า = pending รออนุมัติเสมอ** (ตั้ง `$status='pending'` ตอน `$isOver`; `leave_auto_approve` มี `AND over_quota=0` กันไม่ให้ flip; reject guard ยกเว้น over_quota = ปฏิเสธได้ทุกวันไม่ติด deadline) / **ลาป่วย+ลากิจ บังคับใส่ note** (dayoff ไม่บังคับ). **แอดมินบันทึกลาแทน (dayoff_admin_add) = approved เสมอ แม้เกินโควต้า**
- **reject = ลบ row ทิ้ง** (ขอใหม่วันเดิมได้ เลี่ยง UNIQUE) ไม่มีสถานะ rejected — **roster ไม่ต้องเช็ค status** (pending+approved นับ leave เหมือนกัน)
- **`leave_auto_approve()`** flip pending→approved เมื่อเลย deadline — เรียกใน `run_line_report` (ก่อน Sunday-skip), `h_admin_data`, ต้นทาง approve/reject handlers
- **แจ้ง LINE แบบ async ผ่าน `line_queue` + `cron/line_worker.php`** (pattern เดียวกับ drive — `line_enqueue()` insert แล้วแตก worker, ห้าม push คาใน request): จนท.ยื่น sick/personal / จนท.ยกเลิก sick/personal / แอดมิน approve — **dayoff เงียบ เว้นเกินโควต้า** (over_quota dayoff แจ้ง LINE "ขอใช้วันหยุดเกินโควต้า" เพราะต้องรออนุมัติ; dayoff ในโควต้ายังเงียบ). รายงานเช้า/เย็นแนบ pending อัตโนมัติ (`report_pending_leaves`)
- badge/หน้าอนุมัติ: `admin_data.pending_leaves` (แดชบอร์ด alert) + การ์ดในแท็บวันหยุดแอดมิน (`leave_pending` → `Admin.leaveAct`)
