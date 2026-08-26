# ประวัติการฝึกอบรม

> แยกจาก CLAUDE.md (26 ส.ค. 2026) เพื่อคุมขนาด context — CLAUDE.md เก็บแค่กฎเหล็ก + ดัชนี

## ประวัติการฝึกอบรม (v35 — `app/handlers/training.php`)

แอดมินสร้าง "การอบรม 1 ครั้ง" แล้วติ๊กชื่อ จนท. ใส่ลงไป · **เจ้าหน้าที่อ่านอย่างเดียว** (pattern เดียวกับการ์ดวัคซีน) · **ไม่มีระบบเตือนวันหมดอายุ/ทบทวน** — เก็บเป็นประวัติล้วน

- **2 ตาราง:** `trainings` (ชื่อ + `start_date`/`end_date` + `place`/`organizer`/`doc_no`(เลขที่หนังสือสั่งการ)/`note`) / `training_attendees` (`UNIQUE (training_id,user_id)` + FK CASCADE ทั้งคู่). **ไม่มี soft delete** (ลบการอบรม = เหตุการณ์นั้นไม่เคยเกิด — ต่างจาก `vaccine_types` ที่ต้องซ่อนแต่เก็บประวัติ) · **ไม่มี seed · ไม่มี setting ใหม่** (ไม่ต้องแตะ `EDITABLE_SETTINGS`/`saveSettings()` — ตัดจุดพลาดคลาสสิกทิ้ง)
- **⚠️ ต้องกรอกวันย้อนหลังได้ — งานหลักคือบันทึกอดีต** `h_training_save` validate แค่ `end >= start` + ช่วง ≤366 วัน **ห้ามลอก `if ($start < date('Y-m-d')) fail('เลือกวันย้อนหลังไม่ได้')` กับ cap 62 วัน จาก `h_offsite_user_add`** มาด้วย (ลอกได้แค่ UI chips `.osu-*`) · อนุญาตวันอนาคตด้วย (บันทึกล่วงหน้าตามหนังสือสั่งการ)
- **⚠️ `h_training_attendees_save` ต้องบันทึกแบบ diff** — อ่านของเดิม → `array_diff` → INSERT เฉพาะ `added` / DELETE เฉพาะ `removed` → **`notify_push` เฉพาะ `added`** (type `announcement` ที่มีใน ENUM อยู่แล้ว ไม่เพิ่มค่าใหม่). **ห้ามลบทั้งชุดแล้ว insert ใหม่** ไม่งั้นแอดมินกดบันทึกซ้ำทีไร จนท.โดนแจ้งซ้ำทุกคน (แก้ข้อมูลการอบรมผ่าน `h_training_save` = ไม่แตะรายชื่อ = ไม่แจ้ง)
- **จนท.ที่ลาออก (`status='inactive'`) — 2 กฎต่างกัน:** chips ติ๊กคนเข้าอบรม = `active` เท่านั้น · dropdown/ประวัติรายคน (`h_training_person`) = **ไม่กรอง status** (ประวัติอดีตต้องเปิดดู/ปริ้นได้) · `h_training_overview` = `active` เท่านั้น ไม่งั้นคนที่ออกไปแล้วค้างในลิสต์ "ยังไม่เคยอบรม" ตลอดกาล
- **`train_date_label()` คิดที่ server ที่เดียว** — "11-15 มี.ค. 2567" / วันเดียว / ข้ามเดือน / ข้ามปี → ทั้งหน้า จนท. หน้าแอดมิน และกระดาษปริ้นใช้ข้อความเดียวกัน (client ไม่คิดเอง)
- **ปริ้น A4 ต้อง reuse `id="reportOverlay"` ตัวเดิมของ v29** — `app.css` มี `body.rpt-printing > *:not(#reportOverlay) { display:none }` **id ถูก hardcode** ถ้าตั้ง id ใหม่จะปริ้นออกมาหน้าขาว. `Admin.trPrintOpen()` สร้าง overlay id เดิม + `#rptPaper` แล้ว **reuse `reportPrint()`/`reportClose()` ตรงๆ → CSS ปริ้นเพิ่ม 0 บรรทัด** (สอง overlay ไม่มีทางเปิดพร้อมกัน) · กระดาษใช้คลาส `.rp-*` เดิม (ในกระดาษ 800px ใช้ `<table>` ได้ ไม่ขัดกฎจอ 430px)
- **client:** staff = sub-tab `🎓 อบรม` ใต้ 📚 พัฒนา (`vTraining`/`renderTraining` ใน app.js) · admin = sub-tab เดียวกัน แตกเป็น 3 sub-view `list|person|overview` (`Admin.vTraining`) — **`devSegHtml` มี 2 ที่ (app.js ~:682 และ admin.js ~:1262) ต้องแก้ทั้งคู่** ไม่งั้นฝั่งหนึ่งไม่มีแท็บ
- **ภาพรวมเรียงคนที่ยังไม่เคยอบรมขึ้นก่อน** (`sort(a.n - b.n)`) และเป็นบล็อก `.list-row`/`.tr-row` **ห้ามเปลี่ยนเป็น `<table class="tbl">`** (บทเรียนเดียวกับ v28/v34 จอ 430px)
- **ปุ่ม "แก้" หยิบค่าจาก `this.trList`** ไม่ยัดชื่อลง onclick (`esc()` แปลง `'` เป็น `&#39;` แล้ว parser คืนกลับ ทำ JS string พัง — ชื่อหลักสูตรราชการมีวงเล็บ/อัญประกาศบ่อย)
- migration: probe `trainings` (42S02→schema.sql) — ตารางใหม่ล้วน ไม่ต้อง ALTER
