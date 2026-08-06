<?php
// =====================================================
// FireCheck — Database (PDO singleton) + Settings
// =====================================================

require_once __DIR__ . '/config.php';

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_PORT, DB_NAME);
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            // MySQL server บน Railway เป็น UTC — บังคับให้ NOW()/CURRENT_TIMESTAMP เป็นเวลาไทยทุกการเชื่อมต่อ
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET time_zone = '+07:00'",
        ]);
    }
    return $pdo;
}

/** อ่าน settings ทั้งหมด (cache ต่อ request) */
function settings(): array {
    static $cache = null;
    if ($cache === null) {
        $cache = [];
        foreach (db()->query('SELECT skey, svalue FROM settings') as $row) {
            $cache[$row['skey']] = $row['svalue'];
        }
    }
    return $cache;
}

function setting(string $key, string $default = ''): string {
    return settings()[$key] ?? $default;
}

function save_setting(string $key, string $value): void {
    db()->prepare('INSERT INTO settings (skey, svalue) VALUES (?, ?)
                   ON DUPLICATE KEY UPDATE svalue = VALUES(svalue)')
        ->execute([$key, $value]);
}

/** สร้างบัญชีแอดมินเริ่มต้นถ้ายังไม่มี admin — ถ้ายังไม่มีตาราง (deploy ครั้งแรก) รัน schema.sql ให้อัตโนมัติ */
function ensure_admin(): void {
    try {
        $n = db()->query("SELECT COUNT(*) c FROM users WHERE role='admin'")->fetch()['c'];
    } catch (PDOException $e) {
        if (($e->errorInfo[0] ?? '') !== '42S02') throw $e;   // ไม่ใช่ table-not-found
        db()->exec(file_get_contents(__DIR__ . '/../schema.sql'));
        $n = 0;
    }
    if ((int)$n === 0) {
        db()->prepare("INSERT INTO users (username, password_hash, name, role, status)
                       VALUES (?, ?, ?, 'admin', 'active')")
            ->execute([DEFAULT_ADMIN_USER, password_hash(DEFAULT_ADMIN_PASS, PASSWORD_DEFAULT), DEFAULT_ADMIN_NAME]);
    }

    // ensure ตารางที่เพิ่มภายหลัง (DB เดิมที่ deploy ไปแล้วจะไม่มี) — schema.sql เป็น IF NOT EXISTS/INSERT IGNORE รันซ้ำปลอดภัย
    try {
        db()->query('SELECT 1 FROM library_items LIMIT 1');
    } catch (PDOException $e) {
        if (($e->errorInfo[0] ?? '') !== '42S02') throw $e;   // ไม่ใช่ table-not-found
        db()->exec(file_get_contents(__DIR__ . '/../schema.sql'));
    }
    try {
        db()->query('SELECT 1 FROM quiz_sets LIMIT 1');
    } catch (PDOException $e) {
        if (($e->errorInfo[0] ?? '') !== '42S02') throw $e;   // ไม่ใช่ table-not-found
        db()->exec(file_get_contents(__DIR__ . '/../schema.sql'));
    }
    try {
        db()->query('SELECT 1 FROM drive_queue LIMIT 1');
    } catch (PDOException $e) {
        if (($e->errorInfo[0] ?? '') !== '42S02') throw $e;   // ไม่ใช่ table-not-found
        db()->exec(file_get_contents(__DIR__ . '/../schema.sql'));
    }
    try {
        db()->query('SELECT 1 FROM line_queue LIMIT 1');
    } catch (PDOException $e) {
        if (($e->errorInfo[0] ?? '') !== '42S02') throw $e;   // ไม่ใช่ table-not-found
        db()->exec(file_get_contents(__DIR__ . '/../schema.sql'));
    }
    try {
        db()->query('SELECT 1 FROM night_shifts LIMIT 1');
    } catch (PDOException $e) {
        if (($e->errorInfo[0] ?? '') !== '42S02') throw $e;   // ไม่ใช่ table-not-found
        db()->exec(file_get_contents(__DIR__ . '/../schema.sql'));
    }
    try {
        db()->query('SELECT 1 FROM health_records LIMIT 1');
    } catch (PDOException $e) {
        if (($e->errorInfo[0] ?? '') !== '42S02') throw $e;   // ไม่ใช่ table-not-found
        db()->exec(file_get_contents(__DIR__ . '/../schema.sql'));
    }
    try {
        db()->query('SELECT 1 FROM fitness_items LIMIT 1');
    } catch (PDOException $e) {
        if (($e->errorInfo[0] ?? '') !== '42S02') throw $e;   // ไม่ใช่ table-not-found
        db()->exec(file_get_contents(__DIR__ . '/../schema.sql'));
    }
    try {
        db()->query('SELECT 1 FROM offsite_days LIMIT 1');
    } catch (PDOException $e) {
        if (($e->errorInfo[0] ?? '') !== '42S02') throw $e;   // ไม่ใช่ table-not-found
        db()->exec(file_get_contents(__DIR__ . '/../schema.sql'));
    }
    try {
        db()->query('SELECT 1 FROM notifications LIMIT 1');
    } catch (PDOException $e) {
        if (($e->errorInfo[0] ?? '') !== '42S02') throw $e;   // ไม่ใช่ table-not-found
        db()->exec(file_get_contents(__DIR__ . '/../schema.sql'));
    }
    try {
        db()->query('SELECT 1 FROM offsite_users LIMIT 1');
    } catch (PDOException $e) {
        if (($e->errorInfo[0] ?? '') !== '42S02') throw $e;   // ไม่ใช่ table-not-found
        db()->exec(file_get_contents(__DIR__ . '/../schema.sql'));
    }
    try {
        db()->query('SELECT 1 FROM public_holidays LIMIT 1');
    } catch (PDOException $e) {
        if (($e->errorInfo[0] ?? '') !== '42S02') throw $e;   // ไม่ใช่ table-not-found
        db()->exec(file_get_contents(__DIR__ . '/../schema.sql'));
    }
    try {
        db()->query('SELECT 1 FROM face_descriptors LIMIT 1');
    } catch (PDOException $e) {
        if (($e->errorInfo[0] ?? '') !== '42S02') throw $e;   // ไม่ใช่ table-not-found
        db()->exec(file_get_contents(__DIR__ . '/../schema.sql'));
    }
    seed_public_holidays();   // ใส่วันหยุดนักขัตฤกษ์ที่เหลือของปีให้ครั้งแรก (ตารางว่าง)
    seed_fitness_presets();   // ใส่ท่าทดสอบตั้งต้น (WCT + ดันพื้น) ครั้งแรกที่ตารางว่าง

    // migrate: users.username เดิมเป็น NOT NULL — เจ้าหน้าที่ตั้ง username เองตอนลงทะเบียนแล้ว
    // แอดมินเพิ่มแค่ชื่อ-สกุล (username = NULL จนกว่าจะลงทะเบียน) → ต้อง ALTER ให้ nullable
    // (probe information_schema ก่อน ALTER ไม่รันซ้ำทุก request; UNIQUE index เดิมคงอยู่ MySQL ยอม NULL หลายแถว)
    $nullable = db()->query(
        "SELECT IS_NULLABLE FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'username'"
    )->fetchColumn();
    if ($nullable === 'NO') {
        db()->exec("ALTER TABLE users MODIFY username VARCHAR(50) NULL");
    }

    // migrate: day_offs.status เพิ่มภายหลัง (ระบบอนุมัติลา เฟส 2) — DB เดิมที่ deploy ไปแล้วยังไม่มีคอลัมน์นี้
    // probe information_schema ก่อน ALTER ไม่รันซ้ำทุก request; DEFAULT 'approved' backfill row เก่าให้ถูก
    $hasStatus = db()->query(
        "SELECT COUNT(*) FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'day_offs' AND COLUMN_NAME = 'status'"
    )->fetchColumn();
    if (!(int)$hasStatus) {
        db()->exec("ALTER TABLE day_offs
                    ADD COLUMN status ENUM('pending','approved') NOT NULL DEFAULT 'approved' AFTER type");
    }

    // migrate: users.gender (เวรกลางคืน) — DB เดิมยังไม่มีคอลัมน์นี้ (row เก่าเป็น NULL = ยังไม่ระบุเพศ)
    $hasGender = db()->query(
        "SELECT COUNT(*) FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'gender'"
    )->fetchColumn();
    if (!(int)$hasGender) {
        db()->exec("ALTER TABLE users ADD COLUMN gender ENUM('male','female') NULL AFTER position");
    }

    // migrate: users.birthdate (โซนสุขภาพ — คำนวณอายุเทียบเกณฑ์ทดสอบสมรรถภาพ) — DB เดิมยังไม่มีคอลัมน์นี้ (row เก่าเป็น NULL)
    $hasBirthdate = db()->query(
        "SELECT COUNT(*) FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'birthdate'"
    )->fetchColumn();
    if (!(int)$hasBirthdate) {
        db()->exec("ALTER TABLE users ADD COLUMN birthdate DATE NULL AFTER gender");
    }

    // migrate: attendance.note (หมายเหตุงานวันอาทิตย์) — DB เดิมยังไม่มีคอลัมน์นี้
    $hasNote = db()->query(
        "SELECT COUNT(*) FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance' AND COLUMN_NAME = 'note'"
    )->fetchColumn();
    if (!(int)$hasNote) {
        db()->exec("ALTER TABLE attendance ADD COLUMN note VARCHAR(255) NULL AFTER photos_json");
    }

    // migrate: offsite_users.no_late (วันไปราชการไม่นับสาย) — DB ที่สร้าง offsite_users ไปก่อนหน้ายังไม่มีคอลัมน์นี้
    $hasNoLate = db()->query(
        "SELECT COUNT(*) FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'offsite_users' AND COLUMN_NAME = 'no_late'"
    )->fetchColumn();
    if (!(int)$hasNoLate) {
        db()->exec("ALTER TABLE offsite_users ADD COLUMN no_late TINYINT(1) NOT NULL DEFAULT 0 AFTER reason");
    }

    // migrate: attendance.face_flag/face_dist/face_photo (ยืนยันใบหน้า v33) — DB เดิมยังไม่มี
    // probe คอลัมน์แรกคุมทั้งชุด แล้วเพิ่มพร้อมกันใน ALTER เดียว (ลด query ต่อ request — ensure_admin รันทุกครั้ง)
    $hasFace = db()->query(
        "SELECT COUNT(*) FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance' AND COLUMN_NAME = 'face_flag'"
    )->fetchColumn();
    if (!(int)$hasFace) {
        db()->exec("ALTER TABLE attendance
                    ADD COLUMN face_flag  TINYINT(1) NOT NULL DEFAULT 0 AFTER note,
                    ADD COLUMN face_dist  DECIMAL(6,4) NULL AFTER face_flag,
                    ADD COLUMN face_photo VARCHAR(255) NULL AFTER face_dist");
        db()->exec("ALTER TABLE night_shifts
                    ADD COLUMN face_flag TINYINT(1) NOT NULL DEFAULT 0 AFTER selfie_path");
    }
}

/** ใส่ท่าทดสอบสมรรถภาพตั้งต้นครั้งแรก (ตารางว่าง) — แอดมินแก้/เพิ่ม/ซ่อนได้ภายหลัง
 *  WCT Pack Test = มาตรฐานสากลนักดับไฟป่า (US Forest Service) · ดันพื้น = ThaiSook (เกณฑ์บางส่วน เติมเต็มได้)
 */
function seed_fitness_presets(): void {
    if ((int)db()->query('SELECT COUNT(*) FROM fitness_items')->fetchColumn() > 0) return;

    // ดันพื้น: ระดับ ดี/พอใช้/ต้องปรับปรุง (best→worst) เกณฑ์แยกอายุ×เพศ (ThaiSook — ช่วงมาตรฐานเป็นขอบ "พอใช้")
    $pushup = json_encode([
        'levels' => ['ดี', 'พอใช้', 'ต้องปรับปรุง'],
        'bands'  => [
            ['min_age' => 18, 'max_age' => 29, 'male' => [50, 37, 0], 'female' => [43, 32, 0]],
            ['min_age' => 30, 'max_age' => 39, 'male' => [40, 27, 0], 'female' => [31, 22, 0]],
            ['min_age' => 40, 'max_age' => 49, 'male' => [31, 22, 0], 'female' => [25, 17, 0]],
            ['min_age' => 50, 'max_age' => 59, 'male' => [25, 17, 0], 'female' => [17, 11, 0]],
            ['min_age' => 60, 'max_age' => 69, 'male' => [17, 11, 0], 'female' => [14, 10, 0]],
        ],
    ], JSON_UNESCAPED_UNICODE);

    $items = [
        ['WCT — Arduous (เดิน 4.8 กม. แบกเป้ 20.4 กก.)',  'นาที', 'cap',    json_encode(['cap' => 45], JSON_UNESCAPED_UNICODE), 1],
        ['WCT — Moderate (เดิน 3.2 กม. แบกเป้ 11.3 กก.)', 'นาที', 'cap',    json_encode(['cap' => 30], JSON_UNESCAPED_UNICODE), 2],
        ['WCT — Light (เดิน 1.6 กม.)',                     'นาที', 'cap',    json_encode(['cap' => 16], JSON_UNESCAPED_UNICODE), 3],
        ['ดันพื้น (1 นาที)',                                'ครั้ง', 'higher', $pushup, 4],
    ];
    $st = db()->prepare('INSERT INTO fitness_items (name, unit, direction, criteria_json, sort_order) VALUES (?, ?, ?, ?, ?)');
    foreach ($items as $it) $st->execute($it);
}

/** ใส่วันหยุดนักขัตฤกษ์ตั้งต้นครั้งแรก (ตารางว่าง) — เฉพาะวันในอนาคต แอดมินเพิ่ม/ลบได้ภายหลัง
 *  ที่มา: ประกาศวันหยุดราชการ 2569 (สำนักนายกฯ) — seed เฉพาะครึ่งปีหลังที่ยังไม่ผ่าน
 */
function seed_public_holidays(): void {
    if ((int)db()->query('SELECT COUNT(*) FROM public_holidays')->fetchColumn() > 0) return;
    $today = date('Y-m-d');
    $days = [
        ['2026-08-12', 'วันแม่แห่งชาติ'],
        ['2026-10-13', 'วันคล้ายวันสวรรคต ร.9'],
        ['2026-10-23', 'วันปิยมหาราช'],
        ['2026-12-07', 'ชดเชยวันพ่อแห่งชาติ'],
        ['2026-12-10', 'วันรัฐธรรมนูญ'],
        ['2026-12-31', 'วันสิ้นปี'],
    ];
    $st = db()->prepare('INSERT IGNORE INTO public_holidays (holiday_date, name) VALUES (?, ?)');
    foreach ($days as $d) if ($d[0] >= $today) $st->execute($d);
}
