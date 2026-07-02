<?php
// =====================================================
// FireCheck — Configuration
// อ่านค่าจาก Environment Variables (Railway) หรือใช้ค่า local dev
// =====================================================

date_default_timezone_set('Asia/Bangkok');

function env(string $key, string $default = ''): string {
    $v = getenv($key);
    return ($v === false || $v === '') ? $default : $v;
}

// Railway MySQL ให้ตัวแปร MYSQLHOST/MYSQLPORT/MYSQLUSER/MYSQLPASSWORD/MYSQLDATABASE
define('DB_HOST', env('MYSQLHOST', env('DB_HOST', '127.0.0.1')));
define('DB_PORT', env('MYSQLPORT', env('DB_PORT', '3306')));
define('DB_USER', env('MYSQLUSER', env('DB_USER', 'root')));
define('DB_PASS', env('MYSQLPASSWORD', env('DB_PASS', '')));
define('DB_NAME', env('MYSQLDATABASE', env('DB_NAME', 'firecheck')));

// โฟลเดอร์เก็บรูป — บน Railway ให้ mount Volume แล้วตั้ง UPLOAD_DIR=/data/uploads
define('UPLOAD_DIR', rtrim(env('UPLOAD_DIR', __DIR__ . '/../public/uploads'), '/'));

// secret สำหรับ endpoint cron (LINE Bot) — ตั้งใน Railway env
define('CRON_SECRET', env('CRON_SECRET', 'dev-cron-secret'));

// บัญชีแอดมินเริ่มต้น (สร้างอัตโนมัติถ้ายังไม่มี admin ในระบบ)
define('DEFAULT_ADMIN_USER', 'admin');
define('DEFAULT_ADMIN_PASS', env('ADMIN_INIT_PASS', 'admin1234'));
define('DEFAULT_ADMIN_NAME', 'ผู้ดูแลระบบ');
