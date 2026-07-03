-- =====================================================
-- FireCheck — ระบบเช็คชื่อ จนท. สถานีควบคุมไฟป่าสลักพระ-เอราวัณ
-- MySQL 8.0+ compatible
-- =====================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  name          VARCHAR(100) NOT NULL,
  position      VARCHAR(100) NOT NULL DEFAULT '',
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
  UNIQUE KEY uq_user_date (user_id, work_date),
  KEY idx_work_date (work_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS day_offs (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  off_date   DATE NOT NULL,
  -- dayoff = วันหยุดจองล่วงหน้า, sick = ลาป่วย, personal = ลากิจ
  type       ENUM('dayoff','sick','personal') NOT NULL DEFAULT 'dayoff',
  note       VARCHAR(255) NOT NULL DEFAULT '',
  over_quota TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_off (user_id, off_date),
  KEY idx_off_date (off_date),
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
  ('line_token',       ''),
  ('line_group_id',    '');
