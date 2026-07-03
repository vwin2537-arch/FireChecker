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
}
