# Google Drive selfie sync

> แยกจาก CLAUDE.md (26 ส.ค. 2026) เพื่อคุมขนาด context — CLAUDE.md เก็บแค่กฎเหล็ก + ดัชนี

## Google Drive selfie sync (สำเนารูปเช็คอินขึ้น Drive)

- **ไฟล์:** `app/drive.php` (ท่อ Drive + คิว + OAuth handlers `h_gdrive_*`), `public/oauth.php` (OAuth callback — ไม่มี auth header พึ่ง `gdrive_oauth_state` ที่หมดอายุ 10 นาที กัน CSRF)
- **flow:** `h_checkin` เซฟรูปลง Volume แล้วเรียก `gdrive_enqueue()` (insert `drive_queue` + แตกโปรเซส worker `cron/drive.php` ผ่าน `gdrive_spawn_worker()` ไม่แตะ network) → เช็คอินตอบทันที → worker อัปโหลดเบื้องหลัง
- **retry:** `gdrive_process_queue()` อัปโหลดทีละ ≤3 รายการ, fail → `tries+1` (เพดาน 30 → status `error`); worker `cron/drive.php` มี `flock` กันรันซ้อน; `gdrive_kick_if_stale()` ใน `h_app_data`+`h_admin_data` แตก worker ไล่คิวค้างถ้าห่างรอบก่อน >60 วิ (throttle ด้วย `gdrive_last_run`)
- **⚠️ อย่ารัน curl คาใน request** — เดิมใช้ `after_response()` (helpers.php) ปิด connection ด้วย `Content-Length`+`Connection: close`+`fastcgi_finish_request()` แต่ **`fastcgi_finish_request()` ไม่มีบน Apache mod_php** (prod เป็น `php:8.3-apache` prefork) จึง**เลิกใช้ เปลี่ยนเป็นแตกโปรเซส CLI แยก** (`nohup php cron/drive.php &`) — ถ้า server ปิด `exec` → `gdrive_enqueue` fallback อัป inline สั้นๆ (`after_response` ยังอยู่ใน helpers แต่ไม่มีใครเรียกแล้ว)
- **scope `drive.file`** = แอปเห็นเฉพาะไฟล์/โฟลเดอร์ที่ตัวเองสร้าง → สร้างโฟลเดอร์ราก "รูปเช็คชื่อสถานีไฟป่า" เอง (id เก็บใน `gdrive_root_id`) แล้วให้พี่วินลากไปวางเอง — **เข้าถึงโฟลเดอร์ที่ผู้ใช้มีอยู่ก่อนไม่ได้** (ตั้งใจ แลกกับความปลอดภัย + ไม่ติด verification)
- **โฟลเดอร์รายวัน** ชื่อปี พ.ศ. `2569-mm-dd` (cache id วันละครั้งใน `gdrive_day_cache`); ชื่อไฟล์ `Hi_ชื่อจริง.jpg`
- **settings ที่เกี่ยว (ห้าม hardcode):** `gdrive_client_id`/`gdrive_client_secret` (แอดมินกรอก, อยู่ใน EDITABLE_SETTINGS), `gdrive_refresh_token`/`gdrive_access_token`/`gdrive_access_exp`/`gdrive_root_id`/`gdrive_day_cache`/`gdrive_oauth_state`/`gdrive_last_run` (ระบบเซ็ตเอง) — เหมือน LINE token ไม่อยู่ในโค้ด
- **OAuth setup:** แอดมินทำครั้งเดียวตามคู่มือ `SETUP_GDRIVE.md` — ต้อง Publish App + Enable Drive API มิฉะนั้นพัง (ดู PROGRESS.md → Lesson learned ข้อ 7)
