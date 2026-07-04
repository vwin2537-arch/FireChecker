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
