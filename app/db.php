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
}
