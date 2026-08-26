# กล่องข้อความ / Mailbox

> แยกจาก CLAUDE.md (26 ส.ค. 2026) เพื่อคุมขนาด context — CLAUDE.md เก็บแค่กฎเหล็ก + ดัชนี

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
