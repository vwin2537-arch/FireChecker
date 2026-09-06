# หน้าตั้งค่าแอดมิน (v41 — 6 ก.ย. 2026)

> โครง + กับดักของ `vSettings()` ใน `admin.js` — CLAUDE.md เก็บแค่กฎ 1 บรรทัดชี้มาที่นี่

## โครง 5 แท็บย่อย (`.seg.seg-5` — pattern เดียวกับ สุขภาพ/พัฒนา)

| แท็บ | key | มีอะไร | วิธีบันทึก |
|------|-----|--------|-----------|
| 📢 ประกาศ | `announce` | `announceHtml()` ฟอร์มส่งประกาศ (แท็บแรก = เปิดมาเจอเหมือนเดิม) | ปุ่มส่งเอง |
| ⏰ กติกา | `rules` | เวลาเช็คชื่อ · พิกัด (ใต้สวิตช์ GPS) · หลักฐาน (เซลฟี่, ใบหน้า+เกณฑ์ 3 ช่อง) · เช็คเอาท์+เวลา · วันหยุด/เวร | แถบบันทึกลอย |
| 📅 วันพิเศษ | `days` | นักขัตฤกษ์ · นอกสถานที่ทั้งสถานี · รายคน (handler แยก เซฟทันที) | ไม่มีแถบ |
| 🔗 เชื่อมต่อ | `connect` | Push (สวิตช์→เตือน→เวลา ซ้อนกัน + กุญแจ + อุปกรณ์) · LINE · Drive — ทุกการ์ดขึ้น `.st-status` ✅/⚠️ บนสุด | แถบบันทึกลอย |
| 🏷️ ทั่วไป | `general` | ชื่อสถานี · เปลี่ยนรหัส | แถบบันทึกลอย |

- แท็บล่าสุดจำใน `localStorage.fc_settab` · สลับแท็บทั้งที่ `setDirtyFlag` = true → Swal ถามก่อนทิ้ง
- helper: `T(k,label,sub)` สวิตช์ · `I(k,label,type,extra)` ช่องกรอก · **`G(k,label,sub,body)` = สวิตช์ + ช่องลูกใต้มัน** (`.fgroup` → ปิดสวิตช์ = `.fg-body` จาง 45% ด้วย `:has()` แต่ยังแก้ได้ ไม่ล็อก) ซ้อน G ใน G ได้ (Push → เตือน → เวลา)
- แถบบันทึก `#saveBar` เป็น `position:sticky; bottom: 76px+safe-area` (เหนือ bottom-nav) `hidden` จนกว่ามี event `input`/`change` บนช่อง `st_*` ใดๆ — `useHere()` ตั้งค่าด้วยโค้ดต้องเรียก `setDirty(true)` เอง

## เพิ่ม setting ใหม่

1. `app/handlers/admin.php` → เพิ่ม key ใน `EDITABLE_SETTINGS` (+ validation ถ้าเป็น time/bool/num)
2. `vSettings()` → ใส่ `I()`/`T()`/`G()` ในแท็บที่ถูกเรื่อง — **จบแค่นี้** `saveSettings()` เก็บทุก `[id^="st_"]` ใน `#view` เอง

## กับดัก

- **ห้ามกลับไปใช้รายชื่อ key ตายตัวใน `saveSettings`** — ก่อน v41 ลืม `push_enabled`/`push_remind_enabled`/`push_remind_time` → สวิตช์ Push บนจอเซฟไม่ได้เลย ไม่มี error (Lesson 14)
- **`.seg` 5 ปุ่มล้นจอมือถือ** — แถวเดียว 427px ในพื้นที่ 358px แท็บที่ 5 หลุดจอ (scroll-x เงียบ) → `.seg-5` จอ < 560px วางไอคอน `.si` บน/ชื่อล่าง (65px × 5 พอดี 358px) · จอกว้างกลับเป็นแถวเดียว · ถ้าจะเพิ่มแท็บที่ 6 ต้องวัดใหม่
- **วัดจอมือถือใน Chrome:** `resize_window` ไม่ทำงานตอน Chrome fullscreen — ใช้ `<iframe style="width:390px">` โหลด `index.php` แล้ววัด `scrollWidth` ใน `contentDocument` (media query ประเมินตาม iframe) · เข้าถึง `Admin` ผ่าน `contentWindow` ไม่ได้ (เป็น const ใน script scope) ให้ click ปุ่มใน DOM แทน
- test local ต้อง `php -d display_errors=0` (PHP 8.5 พ่น deprecated ปน JSON — Lesson 12)
