# แดชบอร์ด/ปฏิทิน + รายงานอันดับความขยัน

> แยกจาก CLAUDE.md (26 ส.ค. 2026) เพื่อคุมขนาด context — CLAUDE.md เก็บแค่กฎเหล็ก + ดัชนี

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

## สูตร Engagement Score — v36 (`engagement_ranking` ใน admin.php)

**เต็ม 100 = คะแนนรายวัน 80 + โบนัสสม่ำเสมอ 20**

- **รายวัน 80** คิดจาก `planned` = วันทำการที่คนนั้นต้องมา (**ตัดวันลาออก** เหมือนเดิม) — โหมดเช็คอินอย่างเดียว: มา 50 + เช้าตรงเวลา 30 · โหมดเปิดเช็คเอาท์: 25 + 25 + ส่งรายงาน 15 + รายงานตรงเวลา 15
- **โบนัสสม่ำเสมอ 20** = `20 × present / (planned + leave)` — **ตัวหารเป็นวันทำการของ "คนนั้น" ไม่ใช่ของทั้งเดือน** เพราะลูปข้ามวันก่อน `created_at` อยู่แล้ว ถ้าใช้จำนวนวันทำการทั้งเดือนดิบๆ **คนเข้าระบบกลางเดือนจะโดนหักฟรีทั้งที่มาครบทุกวัน** (เข้าวันที่ 20 มาครบ 5 วัน → ได้โบนัสแค่ 4/20)
- **ทำไมต้องมีโบนัสนี้:** ก่อน v36 วันลาถูกตัดออกจากตัวหารอย่างเดียว → *ยิ่งลาเยอะยิ่งได้ 100 ง่าย* เพราะมีวันให้พลาดน้อยลง. ส.ค.69 จึงตัน 100 ถึง 8/19 คน และคนลา 7 วัน (มา 17/25) เกือบได้ 100 เท่าคนมาครบ. **พี่วินตัดสินใจ (2 ก.ย. 69) ให้วันลาหักคะแนน** ยอมรับว่าคนป่วยจริงเสียคะแนนบ้าง แลกกับการที่คะแนนแยกอันดับได้จริงเพื่อใช้แจกรางวัลรายเดือน
- **tiebreak (ของเดิมไม่มีเลย):** คะแนนเท่ากัน → มามากกว่า → สายน้อยกว่า → ขาดน้อยกว่า → **เข้างานเช้ากว่า (`avg_in`)**. ก่อน v36 `usort` เทียบแค่ score พอเท่ากัน PHP 8 คงลำดับเดิม = `ORDER BY name` จาก SQL → **อันดับเรียงตามชื่อ** (คนมาครบ 25 วันได้ที่ 4 ส่วนคนมา 23 วันได้ที่ 1) **ห้ามเอา usort เดิมกลับ**
- **เทียบผลจริง ส.ค.69** (19 คน · 25 วันทำการ): ประสงค์ มา25 ลา0 → 100 **คนเดียว** · แก้วใจ/มานุช มา24 → 99.2 · จิรัตติกาล/พลวัฒน์ มา23 → 98.4 · สมบุญ/สิทธิชัย/เกียรติ มา22 → 97.6 · ทศพร/เชิดชัย ลา7 มา17 → **90→85.8** · คามิน ไม่ลาเลย มา22 → **83.2→84.4 แซงคนลาเยอะ**
- **⚠️ ยังไม่ได้แก้ (รู้ตัวแล้ว):** query ดึง `day_offs` **ไม่กรอง `status`** — ใบลาเกินโควต้าที่ค้าง `pending` รอหัวหน้าอนุมัติถูกนับเป็น "ลา" ไปแล้ว (ใบที่ปฏิเสธถูกลบ row จึงไม่มีปัญหา). ถ้าจะกรอง `status='approved'` ต้องคิดด้วยว่าวันนั้นจะกลายเป็น **ขาด** ทันที (โค้ดตกไปทาง `$absent++`) ซึ่งแรงกว่าเดิมมาก
- **วิธีเทสสูตรนี้ซ้ำ:** สร้าง DB เปล่า → โหลด `schema.sql` → ใส่ `public_holidays` ของเดือนนั้น → seed users/attendance/day_offs ให้ยอด มา/ตรง/สาย/ลา/ขาด ตรงกับรายงานจริง → `DB_NAME=... php -r 'require ...; engagement_ranking("YYYY-MM")'` แล้วเทียบทีละแถว (เร็วกว่าเปิด UI มาก)

