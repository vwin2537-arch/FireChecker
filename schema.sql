-- =====================================================
-- FireCheck — ระบบเช็คชื่อ จนท. สถานีควบคุมไฟป่าสลักพระ-เอราวัณ
-- MySQL 8.0+ compatible
-- =====================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NULL UNIQUE,   -- เจ้าหน้าที่ตั้งเองตอนลงทะเบียน (แอดมินเพิ่มแค่ชื่อ-สกุล → username = NULL จนกว่าจะลงทะเบียน)
  password_hash VARCHAR(255) NULL,
  name          VARCHAR(100) NOT NULL,
  position      VARCHAR(100) NOT NULL DEFAULT '',
  gender        ENUM('male','female') NULL,   -- ใช้กรองเวรกลางคืน (เฉพาะชาย) + เทียบเกณฑ์ทดสอบสมรรถภาพ; NULL = ยังไม่ระบุ
  birthdate     DATE NULL,                    -- ใช้คำนวณอายุเทียบเกณฑ์ทดสอบสมรรถภาพ; NULL = ยังไม่ระบุ
  role          ENUM('admin','staff') NOT NULL DEFAULT 'staff',
  -- unregistered → (ตั้งรหัสผ่าน) → pending → (แอดมินอนุมัติ) → active
  status        ENUM('unregistered','pending','active','disabled') NOT NULL DEFAULT 'unregistered',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_tokens (
  token        CHAR(64) PRIMARY KEY,
  user_id      INT NOT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  work_date   DATE NOT NULL,
  time_in     DATETIME NOT NULL,
  late        TINYINT(1) NOT NULL DEFAULT 0,
  lat         DECIMAL(10,6) NULL,
  lng         DECIMAL(10,6) NULL,
  distance_m  INT NULL,
  selfie_path VARCHAR(255) NULL,
  time_out    DATETIME NULL,
  report_text TEXT NULL,
  report_late TINYINT(1) NULL,
  photos_json TEXT NULL,
  note        VARCHAR(255) NULL,             -- หมายเหตุตอนเช็คชื่อ (ใช้กับงานวันอาทิตย์ เช่น "มาชดเชยวันลา")
  UNIQUE KEY uq_user_date (user_id, work_date),
  KEY idx_work_date (work_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- เวรกลางคืน (เฝ้าสำนักงาน — เฉพาะชาย, บันทึกคนมาจริง) ----------
-- duty_date = คืนของวันนั้น (เย็นวันนี้ → เช้าพรุ่งนี้). ใช้ยกเว้นสายเช้าถัดมา (duty_date = เมื่อวาน)
CREATE TABLE IF NOT EXISTS night_shifts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  duty_date   DATE NOT NULL,
  time_in     DATETIME NOT NULL,
  lat         DECIMAL(10,6) NULL,
  lng         DECIMAL(10,6) NULL,
  distance_m  INT NULL,
  selfie_path VARCHAR(255) NULL,
  UNIQUE KEY uq_user_night (user_id, duty_date),
  KEY idx_duty_date (duty_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS day_offs (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  off_date   DATE NOT NULL,
  -- dayoff = วันหยุดจองล่วงหน้า, sick = ลาป่วย, personal = ลากิจ
  type       ENUM('dayoff','sick','personal') NOT NULL DEFAULT 'dayoff',
  -- approved = ยืนยันแล้ว (dayoff เสมอ + ลาป่วย/กิจที่เลย deadline), pending = ลาป่วย/กิจล่วงหน้า รอหัวหน้าอนุมัติ
  -- ปฏิเสธ = ลบ row ทิ้ง (ไม่เก็บสถานะ rejected) → กลับเป็นวันทำงาน
  status     ENUM('pending','approved') NOT NULL DEFAULT 'approved',
  note       VARCHAR(255) NOT NULL DEFAULT '',
  over_quota TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_off (user_id, off_date),
  KEY idx_off_date (off_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- วันเช็คชื่อนอกสถานที่ (สั่งเจ้าหน้าที่ไปกิจกรรมนอกสถานี) — global รายวัน ไม่ผูก user
-- ถึงวันนี้: h_checkin ข้าม GPS enforce + ใช้ start_time/end_time แทน checkin_open/late_cutoff
CREATE TABLE IF NOT EXISTS offsite_days (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  off_date   DATE NOT NULL,
  start_time VARCHAR(5) NOT NULL,          -- "HH:MM" เวลาเปิดเช็ค
  end_time   VARCHAR(5) NOT NULL,          -- "HH:MM" เส้นตายไม่สาย
  reason     VARCHAR(255) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_offsite_date (off_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- กล่องข้อความเจ้าหน้าที่ (mailbox) — 1 แถว/คน/ข้อความ (broadcast = fan-out หลายแถว)
-- read_at NULL = ยังไม่อ่าน (จุดแดง); เปิดกล่อง = set read_at ทั้งหมด
CREATE TABLE IF NOT EXISTS notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  type       ENUM('announcement','leave_approved','leave_rejected') NOT NULL,
  title      VARCHAR(150) NOT NULL,
  body       TEXT NULL,
  ref_id     INT NULL,                         -- อ้างอิง (เช่น day_off id) — informational เท่านั้น
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at    DATETIME NULL,
  KEY idx_user_unread (user_id, read_at),
  KEY idx_user_created (user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  skey   VARCHAR(50) PRIMARY KEY,
  svalue TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS line_logs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  report_type VARCHAR(20) NOT NULL,
  report_date DATE NOT NULL,
  sent_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_type_date (report_type, report_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- คลังความรู้ (โซนพัฒนาตัวเอง เฟส 1) ----------
CREATE TABLE IF NOT EXISTS library_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(200) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  category    VARCHAR(20)  NOT NULL DEFAULT 'doc',   -- doc/slide/news/video/manual
  url         VARCHAR(500) NOT NULL,                 -- ลิงก์ Drive/ภายนอก (http/https เท่านั้น)
  file_id     VARCHAR(80)  NOT NULL DEFAULT '',      -- Drive file id (ดึง thumbnail); ว่าง = ไม่มีรูปปก
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,       -- 0 = ซ่อน (soft delete)
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS library_reads (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  item_id   INT NOT NULL,
  user_id   INT NOT NULL,
  viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acked_at  DATETIME NULL,                           -- เวลาที่กด "รับทราบ" (null = แค่เปิด ยังไม่รับทราบ)
  UNIQUE KEY uq_item_user (item_id, user_id),
  KEY idx_item (item_id),
  FOREIGN KEY (item_id) REFERENCES library_items(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- แบบทดสอบ (โซนพัฒนาตัวเอง เฟส 2) ----------
CREATE TABLE IF NOT EXISTS quiz_sets (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(200) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,       -- 0 = ซ่อน (soft delete)
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quiz_questions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  set_id        INT NOT NULL,
  question      VARCHAR(500) NOT NULL,
  choice1       VARCHAR(255) NOT NULL,
  choice2       VARCHAR(255) NOT NULL,
  choice3       VARCHAR(255) NOT NULL,
  choice4       VARCHAR(255) NOT NULL,
  correct_index TINYINT      NOT NULL,               -- 0-3
  sort_order    INT          NOT NULL DEFAULT 0,
  KEY idx_set (set_id),
  FOREIGN KEY (set_id) REFERENCES quiz_sets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  set_id     INT NOT NULL,
  user_id    INT NOT NULL,
  score      INT NOT NULL,
  total      INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_set_user (set_id, user_id),
  FOREIGN KEY (set_id) REFERENCES quiz_sets(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- สมุดบันทึกสุขภาพ (โซนสุขภาพ เฟส 1) ----------
-- แอดมินกรอกผลตรวจสุขภาพให้เจ้าหน้าที่แต่ละคน (หลาย entry ต่อคน ไม่มี UNIQUE) — เจ้าหน้าที่ดูของตัวเอง
-- เก็บเฉพาะค่าที่ระบบจัดระดับได้ (BMI/ความดัน/รอบเอว/ชีพจร) + note สำหรับผลแล็บอื่น ๆ
CREATE TABLE IF NOT EXISTS health_records (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  record_date   DATE NOT NULL,                 -- วันที่ไปตรวจ
  checkup_place VARCHAR(200) NOT NULL DEFAULT '',  -- ตรวจที่ไหน (รพ./คลินิก)
  weight_kg     DECIMAL(5,2) NULL,             -- น้ำหนัก (กก.)
  height_cm     DECIMAL(5,1) NULL,             -- ส่วนสูง (ซม.) — คู่กับน้ำหนักคำนวณ BMI สดตอนอ่าน
  waist_cm      DECIMAL(5,1) NULL,             -- รอบเอว (ซม.)
  bp_sys        INT NULL,                      -- ความดันตัวบน (SBP)
  bp_dia        INT NULL,                      -- ความดันตัวล่าง (DBP)
  pulse         INT NULL,                      -- ชีพจรขณะพัก (ครั้ง/นาที)
  note          VARCHAR(500) NOT NULL DEFAULT '',  -- ผลตรวจอื่น ๆ / หมายเหตุ
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user_date (user_id, record_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- ทดสอบสมรรถภาพ (โซนสุขภาพ เฟส 2) ----------
-- แอดมินออกแบบท่าทดสอบ + เกณฑ์เอง (configurable) แล้วกรอกผลให้เจ้าหน้าที่เป็นรอบ ระบบจัดระดับตามอายุ+เพศ
-- ท่าทดสอบ + เกณฑ์ผ่านตามช่วงอายุ/เพศ (แอดมินตั้งเอง)
CREATE TABLE IF NOT EXISTS fitness_items (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  unit          VARCHAR(20)  NOT NULL DEFAULT '',    -- ครั้ง / วินาที / ซม. / นาที
  -- higher = มากยิ่งดี (ดันพื้น) · lower = น้อย/เร็วยิ่งดี (เวลาวิ่ง) · cap = ผ่าน/ไม่ผ่านภายในเพดาน (WCT)
  direction     ENUM('higher','lower','cap') NOT NULL DEFAULT 'higher',
  -- higher/lower: {"levels":["ดี","พอใช้","ต้องปรับปรุง"],"bands":[{"min_age":18,"max_age":29,"male":[50,37,0],"female":[43,32,0]}]}
  -- cap: {"cap":45}   (raw_value <= cap → ผ่าน) — ไม่ต้องใช้อายุ/เพศ
  criteria_json TEXT         NULL,
  sort_order    INT          NOT NULL DEFAULT 0,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,      -- 0 = ซ่อน (soft delete)
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- รอบการทดสอบ (เช่น "ทดสอบประจำไตรมาส 3/2569")
CREATE TABLE IF NOT EXISTS fitness_rounds (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  title      VARCHAR(120) NOT NULL,
  test_date  DATE NOT NULL,
  note       VARCHAR(255) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ผลทดสอบรายคนต่อรอบต่อท่า (หลาย entry — เก็บทุกครั้ง เหมือน quiz_attempts)
CREATE TABLE IF NOT EXISTS fitness_results (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  round_id   INT NOT NULL,
  item_id    INT NOT NULL,
  user_id    INT NOT NULL,
  raw_value  DECIMAL(8,2) NULL,          -- ค่าที่วัดได้ (จำนวนครั้ง/วินาที/ซม./นาที)
  level      VARCHAR(40)  NULL,          -- ระดับที่จัดได้ (null = ยังไม่จัดระดับ เช่นไม่มีอายุ/เพศ)
  tone       VARCHAR(8)   NULL,          -- ok/warn/bad สำหรับสีป้าย (คำนวณตอนกรอก)
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_round_user (round_id, user_id),
  KEY idx_item_user (item_id, user_id),
  FOREIGN KEY (round_id) REFERENCES fitness_rounds(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id)  REFERENCES fitness_items(id)  ON DELETE CASCADE,
  FOREIGN KEY (user_id)  REFERENCES users(id)          ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- คิวส่งสำเนารูปเช็คชื่อขึ้น Google Drive ----------
-- เช็คอินสำเร็จก่อนเสมอ แล้วค่อยอัปโหลดเบื้องหลัง — pending จะถูก retry จนสำเร็จ (เพดาน 30 ครั้ง → error)
CREATE TABLE IF NOT EXISTS drive_queue (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  local_path VARCHAR(255) NOT NULL,                  -- path สัมพัทธ์ใน UPLOAD_DIR
  fname      VARCHAR(255) NOT NULL,                  -- ชื่อไฟล์ปลายทางบน Drive เช่น 0745_สมชาย.jpg
  work_date  DATE NOT NULL,                          -- ใช้ตั้งชื่อโฟลเดอร์รายวัน (ปี พ.ศ.)
  status     ENUM('pending','done','error') NOT NULL DEFAULT 'pending',
  tries      INT NOT NULL DEFAULT 0,
  last_error VARCHAR(255) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  done_at    DATETIME NULL,
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- คิวแจ้งเตือนเข้ากลุ่ม LINE (async — ไม่ push คาใน request) ----------
-- ใช้ตอนแอดมินอนุมัติคำขอลา → enqueue แล้วแตกโปรเซส worker ส่งเบื้องหลัง (เหมือน drive_queue)
CREATE TABLE IF NOT EXISTS line_queue (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  text       TEXT NOT NULL,
  status     ENUM('pending','done','error') NOT NULL DEFAULT 'pending',
  tries      INT NOT NULL DEFAULT 0,
  last_error VARCHAR(255) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  done_at    DATETIME NULL,
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- ค่าตั้งต้น (แก้ได้จากหน้าตั้งค่าแอดมิน) ----------
INSERT IGNORE INTO settings (skey, svalue) VALUES
  ('station_name',     'สถานีควบคุมไฟป่าสลักพระ-เอราวัณ'),
  ('checkin_open',     '08:05'),
  ('late_cutoff',      '08:15'),
  ('checkout_open',    '16:00'),
  ('report_cutoff',    '17:00'),
  ('gps_lat',          '14.37462'),
  ('gps_lng',          '99.14541'),
  ('gps_radius_m',     '1000'),
  ('gps_enforce',      '1'),
  ('selfie_required',  '0'),
  ('checkout_enabled', '0'),
  ('off_quota_month',  '10'),
  ('sunday_off',       '1'),
  ('night_shift_enabled', '1'),
  ('night_checkin_open',  '18:00'),
  ('sunday_work_enabled', '1'),
  ('line_token',       ''),
  ('line_group_id',    ''),
  ('gdrive_client_id',     ''),
  ('gdrive_client_secret', '');
