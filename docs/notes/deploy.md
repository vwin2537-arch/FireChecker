# Deploy + กับดัก Railway

> แยกจาก CLAUDE.md (26 ส.ค. 2026) เพื่อคุมขนาด context — CLAUDE.md เก็บแค่กฎเหล็ก + ดัชนี

## Deploy

Railway + Dockerfile (ดูขั้นตอนละเอียดใน README.md) — env ที่ต้องมี: ตัวแปร MySQL (reference), `CRON_SECRET`, `UPLOAD_DIR=/data/uploads` + Volume ที่ `/data`

**⚠️ push GitHub ไม่ auto-deploy** — repo เป็น source control อย่างเดียว ไม่ได้ผูก webhook ต้อง deploy tarball เอง: `railway up` หรือ MCP `deploy` (`path=firecheck/`, service `8a5f15ef-d377-4437-80aa-b0fc0775d087`) ทุก deployment คอลัมน์ commit เป็น `-` เพราะเป็น tarball upload ไม่ใช่ GitHub-triggered — verify live ด้วย `curl https://sakpra-erawan.up.railway.app/index.php` ทุกครั้ง — ถ้า MCP `deploy`/`whoami` ค้าง `Unauthorized` (auth คนละชุดกับ CLI) ให้ใช้ `railway up` ตรงๆ ในเทอร์มินัลแทนได้เลย ไม่ต้อง re-login

**⚠️ Cache-bust ตอนแก้ frontend** — `sw.js` เก็บ `assets/*` แบบ cache-first PWA ที่ติดตั้งแล้วจะเห็นของเก่าถ้าไม่เด้ง version ต้องแก้ **พร้อมกัน 2 ที่**: `?v=N` ใน `index.php` (css+js+admin.js) **และ** `const CACHE = 'firecheck-vN'` + ASSETS `?v=N` ใน `sw.js` (activate จะล้าง cache เก่าให้). **`index.php` มี PHP `header('Cache-Control: no-cache')` ต้นไฟล์** (เพิ่ม v23) กัน iOS PWA standalone ค้าง HTML shell เก่าที่ยังชี้ไป asset เก่า → วนงูกินหาง (เจอจริง: บั๊ก UI ที่ hard-refresh แล้วไม่หาย มักเป็น**โค้ดค้าง/โค้ดซ้ำ 2 ที่** ไม่ใช่ cache — เช่น `devSegHtml` มีทั้งใน app.js (staff) และ admin.js (admin) แก้ที่เดียวไม่พอ)

**Live:** https://sakpra-erawan.up.railway.app — Railway project "firecheck" (`0490e262-abfe-49c6-bd47-81cdd12ed7d1`), service `firecheck-app` + `MySQL` + Volume `/data` (domain renamed from the default `firecheck-app-production.up.railway.app` for staff usability; `firecheck.up.railway.app` was already taken by someone else)

**⚠️ Dockerfile CMD ห้ามย้าย `rm -f mpm_event.*` กลับไปเป็น build-time RUN** — เจอบั๊กจริงบน Railway: ไฟล์ที่ลบใน Docker build layer (RUN) ไม่ persist มาถึง container ตอนรันจริง (`mpm_event.load` กลับมาเป็นของ base image เดิมทุกครั้ง แม้ build log ยืนยันว่าลบสำเร็จ) ทำให้ Apache crash loop ด้วย `AH00534: More than one MPM loaded` ทางแก้ที่ใช้ได้จริงคือลบใน `CMD` (runtime, writable fs) เท่านั้น — ดู Dockerfile ปัจจุบัน

**⚠️ Volume ต้อง chown ให้ www-data ใน CMD (runtime)** — `/data/uploads` ตอน Volume mount เป็นของ root แต่ Apache รันเป็น www-data → `save_photo()` mkdir ไม่ได้ = Permission denied → selfie เซฟไม่ได้เลย ต้อง `mkdir -p "$UPLOAD_DIR" && chown -R www-data:www-data "$UPLOAD_DIR"` ใน `CMD` (runtime เพราะ Volume mount ตอน runtime เหมือนบั๊ก mpm) — ดู PROGRESS.md → Lesson learned ข้อ 8

**⚠️ display_errors ต้อง Off บน prod** — base image เปิด display_errors → PHP warning ใดๆ ถูกพ่นหน้า JSON body → `res.json()` พังฝั่ง client = **"การเชื่อมต่อขัดข้อง"** (สัญญาณ: HTTP ยัง 200 แต่ content-type กลายเป็น `text/html` + body ขึ้นต้น `<br>`) ตั้ง `display_errors=Off`+`log_errors=On` ใน `firecheck.ini` (warning ไปลง Railway deploy log แทน) — ดู PROGRESS.md → Lesson learned ข้อ 8

**⚠️ MySQL บน Railway เป็น UTC** — SQL `NOW()`/`CURRENT_TIMESTAMP` เก็บเวลา UTC → เวลาเช็คอินเพี้ยน -7 ชม. `db.php` ตั้ง `PDO::MYSQL_ATTR_INIT_COMMAND => "SET time_zone='+07:00'"` ทุกการเชื่อมต่อ (คอลัมน์เวลาเป็น DATETIME ล้วน ไม่มี TIMESTAMP → ตั้ง tz ไม่กระทบค่าที่เก็บไว้แล้ว มีผลเฉพาะ write ใหม่) — ดู PROGRESS.md → Lesson learned ข้อ 9
